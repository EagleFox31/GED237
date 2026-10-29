# backend/app/core/events/dispatcher.py
from collections import defaultdict
from typing import Callable, Dict, List, Any
import asyncio
import logging

logger = logging.getLogger(__name__)


class EventDispatcher:
    """
    In-memory blocking async event dispatcher.

    COMPORTEMENT ASSUMÉ :
    - dispatch() est bloquant : le caller (endpoint HTTP) attend la fin
      de tous les listeners avant de continuer.
    - Les listeners s'exécutent de manière CONCURRENTE via asyncio.gather,
      pas séquentiellement.
    - Les erreurs individuelles sont isolées et loggées sans interrompre
      les autres listeners.

    CONSÉQUENCE ARCHITECTURALE :
    Ce dispatcher n'est PAS une implémentation BASE/eventual consistency.
    L'upload de document attend GEDRules, les notifications, et tout autre
    listener enregistré. C'est un compromis délibéré : la consistance
    immédiate est préférée à la disponibilité maximale du endpoint, car
    DOCUMENT_CREATED doit avoir créé les WorkflowSteps avant que le
    frontend ne les interroge.

    SI tu veux des side-effects non-bloquants (ex. notifications email),
    la bonne séparation est :
      - events critiques  → dispatch() tel quel (bloquant, awaité)
      - events side-effect → broker externe (Redis pub/sub, Celery, etc.)

    AVERTISSEMENT SESSION :
    Plusieurs listeners d'un même événement NE DOIVENT PAS partager
    la même AsyncSession SQLAlchemy : asyncio.gather() les exécute
    concurremment et SQLAlchemy async n'est pas thread/task-safe sur
    une session partagée.
    """

    def __init__(self):
        self._listeners: Dict[str, List[Callable]] = defaultdict(list)

    def subscribe(self, event_type: str, listener: Callable) -> None:
        """Enregistre un callback pour un type d'événement."""
        if listener not in self._listeners[event_type]:
            self._listeners[event_type].append(listener)

    def unsubscribe(self, event_type: str, listener: Callable) -> None:
        """Retire un callback d'un type d'événement."""
        if listener in self._listeners[event_type]:
            self._listeners[event_type].remove(listener)

    async def dispatch(self, event_type: str, payload: Dict[str, Any]) -> None:
        """
        Déclenche tous les callbacks enregistrés pour event_type.

        Les listeners s'exécutent concurremment (asyncio.gather).
        Le caller est bloqué jusqu'à la fin de tous les listeners.
        Chaque listener est isolé dans _safe_call : une exception
        individuelle est loggée sans annuler les autres.
        """
        listeners = self._listeners.get(event_type, [])
        if not listeners:
            return

        async def _safe_call(listener: Callable) -> None:
            try:
                await listener(payload)
            except Exception as exc:
                logger.error(
                    "[EventDispatcher] Listener %s failed for event %s: %s",
                    getattr(listener, "__name__", repr(listener)),
                    event_type,
                    exc,
                    exc_info=True,
                )

        await asyncio.gather(*(_safe_call(listener) for listener in listeners))


# Global Singleton Dispatcher
dispatcher = EventDispatcher()
