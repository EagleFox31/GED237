from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID
import re
import secrets
import unicodedata

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors.domain import (
    AccountLockedError,
    OtpContactMissingError,
    OtpDeliveryError,
    OtpResendQuotaError,
    OtpResendTooSoonError,
    TotpResendUnavailableError,
)
from app.core.exceptions import AuthenticationError, NotFoundError
from app.core.redis import get_redis
from app.core import session_revocation
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_otp,
    verify_password,
)
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User
from app.services import otp_delivery, totp
from app.services.audit_trail import audit_entry

# Value of otp:<session> when the session waits for the authenticator app code.
# Never equal to a stored code: those are hashes with a prefix.
TOTP_PENDING = "totp"
METHOD_TOTP = "totp"
# Login of a role that must use the app, password and e-mail code checked, but
# no app yet: an opaque key that opens enrolment only, never an API route.
ENROL_PREFIX = "totp_enrol:"
TOTP_ENROLMENT_SECONDS = 600
ENROLMENT_REQUIRED = "totp_enrolment_required"


class AuthService:
    """Authentication service"""

    OTP_EXPIRY_SECONDS = 300
    SESSION_TOKEN_EXPIRY_SECONDS = 300

    @staticmethod
    def _normalize_value(value: str | None) -> str:
        if not value:
            return ""
        normalized = unicodedata.normalize("NFKD", value)
        ascii_only = "".join(ch for ch in normalized if not unicodedata.combining(ch))
        ascii_only = ascii_only.lower().strip()
        ascii_only = re.sub(r"\s+", " ", ascii_only)
        return ascii_only

    def _candidate_values(self, institution: str) -> set[str]:
        raw = institution.strip()
        normalized = self._normalize_value(raw)
        candidates = {normalized}

        match = re.search(r"\(([^)]+)\)", raw)
        if match:
            candidates.add(self._normalize_value(match.group(1)))

        compact = re.sub(r"\([^)]*\)", "", raw).strip()
        if compact:
            candidates.add(self._normalize_value(compact))

        return {candidate for candidate in candidates if candidate}

    async def _resolve_tenant(self, db: AsyncSession, institution: str) -> Tenant:
        candidates = self._candidate_values(institution)
        result = await db.execute(select(Tenant).where(Tenant.is_active.is_(True)))
        for tenant in result.scalars().all():
            tenant_values = {
                self._normalize_value(tenant.name),
                self._normalize_value(tenant.short_name),
                self._normalize_value(tenant.domain),
            }
            if candidates & {value for value in tenant_values if value}:
                return tenant
        raise AuthenticationError("Invalid credentials")

    async def login(
        self,
        db: AsyncSession,
        institution: str,
        matricule: str,
        password: str,
        request: Optional[Request] = None,
    ) -> Dict[str, Any]:
        """
        Step 1: Verify credentials and generate OTP.
        Institution is part of the tenant-scoped identity contract.
        """
        tenant = await self._resolve_tenant(db, institution)

        result = await db.execute(
            select(User).where(
                User.tenant_id == tenant.id,
                User.matricule == matricule,
                User.is_active.is_(True),
            )
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise AuthenticationError("Invalid credentials")

        redis = await get_redis()
        # Checked before the password: a locked account must not confirm a right password.
        await self._raise_if_locked(redis, user.id)

        if not verify_password(password, user.password_hash):
            await self._audit_refused(db, user, "mot de passe incorrect", request)
            raise AuthenticationError("Invalid credentials")

        session_token = secrets.token_urlsafe(32)
        if await totp.is_active_for(db, user.id):
            # Nothing is sent: the code comes from the user's app, with no e-mail
            # fallback (DEC-2026-004). Lost phone: reset by a superior.
            await redis.setex(
                f"otp:{session_token}", self.OTP_EXPIRY_SECONDS, TOTP_PENDING
            )
            await redis.setex(
                f"session:{session_token}",
                self.SESSION_TOKEN_EXPIRY_SECONDS,
                str(user.id),
            )
            return {
                "session_token": session_token,
                "message": "Enter the code shown by your authenticator app",
                "expires_in": self.OTP_EXPIRY_SECONDS,
                "method": METHOD_TOTP,
            }
        otp = await self._send_code(
            db,
            redis,
            user,
            session_token,
            expires_in=self.OTP_EXPIRY_SECONDS,
            request=request,
        )
        await redis.setex(
            f"session:{session_token}",
            self.SESSION_TOKEN_EXPIRY_SECONDS,
            str(user.id),
        )
        return self._code_response(session_token, otp, self.OTP_EXPIRY_SECONDS)

    async def resend_otp(
        self,
        db: AsyncSession,
        session_token: str,
        request: Optional[Request] = None,
    ) -> Dict[str, Any]:
        """New code for an open login session. The session is not extended."""
        redis = await get_redis()
        session_key = f"session:{session_token}"
        user_id_str = await redis.get(session_key)
        remaining = await redis.ttl(session_key)
        if not user_id_str or remaining <= 0:
            raise AuthenticationError("Invalid or expired session")

        user_id = UUID(user_id_str)
        await self._raise_if_locked(redis, user_id)
        user = await db.get(User, user_id)
        if user is None or not user.is_active:
            raise AuthenticationError("Invalid or expired session")

        if await redis.get(f"otp:{session_token}") == TOTP_PENDING:
            raise TotpResendUnavailableError(
                technical_detail="resend on an app session"
            )

        cooldown = settings.AUTH_OTP_RESEND_COOLDOWN_SECONDS
        resend_key = f"otp_resend:{session_token}"
        # SET NX: two requests racing get one sending.
        if cooldown > 0 and not await redis.set(resend_key, "1", ex=cooldown, nx=True):
            raise OtpResendTooSoonError(retry_after=await redis.ttl(resend_key))
        quota_key = await self._count_resend(redis, user_id, resend_key)
        try:
            otp = await self._send_code(
                db, redis, user, session_token, expires_in=remaining, request=request
            )
        except OtpDeliveryError:
            # Nothing was sent: the previous code still works and a retry is allowed.
            await redis.delete(resend_key)
            if quota_key:
                await redis.decr(quota_key)
            raise
        return self._code_response(session_token, otp, remaining)

    async def _count_resend(self, redis, user_id: UUID, resend_key: str):
        """Count one resend for the account; 429 beyond the quota of the window.

        Counted per account, not per login session: opening new sessions does not
        give more codes. The window starts at the first resend (SET NX EX).
        """
        allowed = settings.AUTH_OTP_RESEND_MAX_PER_WINDOW
        if allowed <= 0:
            return None
        quota_key = f"otp_resend_count:{user_id}"
        window = settings.AUTH_OTP_RESEND_WINDOW_SECONDS
        await redis.set(quota_key, 0, ex=window, nx=True)
        count = await redis.incr(quota_key)
        if await redis.ttl(quota_key) < 0:  # expired between SET and INCR
            await redis.expire(quota_key, window)
        if count > allowed:
            await redis.decr(quota_key)
            await redis.delete(resend_key)
            raise OtpResendQuotaError(retry_after=await redis.ttl(quota_key))
        return quota_key

    async def _send_code(
        self,
        db: AsyncSession,
        redis,
        user: User,
        session_token: str,
        *,
        expires_in: int,
        request: Optional[Request],
    ) -> str:
        """Generate a code, deliver it, then store its hash. Raises if not delivered."""
        otp = generate_otp(6)
        channel = otp_delivery.get_channel()
        result = await channel.deliver(user, otp, expires_in=expires_in)
        if channel.sends:
            await self._audit_delivery(db, user, channel.name, result, request)
        if not result.delivered:
            if result.reason == otp_delivery.REASON_NO_CONTACT:
                raise OtpContactMissingError(
                    technical_detail=f"no contact for channel {channel.name}"
                )
            raise OtpDeliveryError(
                technical_detail=f"channel {channel.name}: {result.reason}"
            )

        await redis.setex(
            f"otp:{session_token}",
            expires_in,
            otp_delivery.hash_code(session_token, otp),
        )
        # Starts the resend delay at login too, when a message really left.
        cooldown = settings.AUTH_OTP_RESEND_COOLDOWN_SECONDS
        if cooldown > 0 and channel.sends:
            await redis.set(f"otp_resend:{session_token}", "1", ex=cooldown)
        return otp

    @staticmethod
    def _code_response(session_token: str, otp: str, expires_in: int) -> Dict[str, Any]:
        response: Dict[str, Any] = {
            "session_token": session_token,
            "message": "OTP sent to your registered contact",
            "expires_in": expires_in,
            "method": otp_delivery.get_channel().name,
        }
        if (
            settings.ENVIRONMENT == "development"
            and otp_delivery.get_channel().echoes_code
        ):
            response["otp"] = otp
        return response

    @staticmethod
    async def _audit_delivery(
        db: AsyncSession,
        user: User,
        channel_name: str,
        result: otp_delivery.DeliveryResult,
        request: Optional[Request],
    ) -> None:
        """Sending of a code, succeeded or not. Never the code, only a masked target."""
        details: Dict[str, Any] = {"channel": channel_name}
        if result.target:
            details["target"] = result.target
        if result.reason:
            details["reason"] = result.reason
        db.add(
            audit_entry(
                tenant_id=user.tenant_id,
                user_id=user.id,
                table_name="users",
                record_id=user.id,
                action="otp_sent" if result.delivered else "otp_send_failed",
                details=details,
                request=request,
            )
        )
        # Committed here: a failed delivery raises right after (get_db rolls back).
        await db.commit()

    @staticmethod
    async def _audit_refused(
        db: AsyncSession, user: User, reason: str, request: Optional[Request]
    ) -> None:
        """Refused login of an identified account. Never the password or the code."""
        db.add(
            audit_entry(
                tenant_id=user.tenant_id,
                user_id=user.id,
                table_name="users",
                record_id=user.id,
                action="login_failed",
                details={
                    "name": user.full_name,
                    "matricule": user.matricule,
                    "reason": reason,
                },
                request=request,
            )
        )
        # Committed here: the caller raises right after, and get_db rolls back on error.
        await db.commit()

    async def verify_otp(
        self,
        db: AsyncSession,
        session_token: str,
        otp: str,
        request: Optional[Request] = None,
    ) -> Dict[str, Any]:
        """Step 2: Verify OTP and generate JWT tokens."""
        redis = await get_redis()

        otp_key = f"otp:{session_token}"
        session_key = f"session:{session_token}"
        stored_otp = await redis.get(otp_key)
        if not stored_otp:
            raise AuthenticationError("Invalid or expired session")

        user_id_str = await redis.get(session_key)
        if not user_id_str:
            raise AuthenticationError("Session expired")

        user_id = UUID(user_id_str)
        # A session opened just before the lock must not get round it.
        await self._raise_if_locked(redis, user_id)
        if stored_otp == TOTP_PENDING:
            accepted = await totp.consume(db, user_id, otp)
        else:
            accepted = otp_delivery.code_matches(stored_otp, session_token, otp)
        if not accepted:
            # Audited before the counter: at the limit it ends the session.
            pending_user = await db.get(User, user_id)
            if pending_user is not None:
                await self._audit_refused(
                    db, pending_user, "code de verification incorrect", request
                )
            await self._record_otp_failure(
                db,
                redis,
                user_id,
                otp_key,
                session_key,
                request,
                holder_notice=stored_otp == TOTP_PENDING,
            )
            raise AuthenticationError("Invalid OTP")
        await redis.delete(f"otp_fail:{user_id}")

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError("User not found")

        result = await db.execute(select(Role).where(Role.id == user.role_id))
        role = result.scalar_one()

        # The login session ends here either way: tokens, or enrolment only.
        await redis.delete(otp_key, session_key, f"otp_resend:{session_token}")
        if totp.required_for(role.code) and not await totp.is_active_for(db, user.id):
            return await self._open_enrolment(db, redis, user, request)
        return await self._issue_tokens(db, user, role, request)

    async def _issue_tokens(
        self, db: AsyncSession, user: User, role: Role, request: Optional[Request]
    ) -> Dict[str, Any]:
        """Second factor checked: the login is recorded and the tokens issued."""
        user.last_login = datetime.utcnow()
        # Logged when the tokens are issued, i.e. once the second factor is checked.
        db.add(
            audit_entry(
                tenant_id=user.tenant_id,
                user_id=user.id,
                table_name="users",
                record_id=user.id,
                action="login",
                details={"name": user.full_name, "matricule": user.matricule},
                request=request,
            )
        )
        await db.commit()

        token_data = {
            "sub": str(user.id),
            "tenant_id": str(user.tenant_id),
            "role": role.code,
            "matricule": user.matricule,
        }
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "matricule": user.matricule,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "full_name": user.full_name,
                "role": role.code,
                "role_label": role.label,
                "tenant_id": str(user.tenant_id),
                "org_unit_id": str(user.org_unit_id) if user.org_unit_id else None,
                "must_change_password": bool(user.must_change_password),
            },
        }

    @staticmethod
    async def _raise_if_locked(redis, user_id) -> None:
        remaining = await redis.ttl(f"lock:{user_id}")
        # -2: no lock. -1 (no expiry) cannot be set by this service; treated as a full lock.
        if remaining == -2:
            return
        lock_seconds = settings.AUTH_LOCKOUT_SECONDS
        raise AccountLockedError(
            retry_after=remaining if remaining > 0 else lock_seconds,
            failures=settings.AUTH_OTP_MAX_FAILURES,
            lock_seconds=lock_seconds,
        )

    async def _open_enrolment(
        self, db: AsyncSession, redis, user: User, request: Optional[Request]
    ) -> Dict[str, Any]:
        """The role must use the app and none is confirmed: enrolment, no token."""
        token = secrets.token_urlsafe(32)
        await redis.setex(
            f"{ENROL_PREFIX}{token}", TOTP_ENROLMENT_SECONDS, str(user.id)
        )
        db.add(
            audit_entry(
                tenant_id=user.tenant_id,
                user_id=user.id,
                table_name="users",
                record_id=user.id,
                action="totp_enrolment_required",
                details={"name": user.full_name, "matricule": user.matricule},
                request=request,
            )
        )
        await db.commit()
        return {
            "status": ENROLMENT_REQUIRED,
            "enrolment_token": token,
            "expires_in": TOTP_ENROLMENT_SECONDS,
            "message": "Register an authenticator app to finish signing in",
        }

    async def _enrolment_user(self, db: AsyncSession, redis, token: str) -> tuple:
        user_id_str = await redis.get(f"{ENROL_PREFIX}{token}")
        if not user_id_str:
            raise AuthenticationError("Invalid or expired enrolment")
        user_id = UUID(user_id_str)
        await self._raise_if_locked(redis, user_id)
        user = await db.get(User, user_id)
        if user is None or not user.is_active:
            raise AuthenticationError("Invalid or expired enrolment")
        role = (
            await db.execute(select(Role).where(Role.id == user.role_id))
        ).scalar_one()
        return user, role

    async def start_enrolment(self, db: AsyncSession, token: str) -> Dict[str, str]:
        """Secret for the forced enrolment. The token already proves the password
        and the e-mail code, both checked less than TOTP_ENROLMENT_SECONDS ago."""
        redis = await get_redis()
        user, _ = await self._enrolment_user(db, redis, token)
        try:
            secret, uri = await totp.begin_enrolment(db, user)
        except ValueError as exc:
            # Confirmed meanwhile (another tab): the normal login now applies.
            raise AuthenticationError("Invalid or expired enrolment") from exc
        return {"secret": secret, "otpauth_uri": uri}

    async def confirm_enrolment(
        self,
        db: AsyncSession,
        token: str,
        code: str,
        request: Optional[Request] = None,
    ) -> Optional[Dict[str, Any]]:
        """First app code: the app is confirmed and the login ends with tokens.
        None when the code is wrong (the token stays valid until it expires)."""
        redis = await get_redis()
        user, role = await self._enrolment_user(db, redis, token)
        if not await totp.consume(db, user.id, code, confirming=True):
            return None
        await redis.delete(f"{ENROL_PREFIX}{token}")
        db.add(
            audit_entry(
                tenant_id=user.tenant_id,
                user_id=user.id,
                table_name="users",
                record_id=user.id,
                action="totp_enrolled",
                details={"name": user.full_name, "matricule": user.matricule},
                request=request,
            )
        )
        await db.commit()
        await otp_delivery.notify_totp_event(user, "enrolled")
        return await self._issue_tokens(db, user, role, request)

    async def _record_otp_failure(
        self,
        db: AsyncSession,
        redis,
        user_id,
        otp_key: str,
        session_key: str,
        request: Optional[Request] = None,
        *,
        holder_notice: bool = False,
    ) -> None:
        """Count a wrong OTP; at the limit, lock the account, end the session and audit it.
        ``holder_notice``: wrong app codes, the holder is told by e-mail."""
        max_failures = settings.AUTH_OTP_MAX_FAILURES
        lock_seconds = settings.AUTH_LOCKOUT_SECONDS
        fail_key = f"otp_fail:{user_id}"
        async with redis.pipeline(transaction=True) as pipe:
            pipe.incr(fail_key)
            pipe.expire(fail_key, lock_seconds)
            failures, _ = await pipe.execute()
        if failures < max_failures:
            return

        # SET NX: two wrong codes racing at the limit lock (and audit) only once.
        locked_now = await redis.set(f"lock:{user_id}", "1", ex=lock_seconds, nx=True)
        await redis.delete(otp_key, session_key, fail_key)
        if locked_now:
            user = await db.get(User, user_id)
            if user is not None:
                db.add(
                    audit_entry(
                        tenant_id=user.tenant_id,
                        user_id=user.id,
                        table_name="users",
                        record_id=user.id,
                        action="account_locked",
                        details={"failures": failures, "lock_seconds": lock_seconds},
                        request=request,
                    )
                )
                await db.commit()
                if holder_notice:
                    await otp_delivery.notify_totp_event(user, "locked")
        await self._raise_if_locked(redis, user_id)

    async def refresh_access_token(self, refresh_token: str) -> Dict[str, str]:
        """
        Refresh access token using refresh token.
        Returns a rotated refresh token so the frontend contract stays coherent.
        """
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise AuthenticationError("Invalid refresh token")
        # Issued before the account's sessions were revoked (app reset).
        if await session_revocation.is_revoked(await get_redis(), payload):
            raise AuthenticationError("Invalid refresh token")

        token_data = {
            "sub": payload["sub"],
            "tenant_id": payload["tenant_id"],
            "role": payload["role"],
            "matricule": payload["matricule"],
        }
        new_access_token = create_access_token(token_data)
        new_refresh_token = create_refresh_token(token_data)

        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
        }

    async def logout(self, access_token: str) -> Dict[str, str]:
        """
        Logout user by blacklisting the access token in Redis.
        The token is stored with its remaining TTL so it auto-expires.
        """
        payload = decode_token(access_token)
        if not payload:
            return {"message": "Logged out successfully"}

        exp = payload.get("exp")
        if exp:
            remaining = int(exp - datetime.utcnow().timestamp())
            if remaining > 0:
                redis = await get_redis()
                await redis.setex(f"blacklist:{access_token}", remaining, "1")

        return {"message": "Logged out successfully"}
