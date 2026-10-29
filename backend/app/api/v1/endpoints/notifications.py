from typing import Any, List, Dict
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_user_ws
from app.models.user import User
from app.models.notification import Notification

router = APIRouter()


# Simple In-Memory Connection Manager for WebSockets
class ConnectionManager:
    def __init__(self):
        # Maps user_id strings to a list of active WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if len(self.active_connections[user_id]) == 0:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_json(message)


manager = ConnectionManager()


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

    # We return dictionaries to avoid Pydantic Model creation for simplicity here,
    # or you could define a Document schema
    return [
        {
            "id": str(n.id),
            "event_type": n.event_type,
            "message": n.message,
            "is_read": n.is_read,
            "meta_data": n.meta_data,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifications
    ]


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
