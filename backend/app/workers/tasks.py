"""
Celery tasks for document processing
Refactored to use OCR Strategy pattern with SRP
"""

import os
import asyncio
import logging
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from sqlalchemy.sql import func

from app.workers.celery_app import celery_app
from app.models.document import Document
from app.services.classification_rule_engine import ClassificationRuleEngine
from app.core.config import settings

logger = logging.getLogger(__name__)


# Async engine for database updates from the worker
async_engine = create_async_engine(
    settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"), echo=False
)
AsyncSessionLocal = sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False
)


async def update_document_ocr(
    document_id: str, text: str, confidence: float = None, engine_used: str = None
):
    """
    Update document with OCR results

    Single Responsibility: Database update only
    """
    from app.services import ocr_recovery

    async with AsyncSessionLocal() as session:
        document = await session.get(Document, document_id)
        if document:
            document.ocr_content = text

            # Index text in Postgres TSVECTOR
            document.ocr_content_vector = func.to_tsvector("french", text)

            # Store OCR metadata in extra_data. A new dict, not an in-place change: the
            # JSONB column is not change-tracked, so mutating it would never be written.
            # A finished OCR resets the delivery counter and the failure flag.
            ocr_recovery.reset_ocr_attempts(document)
            document.extra_data = {
                **(document.extra_data or {}),
                "ocr_confidence": confidence,
                "ocr_engine": engine_used,
            }

            await session.commit()

            # Rules with content keywords could not be checked before the text existed.
            # Separate transaction: a failing rule must never lose the OCR text or fail the task.
            try:
                await ClassificationRuleEngine(session).reclassify_after_ocr(document)
                await session.commit()
            except Exception:
                await session.rollback()
                logger.exception(
                    "Classification after OCR failed for document %s", document_id
                )

            # The review screen lists review rows, not statuses: open one for a document
            # still « à vérifier », close the one opened on upload if the rules classified it.
            from app.services.classification_review_service import (
                ClassificationReviewService,
            )

            try:
                await session.refresh(document)
                await ClassificationReviewService(
                    session
                ).sync_review_with_document_status(document=document)
                await session.commit()
            except Exception:
                await session.rollback()
                logger.exception(
                    "Review sync after OCR failed for document %s", document_id
                )


@celery_app.task(
    bind=True,
    name="app.workers.tasks.process_document_ocr",
    # Acked once the task ends, and requeued when its process dies (OOM kill): the job
    # is not lost with the worker. The sweep below covers what this cannot (LESSON-2026-060).
    acks_late=True,
    reject_on_worker_lost=True,
)
def process_document_ocr(self, document_id: str, file_path: str, file_type: str):
    """
    Process document OCR using intelligent strategy

    Single Responsibility: Orchestrate OCR processing

    Strategy:
    - Images → Auto-select between Tesseract/EasyOCR based on context
    - PDFs → Native extraction first, then OCR if needed
    - Fallback enabled for reliability
    """
    print(f"Starting OCR processing for document: {document_id}")
    print(f"  File: {file_path}")
    print(f"  Type: {file_type}")

    # 1. Resolve full path
    full_path = os.path.join(settings.STORAGE_PATH, file_path)

    if not os.path.exists(full_path):
        print(f"❌ File not found for OCR: {full_path}")
        return False

    # 1b. Own delivery cap, saved before the OCR: a document that kills the worker is
    # delivered again by the broker, and must stop being tried after N deliveries.
    if not _within_delivery_cap(document_id):
        return False

    # 2. Initialize OCR Strategy lazily so API/tests don't import heavy OCR deps at startup
    from app.services.ocr import OCRStrategy

    strategy = OCRStrategy()

    extracted_text = ""
    confidence = 0.0
    engine_used = "none"

    try:
        # 3. Process based on file type
        if file_type == "application/pdf":
            # PDF: Try native extraction first
            extracted_text, confidence = strategy.process_pdf(full_path)
            engine_used = "pypdf (native)"

        elif file_type and file_type.startswith("image/"):
            # Image: Use intelligent strategy
            result = strategy.process_image(
                full_path,
                document_type=None,  # Auto-detect
                try_fallback=True,  # Enable fallback
            )

            extracted_text = result.text
            confidence = result.confidence
            engine_used = result.engine_used

        else:
            print(f"❌ Unsupported file type for OCR: {file_type}")
            return False

        # 4. Update database if text was extracted
        if extracted_text and extracted_text.strip():
            # Run async database update
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            loop.run_until_complete(
                update_document_ocr(
                    document_id, extracted_text, confidence, engine_used
                )
            )

            # Log results
            print(f"✓ OCR completed successfully for {document_id}")
            print(f"  Engine: {engine_used}")
            print(f"  Extracted: {len(extracted_text)} characters")
            print(f"  Confidence: {confidence:.2%}")

            # Warn if confidence is low
            if confidence < 0.7:
                print("  ⚠️ WARNING: Low confidence. Manual review recommended.")

            return True

        else:
            print(f"❌ No text extracted for {document_id}")
            return False

    except Exception as e:
        print(f"❌ OCR processing failed for {document_id}: {e}")
        import traceback

        traceback.print_exc()
        _retry_or_give_up(self, e, document_id)
        return False


