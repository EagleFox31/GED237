import logging
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.notifications import realtime
from app.services.notifications.base import INotifier
from app.models.notification import Notification

logger = logging.getLogger(__name__)


class InAppNotifier(INotifier):
    """
    Persists notifications in the database to be retrieved by the frontend (Bell icon/Dropdown).
    """

    async def send(
        self,
        user_id: str,
        tenant_id: str,
        event_type: str,
        message: str,
        meta_data: Dict[str, Any] = None,
        session: AsyncSession = None,
    ) -> bool:
        if not session:
            # In-App notifier absolutely requires a DB session to persist
            return False

        try:
            notification = Notification(
                user_id=user_id,
                tenant_id=tenant_id,
                event_type=event_type,
                message=message,
                channel="in_app",
                meta_data=meta_data or {},
            )
            session.add(notification)
            # The commit should ideally be handled by the caller, but if isolated:
            await session.commit()
        except Exception as e:
            print(f"[InAppNotifier] Error saving notification: {e}")
            if session:
                await session.rollback()
            return False

        # After the commit only: a pushed notification always exists in the list.
        if settings.NOTIFICATIONS_BROADCAST_MODE != "off":
            try:
                await session.refresh(notification)
                await realtime.push_notification(notification)
            except Exception:
                logger.warning("Notification saved but not pushed", exc_info=True)
        return True
