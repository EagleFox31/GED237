from datetime import datetime
from typing import Any, Dict
import re
import secrets
import unicodedata

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import AuthenticationError, NotFoundError
from app.core.redis import get_redis
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

        if not verify_password(password, user.password_hash):
            raise AuthenticationError("Invalid credentials")

        otp = generate_otp(6)
        session_token = secrets.token_urlsafe(32)

        redis = await get_redis()
        await redis.setex(f"otp:{session_token}", self.OTP_EXPIRY_SECONDS, otp)
        await redis.setex(
            f"session:{session_token}",
            self.SESSION_TOKEN_EXPIRY_SECONDS,
            str(user.id),
        )

        response = {
            "session_token": session_token,
            "message": "OTP sent to your registered contact",
            "expires_in": self.OTP_EXPIRY_SECONDS,
        }
        if settings.ENVIRONMENT == "development":
            response["otp"] = otp
        return response

    async def verify_otp(
        self,
        db: AsyncSession,
        session_token: str,
        otp: str,
    ) -> Dict[str, Any]:
        """Step 2: Verify OTP and generate JWT tokens."""
        redis = await get_redis()

        otp_key = f"otp:{session_token}"
        stored_otp = await redis.get(otp_key)
        if not stored_otp:
            raise AuthenticationError("Invalid or expired session")
        if stored_otp != otp:
            raise AuthenticationError("Invalid OTP")

        session_key = f"session:{session_token}"
        user_id_str = await redis.get(session_key)
        if not user_id_str:
            raise AuthenticationError("Session expired")

        from uuid import UUID

        user_id = UUID(user_id_str)
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError("User not found")

        result = await db.execute(select(Role).where(Role.id == user.role_id))
        role = result.scalar_one()

        user.last_login = datetime.utcnow()
        await db.commit()

        token_data = {
            "sub": str(user.id),
            "tenant_id": str(user.tenant_id),
            "role": role.code,
            "matricule": user.matricule,
        }
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        await redis.delete(otp_key, session_key)

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

    async def refresh_access_token(self, refresh_token: str) -> Dict[str, str]:
        """
        Refresh access token using refresh token.
        Returns a rotated refresh token so the frontend contract stays coherent.
        """
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
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
