# backend/app/core/rate_limit.py
from fastapi import Request
from slowapi import Limiter

from app.core.config import settings


def client_ip(request: Request) -> str:
    """Rate-limit key: the client IP.

    X-Forwarded-For is honoured only when ``TRUSTED_PROXY`` is set, i.e. the
    API sits behind a reverse proxy that overwrites the header. Without the
    flag a client could forge the header and rotate its own counter.
    """
    if settings.TRUSTED_PROXY:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            first = forwarded.split(",")[0].strip()
            if first:
                return first
    return request.client.host if request.client else "127.0.0.1"


def rate_limit_by_user_or_ip(request: Request) -> str:
    """
    Prefer authenticated user identity when available, fallback to client IP.
    This keeps policy mutation limits user-scoped while remaining resilient
    for unauthenticated/testing contexts.
    """
    user_id = getattr(request.state, "auth_user_id", None)
    if user_id:
        return f"user:{user_id}"
    return client_ip(request)


limiter = Limiter(key_func=client_ip)
