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

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user_totp import UserTotp

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


def _fernet() -> Fernet:
    # Derived, not reused: SECRET_KEY also signs the tokens.
    derived = hashlib.sha256(f"totp-secret:{settings.SECRET_KEY}".encode()).digest()
    return Fernet(base64.urlsafe_b64encode(derived))


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_secret(token: str) -> Optional[str]:
    """None when SECRET_KEY changed since enrolment: the app must be enrolled again."""
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
    values = {"last_used_step": step}
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
