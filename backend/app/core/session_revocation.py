"""Revoke every session of one account at once (post-rc1 lot 4, DEC-2026-004).

Used when an authenticator app is reset (lost or stolen phone): the tokens
already issued, refresh tokens included, must stop working.

Each JWT carries ``iat_ms``, its issue time in milliseconds. Revoking writes the
current time to Redis under ``sessions_revoked:<user_id>``, kept as long as a
refresh token can live. A token issued at or before that time is refused, access
and refresh alike. A token without ``iat_ms`` (issued before this change) counts
as issued at 0, so it is refused too once the account has been revoked.
"""

import time
from typing import Any, Mapping

from app.core.config import settings


def _key(user_id: Any) -> str:
    return f"sessions_revoked:{user_id}"


def now_ms() -> int:
    return int(time.time() * 1000)


async def revoke_all(redis: Any, user_id: Any) -> None:
    """Refuse every token of ``user_id`` issued up to now."""
    ttl = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
    await redis.setex(_key(user_id), ttl, str(now_ms()))


async def is_revoked(redis: Any, payload: Mapping[str, Any]) -> bool:
    """True when the token was issued before its account's sessions were revoked."""
    user_id = payload.get("sub")
    if not user_id:
        return False
    revoked_at = await redis.get(_key(user_id))
    if revoked_at is None:
        return False
    try:
        issued_at = int(payload.get("iat_ms") or 0)
    except (TypeError, ValueError):
        issued_at = 0
    return issued_at <= int(revoked_at)
