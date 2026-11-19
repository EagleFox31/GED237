"""Real-time delivery of in-app notifications to the WebSocket of their recipient.

``NOTIFICATIONS_BROADCAST_MODE``:

- ``off`` (default): nothing is pushed, the client reads the REST list;
- ``local``: pushed to the connections held by this process (single instance);
- ``redis``: published on a Redis channel; every instance runs a listener and
  pushes to its own connections, so a notification created on one instance
  reaches a browser connected to another one.

Delivery is best effort and never fails the caller: the database row is the source
of truth and the REST list catches up after a missed push.
"""

import asyncio
import json
import logging
from typing import Any, Optional

from starlette.websockets import WebSocket

from app.core.config import settings
from app.core.redis import get_redis
from app.models.notification import Notification

logger = logging.getLogger(__name__)

CHANNEL = "notifications:push"
LISTENER_RETRY_SECONDS = 5


def serialize_notification(notification: Notification) -> dict[str, Any]:
    """The shape of one item of ``GET /notifications/``, also pushed as is."""
    return {
        "id": str(notification.id),
        "event_type": notification.event_type,
        "message": notification.message,
        "is_read": bool(notification.is_read),
        "meta_data": notification.meta_data,
        "created_at": notification.created_at.isoformat(),
    }


class ConnectionManager:
    """Open WebSockets of this process, by user."""

    def __init__(self) -> None:
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        self.active_connections.setdefault(user_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        connections = self.active_connections.get(user_id)
        if not connections:
            return
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str) -> int:
        """Send to every connection of the user; a dead one is dropped, not fatal."""
        delivered = 0
        for connection in list(self.active_connections.get(user_id, [])):
            try:
                await connection.send_json(message)
                delivered += 1
            except Exception:
                logger.info("Notification socket of user %s dropped", user_id)
                self.disconnect(connection, user_id)
        return delivered


manager = ConnectionManager()


async def push(
    user_id: str,
    message: dict[str, Any],
    *,
    mode: Optional[str] = None,
    connections: Optional[ConnectionManager] = None,
    redis_client: Any = None,
) -> None:
    """Push one message to a user according to the mode. Never raises."""
    mode = mode or settings.NOTIFICATIONS_BROADCAST_MODE
    connections = connections or manager
    if mode == "off":
        return
    try:
        if mode == "redis":
            try:
                redis = redis_client or await get_redis()
                await redis.publish(
                    CHANNEL, json.dumps({"user_id": user_id, "message": message})
                )
                return
            except Exception:
                # Redis down: the browsers connected to this instance are still served.
                logger.warning(
                    "Notification publish failed, local delivery only", exc_info=True
                )
        await connections.send_personal_message(message, user_id)
    except Exception:
        logger.warning("Notification push failed", exc_info=True)


async def push_notification(notification: Notification) -> None:
    await push(str(notification.user_id), serialize_notification(notification))


async def forward(raw: Any, connections: Optional[ConnectionManager] = None) -> int:
    """Hand one published payload to the local connections; a bad payload is skipped."""
    try:
        payload = json.loads(raw)
        user_id, message = str(payload["user_id"]), payload["message"]
    except (TypeError, ValueError, KeyError):
        logger.warning("Ignored malformed notification payload")
        return 0
    return await (connections or manager).send_personal_message(message, user_id)


async def listen(
    redis_client: Any = None,
    connections: Optional[ConnectionManager] = None,
    *,
    retry_seconds: float = LISTENER_RETRY_SECONDS,
) -> None:
    """Forward published notifications to local connections until cancelled.

    Reconnects after a Redis failure; what was published meanwhile is not replayed.
    """
    while True:
        pubsub = None
        try:
            redis = redis_client or await get_redis()
            pubsub = redis.pubsub()
            await pubsub.subscribe(CHANNEL)
            async for item in pubsub.listen():
                if item.get("type") == "message":
                    await forward(item.get("data"), connections)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.warning(
                "Notification listener lost Redis, retrying in %ss",
                retry_seconds,
                exc_info=True,
            )
        finally:
            if pubsub is not None:
                try:
                    await pubsub.aclose()
                except Exception:
                    logger.debug("Notification pubsub close failed", exc_info=True)
        await asyncio.sleep(retry_seconds)


_listener_task: Optional[asyncio.Task] = None


async def start_listener() -> bool:
    """Start the Redis listener once, in ``redis`` mode only. True when started."""
    global _listener_task
    if settings.NOTIFICATIONS_BROADCAST_MODE != "redis":
        return False
    if _listener_task is not None and not _listener_task.done():
        return False
    _listener_task = asyncio.create_task(listen(), name="notifications-listener")
    return True


async def stop_listener() -> None:
    global _listener_task
    task, _listener_task = _listener_task, None
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    except Exception:
        logger.debug("Notification listener ended with an error", exc_info=True)
