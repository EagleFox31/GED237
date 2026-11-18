"""OCR robustness: task options, bounded retry, sweep of documents left without text."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.models.document import Document
from app.services import ocr_recovery
from app.workers import tasks
from app.workers.celery_app import celery_app


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- task options ------------------------------------------------------------


def test_ocr_task_is_acked_late_and_requeued_when_the_worker_dies():
    task = tasks.process_document_ocr
    assert task.acks_late is True
    assert task.reject_on_worker_lost is True


def test_sweep_is_scheduled_by_default_and_follows_the_interval():
    entry = celery_app.conf.beat_schedule["requeue-stuck-ocr"]
    assert entry["task"] == "app.workers.tasks.requeue_stuck_ocr"
    assert entry["schedule"] == float(settings.OCR_STUCK_SWEEP_INTERVAL_SECONDS)


def test_defaults_are_declared_for_compose_and_env_example():
    assert settings.OCR_STUCK_MINUTES == 15
    assert settings.OCR_STUCK_MAX_REQUEUES == 3
    assert settings.OCR_TASK_MAX_RETRIES == 2
    assert settings.OCR_MAX_DELIVERIES == 3


# --- bounded retry -----------------------------------------------------------


class _Request:
    def __init__(self, retries=0, called_directly=False):
        self.retries = retries
        self.called_directly = called_directly


class _Task:
    def __init__(self, retries=0, called_directly=False):
        self.request = _Request(retries, called_directly)
        self.retry_args = None

    def retry(self, exc, countdown, max_retries):
        self.retry_args = (countdown, max_retries)
        return RuntimeError("retry scheduled")


def test_retry_uses_exponential_backoff(monkeypatch):
    monkeypatch.setattr(settings, "OCR_TASK_RETRY_BACKOFF_SECONDS", 30)
    monkeypatch.setattr(settings, "OCR_TASK_MAX_RETRIES", 3)
    for attempt, expected in [(0, 30), (1, 60), (2, 120)]:
        task = _Task(retries=attempt)
        with pytest.raises(RuntimeError, match="retry scheduled"):
            tasks._retry_or_give_up(task, ValueError("x"), "doc")
        assert task.retry_args == (expected, settings.OCR_TASK_MAX_RETRIES)


def test_retry_stops_after_the_maximum(monkeypatch):
    monkeypatch.setattr(settings, "OCR_TASK_MAX_RETRIES", 3)
    task = _Task(retries=3)
    tasks._retry_or_give_up(task, ValueError("x"), "doc")  # no raise
    assert task.retry_args is None


def test_direct_call_never_retries():
    task = _Task(called_directly=True)
    tasks._retry_or_give_up(task, ValueError("x"), "doc")
    assert task.retry_args is None


def test_retries_can_be_switched_off(monkeypatch):
    monkeypatch.setattr(settings, "OCR_TASK_MAX_RETRIES", 0)
    task = _Task(retries=0)
    tasks._retry_or_give_up(task, ValueError("x"), "doc")
    assert task.retry_args is None


# --- sweep ------------------------------------------------------------------


def _doc(db_seed, *, age_minutes=60, mime="application/pdf", **kwargs):
    return Document(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        owner_id=db_seed["user_id"],
        title="Scan",
        file_path=f"t/u/{uuid.uuid4()}",
        file_type="pdf",
        mime_type=mime,
        file_size=1024,
        document_category_id=db_seed["category_id"],
        status="draft",
        created_at=_now().replace(tzinfo=None) - timedelta(minutes=age_minutes),
        **kwargs,
    )


async def _sweep(test_engine, docs):
    factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with factory() as session:
        session.add_all(docs)
        await session.commit()
    sent = []
    count = await ocr_recovery.requeue_stuck_documents(
        factory, lambda *args: sent.append(args), now=_now()
    )
    return count, sent, factory


@pytest.mark.asyncio
async def test_old_document_without_text_is_sent_again_and_counted(
    db_seed, test_engine
):
    doc = _doc(db_seed)
    count, sent, factory = await _sweep(test_engine, [doc])

    assert count == 1
    assert sent == [(str(doc.id), doc.file_path, "application/pdf")]
    async with factory() as session:
        stored = await session.get(Document, doc.id)
    assert stored.extra_data[ocr_recovery.REQUEUE_COUNT_KEY] == 1


@pytest.mark.asyncio
async def test_documents_that_must_not_be_touched_are_left_alone(db_seed, test_engine):
    docs = [
        _doc(db_seed, age_minutes=5),  # too recent: still in the queue
        _doc(db_seed, ocr_content="Texte lu"),  # already has text
        _doc(db_seed, deleted_at=_now()),  # in the trash
        _doc(db_seed, mime="application/zip"),  # no OCR for this type
    ]
    count, sent, _ = await _sweep(test_engine, docs)
    assert (count, sent) == (0, [])


@pytest.mark.asyncio
async def test_requeue_is_bounded_so_a_blank_page_does_not_loop(
    db_seed, test_engine, monkeypatch
):
    monkeypatch.setattr(settings, "OCR_STUCK_MAX_REQUEUES", 2)
    doc = _doc(db_seed, extra_data={ocr_recovery.REQUEUE_COUNT_KEY: 2})
    count, _, _ = await _sweep(test_engine, [doc])
    assert count == 0


@pytest.mark.asyncio
async def test_document_sent_again_recently_gets_time_to_finish(db_seed, test_engine):
    recent = (_now() - timedelta(minutes=3)).isoformat()
    doc = _doc(
        db_seed,
        extra_data={
            ocr_recovery.REQUEUE_COUNT_KEY: 1,
            ocr_recovery.REQUEUE_AT_KEY: recent,
        },
    )
    count, _, _ = await _sweep(test_engine, [doc])
    assert count == 0


@pytest.mark.asyncio
async def test_sweep_off_does_nothing(db_seed, test_engine, monkeypatch):
    monkeypatch.setattr(settings, "OCR_STUCK_MINUTES", 0)
    count, sent, _ = await _sweep(test_engine, [_doc(db_seed)])
    assert (count, sent) == (0, [])


# --- delivery cap of our own --------------------------------------------------


@pytest.mark.asyncio
async def test_deliveries_are_counted_and_saved_before_the_ocr(db_seed, test_engine):
    doc = _doc(db_seed)
    factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with factory() as session:
        session.add(doc)
        await session.commit()

    counts = [
        await ocr_recovery.register_delivery(factory, str(doc.id)) for _ in range(4)
    ]
    assert counts == [1, 2, 3, 4]
    assert [ocr_recovery.delivery_cap_reached(c) for c in counts] == [
        False,
        False,
        False,
        True,
    ]

    await ocr_recovery.mark_failed(factory, str(doc.id), "4 deliveries")
    async with factory() as session:
        stored = await session.get(Document, doc.id)
    assert stored.extra_data[ocr_recovery.DELIVERIES_KEY] == 4
    assert stored.extra_data[ocr_recovery.FAILED_KEY]["reason"] == "4 deliveries"


@pytest.mark.asyncio
async def test_failed_document_is_never_swept_again(db_seed, test_engine):
    doc = _doc(db_seed, extra_data={ocr_recovery.FAILED_KEY: {"reason": "x"}})
    count, _, _ = await _sweep(test_engine, [doc])
    assert count == 0


@pytest.mark.asyncio
async def test_unknown_document_does_not_count(db_seed, test_engine):
    factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    assert await ocr_recovery.register_delivery(factory, str(uuid.uuid4())) == 0


def test_a_task_delivered_again_and_again_stops_after_the_cap(tmp_path, monkeypatch):
    """The broker keeps redelivering a task that kills the worker: after N deliveries
    the OCR is no longer run and the document is marked failed."""
    store = {"count": 0, "failed": None}

    async def fake_register(_factory, _document_id):
        store["count"] += 1
        return store["count"]

    async def fake_mark(_factory, _document_id, reason):
        store["failed"] = reason

    monkeypatch.setattr(ocr_recovery, "register_delivery", fake_register)
    monkeypatch.setattr(ocr_recovery, "mark_failed", fake_mark)
    monkeypatch.setattr(settings, "OCR_MAX_DELIVERIES", 3)
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))
    (tmp_path / "scan.pdf").write_bytes(b"%PDF-1.4")

    runs = []

    class _Strategy:
        def process_pdf(self, _path):
            runs.append(1)
            raise MemoryError  # stands for a run that ends with the worker killed

    import app.services.ocr as ocr_package

    monkeypatch.setattr(ocr_package, "OCRStrategy", _Strategy)

    for _ in range(3 + 2):  # N + 2 deliveries of the same task
        tasks.process_document_ocr("doc-1", "scan.pdf", "application/pdf")

    assert len(runs) == 3  # never more than N runs
    assert store["failed"] == "3 deliveries without a result"
