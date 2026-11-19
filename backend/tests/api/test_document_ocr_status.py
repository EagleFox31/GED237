"""GET /documents/{id}/ocr tells a failed reading apart from one in progress (#276)."""

import subprocess
import sys
import uuid
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

import app.services.ocr as ocr_package
from app.core.config import settings
from app.models.document import Document
from app.services.ocr.base import LOW_CONFIDENCE_THRESHOLD
from app.workers import tasks

BACKEND = Path(__file__).resolve().parents[2]


def _sessions(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def _add_scan(test_engine, db_seed) -> uuid.UUID:
    document_id = uuid.uuid4()
    async with _sessions(test_engine)() as session:
        session.add(
            Document(
                id=document_id,
                tenant_id=db_seed["tenant_id"],
                org_unit_id=db_seed["org_unit_id"],
                owner_id=db_seed["user_id"],
                title="scan_illisible",
                file_path="tenant/unit/scan_illisible.png",
                file_type="png",
                mime_type="image/png",
                file_size=128,
                document_category_id=db_seed["category_id"],
                status="draft",
                processing_mode="archive",
            )
        )
        await session.commit()
    return document_id


async def _ocr(auth_client: AsyncClient, document_id) -> dict:
    response = await auth_client.get(f"/api/v1/documents/{document_id}/ocr")
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.asyncio
async def test_a_failed_reading_is_failed_with_its_reason_then_cleared_by_a_success(
    auth_client: AsyncClient, db_seed, test_engine, monkeypatch
):
    monkeypatch.setattr(tasks, "AsyncSessionLocal", _sessions(test_engine))
    document_id = await _add_scan(test_engine, db_seed)
    assert (await _ocr(auth_client, document_id))["ocr_status"] == "processing"

    await tasks.mark_document_ocr_failed(str(document_id), tasks.OCR_NO_TEXT)
    failed = await _ocr(auth_client, document_id)
    assert failed["ocr_status"] == "failed"
    assert failed["ocr_error"] == "no_text"
    assert failed["low_confidence"] is None

    await tasks.update_document_ocr(str(document_id), "Facture 2026", 0.5, "tesseract")
    read = await _ocr(auth_client, document_id)
    assert read["ocr_status"] == "completed"
    assert read["ocr_error"] is None
    assert read["low_confidence"] is True
    async with _sessions(test_engine)() as session:
        extra = (await session.get(Document, document_id)).extra_data
    assert "ocr_status" not in extra and "ocr_error" not in extra


@pytest.mark.asyncio
async def test_low_confidence_follows_the_single_threshold(
    auth_client: AsyncClient, db_seed, test_engine, monkeypatch
):
    monkeypatch.setattr(tasks, "AsyncSessionLocal", _sessions(test_engine))
    document_id = await _add_scan(test_engine, db_seed)
    await tasks.update_document_ocr(
        str(document_id), "Texte net", LOW_CONFIDENCE_THRESHOLD, "tesseract"
    )
    assert (await _ocr(auth_client, document_id))["low_confidence"] is False


class _FakeStrategy:
    """Stands in for the engines: an empty PDF and an image that makes the engine crash."""

    def process_pdf(self, path):
        return "", 0.0

    def process_image(self, path, **_):
        raise RuntimeError("engine crashed")


@pytest.mark.parametrize(
    ("file_path", "file_type", "reason"),
    [
        ("missing/scan.png", "image/png", "file_not_found"),
        ("scan.bin", "application/octet-stream", "unsupported_format"),
        ("scan.pdf", "application/pdf", "no_text"),
        ("scan.png", "image/png", "engine_error"),
    ],
)
def test_every_failure_of_the_worker_is_recorded_with_its_code(
    file_path, file_type, reason, tmp_path, monkeypatch
):
    for name in ("scan.bin", "scan.pdf", "scan.png"):
        (tmp_path / name).write_bytes(b"x")
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(ocr_package, "OCRStrategy", _FakeStrategy, raising=False)
    recorded = []

    async def _record(document_id, why):
        recorded.append((document_id, why))

    monkeypatch.setattr(tasks, "mark_document_ocr_failed", _record)

    assert tasks.process_document_ocr("doc-1", file_path, file_type) is False
    assert recorded == [("doc-1", reason)]


def test_the_threshold_does_not_load_the_ocr_engines():
    """The API imports the threshold through the worker module: torch must stay out."""
    probe = (
        "import sys, app.services.ocr, app.services.ocr.base; "
        "sys.exit(int(any(m in sys.modules for m in ('easyocr', 'torch'))))"
    )
    assert subprocess.run([sys.executable, "-c", probe], cwd=BACKEND).returncode == 0
