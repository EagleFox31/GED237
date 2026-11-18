"""Sweep of documents left without OCR text (worker killed, task lost).

A document is "stuck" when it is an image or a PDF, has no OCR text, is not in the
trash and is older than OCR_STUCK_MINUTES. It is sent to OCR again, at most
OCR_STUCK_MAX_REQUEUES times: a blank page legitimately ends with no text and must
not loop forever. The counter lives in documents.extra_data (no schema change).
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from sqlalchemy import and_, func, or_, select

from app.core.config import settings
from app.models.document import Document

logger = logging.getLogger(__name__)

REQUEUE_COUNT_KEY = "ocr_requeues"
REQUEUE_AT_KEY = "ocr_last_requeue_at"
DELIVERIES_KEY = "ocr_deliveries"
FAILED_KEY = "ocr_failed"
BATCH_SIZE = 50


def recovery_enabled() -> bool:
    return settings.OCR_STUCK_MINUTES > 0 and settings.OCR_STUCK_MAX_REQUEUES > 0


def _is_ocr_type(document: Document) -> bool:
    kind = document.mime_type or document.file_type or ""
    return kind.startswith("image/") or kind == "application/pdf"


async def register_delivery(session_factory, document_id: str) -> int:
    """Count one OCR delivery for the document and save it BEFORE the OCR runs.

    The count survives a killed worker: that is what makes the cap ours and not the
    broker's. Returns the new count (0 when the document does not exist).
    """
    async with session_factory() as session:
        document = await session.get(Document, document_id)
        if document is None:
            return 0
        extra = document.extra_data or {}
        count = int(extra.get(DELIVERIES_KEY) or 0) + 1
        # A new dict: the JSONB column is not change-tracked.
        document.extra_data = {**extra, DELIVERIES_KEY: count}
        await session.commit()
        return count


async def mark_failed(session_factory, document_id: str, reason: str) -> None:
    """Flag the document as failed: no OCR, no sweep, no more deliveries."""
    async with session_factory() as session:
        document = await session.get(Document, document_id)
        if document is None:
            return
        document.extra_data = {
            **(document.extra_data or {}),
            FAILED_KEY: {
                "reason": reason,
                "at": datetime.now(timezone.utc).isoformat(),
            },
        }
        await session.commit()


def delivery_cap_reached(count: int) -> bool:
    return settings.OCR_MAX_DELIVERIES > 0 and count > settings.OCR_MAX_DELIVERIES


def _due(document: Document, cutoff: datetime) -> bool:
    extra = document.extra_data or {}
    if extra.get(FAILED_KEY):
        return False  # failed for good: only an explicit retry may start it again
    if int(extra.get(REQUEUE_COUNT_KEY) or 0) >= settings.OCR_STUCK_MAX_REQUEUES:
        return False
    last = extra.get(REQUEUE_AT_KEY)
    if last:
        try:
            if datetime.fromisoformat(last) > cutoff:
                return False  # sent again recently: give it time
        except ValueError:
            pass
    return True


async def requeue_stuck_documents(
    session_factory,
    enqueue: Callable[[str, str, str], None],
    now: Optional[datetime] = None,
) -> int:
    """Send stuck documents to OCR again; return how many were requeued."""
    if not recovery_enabled():
        return 0
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=settings.OCR_STUCK_MINUTES)

    async with session_factory() as session:
        result = await session.execute(
            select(Document)
            .where(
                Document.deleted_at.is_(None),
                or_(
                    Document.ocr_content.is_(None),
                    func.length(Document.ocr_content) == 0,
                ),
                # created_at is a naive timestamp filled by the database clock: the
                # threshold is computed by the same clock, not by Python.
                Document.created_at
                < func.now() - timedelta(minutes=settings.OCR_STUCK_MINUTES),
                or_(
                    Document.mime_type.like("image/%"),
                    Document.mime_type == "application/pdf",
                    and_(
                        Document.mime_type.is_(None),
                        or_(
                            Document.file_type.like("image/%"),
                            Document.file_type == "application/pdf",
                        ),
                    ),
                ),
            )
            .order_by(Document.created_at)
            .limit(BATCH_SIZE * 4)
        )
        requeued = 0
        for document in result.scalars():
            if requeued >= BATCH_SIZE:
                break
            if not _is_ocr_type(document) or not _due(document, cutoff):
                continue
            extra = document.extra_data or {}
            # A new dict: the JSONB column is not change-tracked.
            document.extra_data = {
                **extra,
                REQUEUE_COUNT_KEY: int(extra.get(REQUEUE_COUNT_KEY) or 0) + 1,
                REQUEUE_AT_KEY: now.isoformat(),
            }
            enqueue(
                str(document.id),
                document.file_path,
                document.mime_type or document.file_type,
            )
            requeued += 1
        await session.commit()

    if requeued:
        logger.warning("OCR sweep: %s stuck document(s) sent again", requeued)
    return requeued
