"""Authenticator app codes (TOTP, RFC 6238): post-rc1 lot 4.

HMAC-SHA1, 6 digits, 30-second steps: the defaults every authenticator app
reads from an ``otpauth://`` link. Written on the standard library (no new
dependency before 30/11); the RFC 6238 test vectors pin the arithmetic.

A code is accepted for the current step and one step either side (clock drift
of the phone), and only once: ``last_used_step`` moves forward atomically, so
the same code, or an older one, is refused afterwards.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
import uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote, urlencode

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from fastapi import Request
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import session_revocation
from app.core.config import settings
from app.core.redis import get_redis
from app.models.audit import AuditLog
from app.models.role import Role
from app.models.user import User
from app.models.user_totp import UserTotp
from app.services import otp_delivery
from app.services.audit_trail import audit_entry

SUPER_ADMIN = "super_admin"
TENANT_ADMIN = "tenant_admin"
# Shown when the server runs without the app (AUTH_TOTP_ENABLED false).
DISABLED_MESSAGE = "L'application d'authentification n'est pas activée sur ce serveur."
# Where a reset came from, kept in its audit entry.
VIA_APP = "app"
VIA_OPS_SCRIPT = "ops-script"

STEP_SECONDS = 30
DIGITS = 6
# Steps accepted either side of the server's: one is the usual allowance.
DRIFT_STEPS = 1
SECRET_BYTES = 20  # 160 bits, the RFC 4226 recommendation


def _now() -> float:
    return time.time()


def current_step(now: Optional[float] = None) -> int:
    return int((_now() if now is None else now) // STEP_SECONDS)


def generate_secret() -> str:
    """Base32 secret, without padding, as authenticator apps expect it."""
    return base64.b32encode(secrets.token_bytes(SECRET_BYTES)).decode().rstrip("=")


def _key(secret: str) -> bytes:
    padded = secret.upper() + "=" * (-len(secret) % 8)
    return base64.b32decode(padded)


def code_at(secret: str, step: int, digits: int = DIGITS) -> str:
    digest = hmac.new(_key(secret), struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % 10**digits).zfill(digits)


def matching_step(secret: str, code: str, now: Optional[float] = None) -> Optional[int]:
    """Step whose code is ``code`` within the drift allowance, or None."""
    if len(code) != DIGITS or not (code.isascii() and code.isdigit()):
        return None
    step = current_step(now)
    found = None
    # Every candidate is computed: the time taken does not tell which one matched.
    for candidate in range(step - DRIFT_STEPS, step + DRIFT_STEPS + 1):
        if hmac.compare_digest(code_at(secret, candidate), code):
            found = candidate
    return found


def provisioning_uri(secret: str, account: str) -> str:
    issuer = settings.AUTH_TOTP_ISSUER
    query = urlencode(
        {
            "secret": secret,
            "issuer": issuer,
            "algorithm": "SHA1",
            "digits": DIGITS,
            "period": STEP_SECONDS,
        }
    )
    return f"otpauth://totp/{quote(issuer)}:{quote(account)}?{query}"


def _fernet() -> MultiFernet:
    """TOTP_ENCRYPTION_KEYS (first encrypts, all decrypt), kept apart from SECRET_KEY.

    Unset: a key derived from SECRET_KEY, for development and tests only
    (get_settings refuses it in production when the app is enabled)."""
    keys = settings.totp_encryption_keys
    if keys:
        return MultiFernet([Fernet(key) for key in keys])
    # Derived, not reused: SECRET_KEY also signs the tokens.
    derived = hashlib.sha256(f"totp-secret:{settings.SECRET_KEY}".encode()).digest()
    return MultiFernet([Fernet(base64.urlsafe_b64encode(derived))])


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_secret(token: str) -> Optional[str]:
    """None when no configured key opens it: the app must be enrolled again."""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return None


async def get_record(db: AsyncSession, user_id: uuid.UUID) -> Optional[UserTotp]:
    return await db.get(UserTotp, user_id)


async def is_active_for(db: AsyncSession, user_id: uuid.UUID) -> bool:
    """The login asks for the app code: setting on and the app confirmed."""
    if not settings.AUTH_TOTP_ENABLED:
        return False
    found = await db.execute(
        select(UserTotp.user_id).where(
            UserTotp.user_id == user_id, UserTotp.confirmed_at.is_not(None)
        )
    )
    return found.scalar_one_or_none() is not None


async def consume(
    db: AsyncSession,
    user_id: uuid.UUID,
    code: str,
    *,
    confirming: bool = False,
) -> bool:
    """Accept ``code`` once. ``confirming`` checks the not-yet-confirmed app instead."""
    record = await get_record(db, user_id)
    if record is None or (record.confirmed_at is None) != confirming:
        return False
    secret = decrypt_secret(record.secret_encrypted)
    step = matching_step(secret, code) if secret else None
    if step is None:
        return False
    # Re-encrypted under the first key: a rotation completes as accounts log in.
    rotated = _fernet().rotate(record.secret_encrypted.encode()).decode()
    values = {"last_used_step": step, "secret_encrypted": rotated}
    if confirming:
        values["confirmed_at"] = datetime.now(timezone.utc)
    # Compare-and-set: two requests with the same code, only one moves the step.
    moved = await db.execute(
        update(UserTotp)
        .where(
            UserTotp.user_id == user_id,
            or_(UserTotp.last_used_step.is_(None), UserTotp.last_used_step < step),
        )
        .values(**values)
        .returning(UserTotp.user_id)
        .execution_options(synchronize_session=False)
    )
    accepted = moved.scalar_one_or_none() is not None
    await db.commit()
    return accepted


def required_for(role_code: Optional[str]) -> bool:
    """The role must use the app (DEC-2026-004): never while the app is off."""
    return (
        settings.AUTH_TOTP_ENABLED and (role_code or "") in settings.totp_required_roles
    )


async def role_code_needing_email(
    db: AsyncSession, role_id: Optional[int]
) -> Optional[str]:
    """The role's code when it must use the app, else None.

    Such an account reaches enrolment only after the e-mail code, so it needs an
    address: without one it could never sign in."""
    if role_id is None:
        return None
    code = (
        await db.execute(select(Role.code).where(Role.id == role_id))
    ).scalar_one_or_none()
    return code if required_for(code) else None


async def required_without_email(db: AsyncSession) -> list[User]:
    """Active accounts of a role that must use the app, without an e-mail address.

    Listed whether the app is on or not: they must be fixed before it is."""
    found = await db.execute(
        select(User)
        .options(selectinload(User.role), selectinload(User.tenant))
        .join(Role, Role.id == User.role_id)
        .where(
            Role.code.in_(sorted(settings.totp_required_roles)),
            User.is_active.is_(True),
            or_(User.email.is_(None), User.email == ""),
        )
        .order_by(User.matricule)
    )
    return list(found.scalars().all())


async def begin_enrolment(db: AsyncSession, user: User) -> tuple[str, str]:
    """New secret for ``user``, unconfirmed until a first code. Returns the secret
    and its otpauth link. ValueError when an app is already confirmed."""
    record = await get_record(db, user.id)
    if record is not None and record.confirmed_at is not None:
        raise ValueError("app already confirmed")
    secret = generate_secret()
    if record is None:
        record = UserTotp(user_id=user.id, tenant_id=user.tenant_id)
        db.add(record)
    record.secret_encrypted = encrypt_secret(secret)
    record.last_used_step = None
    await db.commit()
    return secret, provisioning_uri(secret, user.email or user.matricule)


def reset_allowed(
    *,
    actor_id: uuid.UUID,
    actor_role: Optional[str],
    actor_tenant: Optional[uuid.UUID],
    target_id: uuid.UUID,
    target_role: Optional[str],
    target_tenant: Optional[uuid.UUID],
) -> bool:
    """Who may reset whose app (DEC-2026-004): a superior, never oneself.

    A super_admin resets super_admin and tenant_admin accounts of every
    institution, never an agent; an agent is reset by a tenant_admin of its own
    institution only."""
    if str(actor_id) == str(target_id):
        return False
    if actor_role == SUPER_ADMIN:
        return target_role in (SUPER_ADMIN, TENANT_ADMIN)
    if actor_role == TENANT_ADMIN:
        return str(actor_tenant) == str(target_tenant) and target_role not in (
            TENANT_ADMIN,
            SUPER_ADMIN,
        )
    return False


async def reset(
    db: AsyncSession,
    target: User,
    *,
    actor: User,
    via: str = VIA_APP,
    request: Optional[Request] = None,
) -> bool:
    """Remove ``target``'s app after an in-person check. False: nothing to reset.

    ``actor`` is the superior who did it, in the application or, ``via`` the ops
    script, the super_admin it names. Revokes every session of the account,
    audited, then the holder is told by e-mail."""
    record = await get_record(db, target.id)
    if record is None:
        return False
    await db.delete(record)
    # Lost or stolen phone: every open session goes, refresh tokens included.
    # Before the commit: if Redis fails, nothing is reset and the caller retries.
    await session_revocation.revoke_all(await get_redis(), target.id)
    db.add(
        audit_entry(
            tenant_id=target.tenant_id,
            user_id=actor.id,
            table_name="users",
            record_id=target.id,
            action="totp_reset",
            details={
                "name": target.full_name,
                "matricule": target.matricule,
                "by": actor.matricule,
                "via": via,
                # Break-glass only (ops script): the app never lets one reset oneself.
                "self": actor.id == target.id,
                "sessions_revoked": True,
            },
            request=request,
        )
    )
    await db.commit()
    await otp_delivery.notify_totp_event(target, "reset")
    return True


async def count_super_admins_with_app(db: AsyncSession) -> int:
    """Active super_admin accounts with a confirmed app: fewer than two leaves
    nobody to reset the last one but the ops script."""
    found = await db.execute(
        select(func.count())
        .select_from(UserTotp)
        .join(User, User.id == UserTotp.user_id)
        .join(Role, Role.id == User.role_id)
        .where(
            Role.code == SUPER_ADMIN,
            User.is_active.is_(True),
            UserTotp.confirmed_at.is_not(None),
        )
    )
    return int(found.scalar_one())


# Changes to the app the holder is told about at the next login (DEC-2026-004).
NOTICE_ACTIONS = ("totp_enrolled", "totp_disabled", "totp_reset")
MAX_NOTICES = 20


async def notices_since(
    db: AsyncSession, user_id: uuid.UUID, since: Optional[datetime]
) -> list[dict]:
    """App added, removed or reset on the account after ``since`` (its previous
    login; None: never logged in), newest first, read from the audit log."""
    query = (
        select(AuditLog.action, AuditLog.created_at, AuditLog.user_id)
        .where(
            AuditLog.table_name == "users",
            AuditLog.record_id == user_id,
            AuditLog.action.in_(NOTICE_ACTIONS),
        )
        .order_by(AuditLog.created_at.desc())
        .limit(MAX_NOTICES)
    )
    if since is not None:
        query = query.where(AuditLog.created_at > since)
    return [
        {"event": action, "at": at, "by_self": actor == user_id}
        for action, at, actor in (await db.execute(query)).all()
    ]