def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def _within_delivery_cap(document_id: str) -> bool:
    """Count this delivery; past the cap, mark the document failed and refuse the run."""
    from app.services import ocr_recovery

    try:
        count = _run_async(
            ocr_recovery.register_delivery(AsyncSessionLocal, document_id)
        )
        if ocr_recovery.delivery_cap_reached(count):
            _run_async(
                ocr_recovery.mark_failed(
                    AsyncSessionLocal,
                    document_id,
                    f"{settings.OCR_MAX_DELIVERIES} deliveries without a result",
                )
            )
            logger.error(
                "OCR refused for document %s: %s deliveries (cap %s)",
                document_id,
                count - 1,
                settings.OCR_MAX_DELIVERIES,
            )
            return False
    except Exception:
        # The counter must never block OCR on a database hiccup.
        logger.exception("OCR delivery counter failed for document %s", document_id)
    return True


def _retry_or_give_up(task, error: Exception, document_id: str) -> None:
    """Bounded retry with exponential backoff after an unexpected OCR error.

    No-op when the task is called directly (tests, scripts) or once the retries are
    spent: the sweep and the status of the document take over from there.
    """
    if task.request.called_directly:
        return
    max_retries = settings.OCR_TASK_MAX_RETRIES
    attempt = task.request.retries
    if attempt >= max_retries:
        logger.error(
            "OCR gave up on document %s after %s retries (%s)",
            document_id,
            attempt,
            type(error).__name__,
        )
        return
    countdown = settings.OCR_TASK_RETRY_BACKOFF_SECONDS * (2**attempt)
    raise task.retry(exc=error, countdown=countdown, max_retries=max_retries)


@celery_app.task(name="app.workers.tasks.requeue_stuck_ocr")
def requeue_stuck_ocr():
    """Beat task: send again the documents left without OCR text."""
    from app.services.ocr_recovery import recovery_enabled, requeue_stuck_documents

    if not recovery_enabled():
        return 0

    def _enqueue(document_id: str, file_path: str, mime_type: str) -> None:
        process_document_ocr.delay(document_id, file_path, mime_type)

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(requeue_stuck_documents(AsyncSessionLocal, _enqueue))


@celery_app.task(name="app.workers.tasks.watch_ingest_folders")
def watch_ingest_folders():
    """Beat task (lot 5): one locked pass over INGEST_WATCH_FOLDERS."""
    import redis.asyncio as aioredis

    from app.services.ingest_watch import run_watch_pass, watch_enabled

    if not watch_enabled():
        return None

    async def _run():
        client = aioredis.from_url(
            settings.REDIS_URL, encoding="utf-8", decode_responses=True
        )
        try:
            return await run_watch_pass(AsyncSessionLocal, client)
        finally:
            await client.aclose()

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    loop.run_until_complete(_run())
    return None


@celery_app.task(name="app.workers.tasks.purge_expired_trash")
def purge_expired_trash():
    """Beat task: purge documents trashed for more than TRASH_RETENTION_DAYS."""
    import redis.asyncio as aioredis

    from app.services.storage.factory import get_storage_service
    from app.services.trash_service import run_retention_pass

    if settings.TRASH_RETENTION_DAYS <= 0:
        return None

    async def _run():
        client = aioredis.from_url(
            settings.REDIS_URL, encoding="utf-8", decode_responses=True
        )
        try:
            return await run_retention_pass(
                AsyncSessionLocal,
                client,
                get_storage_service(),
                retention_days=settings.TRASH_RETENTION_DAYS,
                batch_size=settings.TRASH_PURGE_BATCH,
            )
        finally:
            await client.aclose()

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(_run())
