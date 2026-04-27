# backend/app/services/gedrules_listeners.py
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import async_session_maker
from app.core.events.dispatcher import dispatcher
from app.models.document import Document
from app.services.gedrules_service import ApplyRoutingRulesToDocumentUseCase

logger = logging.getLogger(__name__)


@asynccontextmanager
async def _get_session():
    """
    Context manager qui ouvre une nouvelle session dédiée.
    Le listener est responsable de son propre cycle de vie de transaction.
    """
    async with async_session_maker() as db:
        yield db


async def _run_routing(db: AsyncSession, document_id: UUID) -> None:
    """Applique le routage GEDRules sur le document identifié."""
    stmt = select(Document).where(Document.id == document_id)
    result = await db.execute(stmt)
    document = result.scalar_one_or_none()

    if not document:
        logger.warning(
            "[GEDRules Listener] Document %s non trouvé pour le routage.", document_id
        )
        return

    use_case = ApplyRoutingRulesToDocumentUseCase(db)
    success, message = await use_case.execute(document)

    if success:
        await db.commit()
        logger.info(
            "[GEDRules Listener] Routage appliqué au doc %s : %s", document_id, message
        )
    else:
        logger.info(
            "[GEDRules Listener] Pas de routage pour le doc %s : %s",
            document_id,
            message,
        )


async def on_document_created(payload: Dict[str, Any]):
    """
    Listener déclenché lors de la création d'un document.
    Le listener ouvre toujours sa propre session dédiée.
    """
    document_id_str = payload.get("document_id")
    if not document_id_str:
        return

    try:
        document_id = UUID(document_id_str)
        async with _get_session() as db:
            await _run_routing(db, document_id)

    except Exception as e:
        logger.error(
            "[GEDRules Listener] Échec critique lors du routage du doc %s : %s",
            document_id_str,
            e,
            exc_info=True,
        )


def register_gedrules_listeners():
    """Enregistre le listener au sein du dispatcher global."""
    dispatcher.subscribe("DOCUMENT_CREATED", on_document_created)
