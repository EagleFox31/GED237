# backend/app/core/rate_limit.py
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def rate_limit_by_user_or_ip(request: Request) -> str:
    """
    Prefer authenticated user identity when available, fallback to client IP.
    This keeps policy mutation limits user-scoped while remaining resilient
    for unauthenticated/testing contexts.
    """
    user_id = getattr(request.state, "auth_user_id", None)
    if user_id:
        return f"user:{user_id}"
    return get_remote_address(request)


limiter = Limiter(key_func=get_remote_address)
