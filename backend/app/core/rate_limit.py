# backend/app/core/rate_limit.py
from fastapi import Request
from slowapi import Limiter

from app.core.config import settings


def client_ip(request: Request) -> str:
    """Rate-limit key: the client IP.

    X-Forwarded-For is honoured only when ``TRUSTED_PROXY`` is set, i.e. the
    API sits behind one trusted reverse proxy. nginx's
    ``$proxy_add_x_forwarded_for`` *appends* the real peer address to any
    header the client sent, so only the LAST element is trustworthy; the
    earlier ones are client-controlled. Without the flag the header is
    ignored entirely, so a client cannot rotate its own counter.
    """
    if settings.TRUSTED_PROXY:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            last = forwarded.rsplit(",", 1)[-1].strip()
            if last:
                return last
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
