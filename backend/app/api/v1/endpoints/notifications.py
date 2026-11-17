from typing import Any
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_user_ws
from app.models.user import User
from app.models.notification import Notification
from app.services.notifications.realtime import (
    ConnectionManager,
    manager,
    serialize_notification,
)

__all__ = ["ConnectionManager", "manager", "router"]

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """
    WebSocket endpoint for real-time notifications.
    Client passes ?token=... for authentication.
    """
    # 1. Authenticate user from token
    user = await get_current_user_ws(token)
    if not user:
        await websocket.close(code=1008)
        return

    user_id = str(user.id)
    await manager.connect(websocket, user_id)

    try:
        while True:
            # We just keep connection open, optionally reading ping/pong
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
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
