"""MAX_UPLOAD_SIZE is enforced by the API on every upload path (DEC-2026-002, order 2).

The cap is lowered to 1 KiB with monkeypatch so the tests stay fast; the
multipart overhead margin (1 MiB) means a 2 KiB payload exercises the streaming
counter in the storage layer, while a payload above the margin exercises the
Content-Length pre-check.
"""

import io
import json
import pathlib

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.api.v1.endpoints.documents import MULTIPART_OVERHEAD_BYTES, storage_service
from app.core.config import settings
from app.models.document import Document
from app.models.import_job import ImportJob

UPLOAD = "/api/v1/documents/upload"
ANALYZE = "/api/v1/imports/analyze"
CAP = 1024


@pytest.fixture
def small_cap(monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE", CAP)
    return CAP


@pytest.fixture
def storage_tmp_path(tmp_path, monkeypatch):
    """Bulk imports build their own storage service from settings.STORAGE_PATH."""
    storage_dir = tmp_path / "storage"
    monkeypatch.setattr(settings, "STORAGE_PATH", str(storage_dir))
    return storage_dir


def _residue(root: str | pathlib.Path, stem: str) -> list[pathlib.Path]:
    root = pathlib.Path(root)
    if not root.exists():
        return []
    return [p for p in root.rglob(f"{stem}*") if p.is_file()]


async def _count(db_session, model, tenant_id) -> int:
    result = await db_session.execute(
        select(func.count()).select_from(model).where(model.tenant_id == tenant_id)
    )
    return result.scalar_one()


def _assert_problem(response, filename: str, cap: int) -> None:
    assert response.status_code == 413, response.text
    assert response.headers["content-type"].startswith("application/problem+json")
    body = response.json()
    assert body["error_code"] == "FILE_TOO_LARGE"
    assert body["status"] == 413
    assert body["title"] == "Content Too Large"
    assert body["severity"] == "warning"
    assert body["retryable"] is False
    assert body["max_upload_size_bytes"] == cap
    assert body["filename"] == filename
    assert filename in body["detail"]


@pytest.mark.asyncio
async def test_upload_rejects_file_over_limit(
    auth_client: AsyncClient, db_session, db_seed, small_cap
):
    """2 KiB > 1 KiB cap: refused by the streaming counter, nothing left behind."""
    before = await _count(db_session, Document, db_seed["tenant_id"])
    response = await auth_client.post(
        UPLOAD,
        files={
            "file": ("big.bin", io.BytesIO(b"x" * 2048), "application/octet-stream")
        },
        data={"title": "trop gros"},
    )
    _assert_problem(response, "big.bin", small_cap)
    assert _residue(storage_service.base_path, "big.bin") == []
    assert await _count(db_session, Document, db_seed["tenant_id"]) == before


@pytest.mark.asyncio
async def test_upload_rejects_announced_oversized_body(
    auth_client: AsyncClient, db_seed, small_cap
):
    """Content-Length above cap + margin: refused before any byte is written."""
    payload = b"y" * (small_cap + MULTIPART_OVERHEAD_BYTES + 1)
    response = await auth_client.post(
        UPLOAD,
        files={"file": ("huge.bin", io.BytesIO(payload), "application/octet-stream")},
        data={"title": "annonce trop gros"},
    )
    _assert_problem(response, "huge.bin", small_cap)
    assert _residue(storage_service.base_path, "huge.bin") == []


@pytest.mark.asyncio
async def test_upload_accepts_file_at_limit(
    auth_client: AsyncClient, db_seed, small_cap
):
    """Exactly MAX_UPLOAD_SIZE bytes is allowed (boundary), and no .part remains."""
    response = await auth_client.post(
        UPLOAD,
        files={
            "file": (
                "exact.bin",
                io.BytesIO(b"z" * small_cap),
                "application/octet-stream",
            )
        },
        data={"title": "pile a la limite"},
    )
    assert response.status_code == 201, response.text
    files = _residue(storage_service.base_path, "exact.bin")
    assert files and all(p.suffix != ".part" for p in files)


@pytest.mark.asyncio
async def test_new_version_rejects_file_over_limit(
    auth_client: AsyncClient, db_seed, small_cap
):
    created = await auth_client.post(
        UPLOAD,
        files={"file": ("v1.txt", io.BytesIO(b"version 1"), "text/plain")},
        data={"title": "Versionne"},
    )
    assert created.status_code == 201, created.text
    document_id = created.json()["id"]

    response = await auth_client.post(
        f"/api/v1/documents/{document_id}/versions",
        files={"file": ("v2.bin", io.BytesIO(b"v" * 2048), "application/octet-stream")},
        data={"change_note": "trop gros"},
    )
    _assert_problem(response, "v2.bin", small_cap)
    assert _residue(storage_service.base_path, "v2.bin") == []

    detail = await auth_client.get(f"/api/v1/documents/{document_id}")
    assert detail.status_code == 200
    assert detail.json()["current_version_id"] == created.json()["current_version_id"]


@pytest.mark.asyncio
async def test_bulk_import_rejects_batch_with_oversized_file(
    auth_client: AsyncClient, db_session, db_seed, small_cap, storage_tmp_path
):
    """One oversized file fails the whole analyze call: no job, no staged file."""
    before = await _count(db_session, ImportJob, db_seed["tenant_id"])
    response = await auth_client.post(
        ANALYZE,
        files=[
            ("files", ("petit.txt", io.BytesIO(b"alpha"), "text/plain")),
            ("files", ("gros.pdf", io.BytesIO(b"g" * 2048), "application/pdf")),
        ],
        data={
            "source_scope": "service",
            "default_document_category_id": str(db_seed["category_id"]),
            "processing_mode": "archive",
            "source_relative_paths": json.dumps(
                ["service/petit.txt", "service/gros.pdf"]
            ),
        },
    )
    _assert_problem(response, "gros.pdf", small_cap)
    assert await _count(db_session, ImportJob, db_seed["tenant_id"]) == before
    assert _residue(storage_tmp_path, "") == []
