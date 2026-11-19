import asyncio
import logging
from typing import Any
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_user_ws
from app.core.redis import get_redis
from app.models.user import User
from app.models.notification import Notification
from app.services.notifications.realtime import (
    ConnectionManager,
    manager,
    serialize_notification,
)
from app.services.ws_ticket import session_logged_out

__all__ = ["ConnectionManager", "manager", "router"]

logger = logging.getLogger(__name__)
router = APIRouter()

# How often an open socket checks that its login session was not logged out. Read
# from Redis, so a logout handled by another api process closes it too.
WS_SESSION_CHECK_SECONDS = 15.0
_LOGGED_OUT_CLOSE_CODE = 1008


async def _close_at_logout(websocket: WebSocket, session_id: str) -> None:
    while True:
        await asyncio.sleep(WS_SESSION_CHECK_SECONDS)
        try:
            ended = await session_logged_out(await get_redis(), session_id)
        except Exception:
            # Redis briefly away: keep the socket, check again next round.
            logger.warning("Notification socket: session check failed", exc_info=True)
            continue
        if ended:
            await websocket.close(code=_LOGGED_OUT_CLOSE_CODE)
            return


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, ticket: str = ""):
    """
    WebSocket endpoint for real-time notifications.
    Client passes ?ticket=... (from POST /auth/ws-ticket, single use, ~30 s).
    The socket is closed (1008) once the login session that asked for the ticket
    is logged out.
    """
    # 1. Authenticate user from the ticket
    authenticated = await get_current_user_ws(ticket)
    if not authenticated:
        await websocket.close(code=1008)
        return
    user, session_id = authenticated

    user_id = str(user.id)
    await manager.connect(websocket, user_id)
    watcher = (
        asyncio.create_task(_close_at_logout(websocket, session_id))
        if session_id
        else None
    )

    try:
        while True:
            # We just keep connection open, optionally reading ping/pong
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except RuntimeError:
        # Closed by the logout watcher between two reads: receive then refuses.
        if watcher is None or not watcher.done():
            raise
    finally:
        if watcher is not None:
            watcher.cancel()
        # Also on an abrupt close, so no dead socket stays registered.
        manager.disconnect(websocket, user_id)


@router.get("/")
async def get_notifications(
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get user notifications.
    """
    stmt = select(Notification).filter(Notification.user_id == current_user.id)

    if unread_only:
        stmt = stmt.filter(Notification.is_read.is_(False))

    stmt = stmt.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    notifications = result.scalars().all()

    # Same shape as the messages pushed on the WebSocket.
    return [serialize_notification(n) for n in notifications]


@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Mark a notification as read.
    """
    stmt = (
        update(Notification)
        .where(
            Notification.id == notification_id, Notification.user_id == current_user.id
        )
        .values(is_read=True)
    )

    await db.execute(stmt)
    await db.commit()
    return {"status": "success"}


@router.put("/read-all")
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> Any:
    """
    Mark all notifications as read.
    """
    stmt = (
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )

    await db.execute(stmt)
    await db.commit()
    return {"status": "success"}
