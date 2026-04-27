from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.notifications.base import INotifier
from app.models.notification import Notification


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
            return True
        except Exception as e:
            print(f"[InAppNotifier] Error saving notification: {e}")
            if session:
                await session.rollback()
            return False
