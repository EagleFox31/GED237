# backend/app/core/observability/request_id.py
from contextvars import ContextVar, Token
from typing import Optional


_request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


def get_request_id() -> Optional[str]:
    return _request_id_ctx.get()


def set_request_id(request_id: Optional[str]) -> Token:
    return _request_id_ctx.set(request_id)


def reset_request_id(token: Token) -> None:
    _request_id_ctx.reset(token)
