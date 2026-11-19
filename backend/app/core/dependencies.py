# backend/app/core/dependencies.py
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID
from app.core.database import get_db, AsyncSessionLocal
from app.core.security import decode_token, revoked_session_key
from app.core.redis import get_redis
from app.models.user import User

security = HTTPBearer()


async def is_revoked(redis_client, token: str, payload: dict) -> bool:
    """Revoked by a logout: this very token, or the login session it belongs to."""
    if await redis_client.get(f"blacklist:{token}"):
        return True
    session_id = payload.get("sid")
    return bool(session_id and await redis_client.get(revoked_session_key(session_id)))


async def _access_payload(token: str) -> dict:
    """Claims of a valid access token, not revoked; 401 otherwise."""
    payload = decode_token(token)

    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if await is_revoked(await get_redis(), token, payload):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Extract and validate user ID from JWT token, reject blacklisted tokens."""
    payload = await _access_payload(credentials.credentials)

    user_id: str = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    return user_id


async def get_current_tenant_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Extract tenant ID from JWT token (same checks as get_current_user_id)."""
    payload = await _access_payload(credentials.credentials)

    tenant_id: str = payload.get("tenant_id")
    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenant context in token",
        )

    return tenant_id


async def get_current_user(
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve and validate the authenticated user from JWT payload."""
    try:
        user_uuid = UUID(user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        ) from exc

    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == user_uuid, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    if request is not None:
        request.state.auth_user_id = str(user.id)
    return user


async def get_current_user_ws(token: str) -> Optional[User]:
    """Authenticate a WebSocket connection from a raw token string.

    Same rules as the HTTP routes: an access token, not revoked by a logout.
    """
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        return None

    if await is_revoked(await get_redis(), token, payload):
        return None

    user_id_str: str = payload.get("sub")
    if user_id_str is None:
        return None

    try:
        user_uuid = UUID(user_id_str)
    except ValueError:
        return None

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.id == user_uuid, User.is_active.is_(True))
        )
        return result.scalar_one_or_none()


# Dependency aliases
GetDB = Depends(get_db)
GetRedis = Depends(get_redis)
GetCurrentUserId = Depends(get_current_user_id)
GetCurrentTenantId = Depends(get_current_tenant_id)
GetCurrentUser = Depends(get_current_user)
