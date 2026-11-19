"""Single-use, short-lived tickets to open the notifications WebSocket.

A browser cannot set an Authorization header on a WebSocket, so the JWT used to
travel in the URL (access logs, proxies, history). The client now asks for a ticket
over an authenticated HTTP call and opens the socket with ``?ticket=``: the ticket
is useless after one use or after TTL seconds, and is bound to one user and tenant.
It also carries the login session (``sid``) of the token that asked for it, so an
open socket is closed once that session is logged out.
"""

import secrets
from dataclasses import dataclass
from typing import Optional

from app.core.security import revoked_session_key

WS_TICKET_TTL_SECONDS = 30
_KEY_PREFIX = "ws_ticket:"


@dataclass(frozen=True)
class WsTicketOwner:
    user_id: str
    tenant_id: str
    session_id: str = ""


async def issue_ws_ticket(
    redis_client, *, user_id: str, tenant_id: str, session_id: str = ""
) -> str:
    ticket = secrets.token_urlsafe(32)
    await redis_client.set(
        f"{_KEY_PREFIX}{ticket}",
        f"{user_id}:{tenant_id}:{session_id}",
        ex=WS_TICKET_TTL_SECONDS,
    )
    return ticket


async def redeem_ws_ticket(redis_client, ticket: str) -> Optional[WsTicketOwner]:
    """Return the ticket's owner and burn it (GETDEL: atomic, one winner)."""
    if not ticket:
        return None
    value = await redis_client.getdel(f"{_KEY_PREFIX}{ticket}")
    if not value:
        return None
    if isinstance(value, bytes):
        value = value.decode()
    user_id, _, rest = value.partition(":")
    tenant_id, _, session_id = rest.partition(":")
    if not user_id or not tenant_id:
        return None
    return WsTicketOwner(user_id=user_id, tenant_id=tenant_id, session_id=session_id)


async def session_logged_out(redis_client, session_id: str) -> bool:
    """True once the login session behind the socket was ended by a logout."""
    return bool(session_id) and bool(
        await redis_client.exists(revoked_session_key(session_id))
    )
