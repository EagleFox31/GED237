from abc import ABC, abstractmethod
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession


class INotifier(ABC):
    """
    Abstract interface for all notification channels (In-App, Email, SMS).
    """

    @abstractmethod
    async def send(
        self,
        user_id: str,
        tenant_id: str,
        event_type: str,
        message: str,
        meta_data: Dict[str, Any] = None,
        session: AsyncSession = None,
    ) -> bool:
        """
        Send a notification to a specific user.
        """
        pass
