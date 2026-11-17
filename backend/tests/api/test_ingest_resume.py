"""Resumable directory import (post-rc1 lot 14).

POST /documents/ingest-directory records each file with its document: the same
request after an interruption, or after failures, only does what is left, and
GET /documents/ingest-runs/{id} gives the progress.
"""

import uuid

import pytest
from sqlalchemy import func, select

from app.core.config import settings
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.ingest_run import IngestRun
from app.services.ingestion import DirectoryIngestionService

INGEST = "/api/v1/documents/ingest-directory"
RUNS = "/api/v1/documents/ingest-runs"


class Cut(BaseException):
    """Stands for the request being cut (worker killed, client gone)."""


@pytest.fixture
def lot(tmp_path, monkeypatch):
    root = tmp_path / "root"
    folder = root / "lot"
    folder.mkdir(parents=True)
    for name in ("a", "b", "c", "d", "e"):
        (folder / f"{name}.txt").write_text(f"contenu {name}", encoding="utf-8")
    monkeypatch.setattr(settings, "INGEST_ALLOWED_ROOTS_STR", str(root))
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path / "storage"))
    return folder


def _payload(folder) -> dict:
    return {"directory_path": str(folder), "processing_mode": "archive"}


async def _count(db_session, model, *where) -> int:
    return await db_session.scalar(
        select(func.count()).select_from(model).where(*where)
    )


def _fail_on(monkeypatch, error: BaseException, *, after: int = 0, name: str = ""):
    """Make ``_ingest_single_file`` raise ``error`` on the file named ``name``,
    or on every call past the first ``after`` ones."""
    original = DirectoryIngestionService._ingest_single_file
    calls = {"n": 0}

    async def patched(self, **kwargs):
        calls["n"] += 1
        if (name and kwargs["file_path"].endswith(name)) or (
            not name and calls["n"] > after
        ):
            raise error
        return await original(self, **kwargs)

    monkeypatch.setattr(DirectoryIngestionService, "_ingest_single_file", patched)
    return original


@pytest.mark.asyncio
async def test_an_interrupted_import_resumes_where_it_stopped(
    admin_client, db_session, db_seed, lot, monkeypatch
):
    original = _fail_on(monkeypatch, Cut(), after=2)
    with pytest.raises(Cut):
        await DirectoryIngestionService(db_session).ingest(
            source_dir=str(lot),
            tenant_id=db_seed["tenant_id"],
            org_unit_id=db_seed["org_unit_id"],
            owner_id=db_seed["user_id"],
            processing_mode="archive",
            track=True,
        )
    assert await _count(db_session, Document) == 2
    run = (await db_session.execute(select(IngestRun))).scalar_one()
    assert run.status == "running"
    monkeypatch.setattr(DirectoryIngestionService, "_ingest_single_file", original)

    resumed = await admin_client.post(INGEST, json=_payload(lot))
    assert resumed.status_code == 200, resumed.text
    body = resumed.json()
    assert body["run_id"] == str(run.id)
    assert (body["already_done"], body["imported"], body["error_count"]) == (2, 3, 0)
    assert await _count(db_session, Document) == 5
    # Nothing was hashed again: no duplicate entry for the files already in.
    assert await _count(db_session, AuditLog, AuditLog.action == "dup_detected") == 0

    progress = (await admin_client.get(f"{RUNS}/{run.id}")).json()
    assert (progress["status"], progress["attempts"], progress["imported"]) == (
        "completed",
        2,
        5,
    )
    assert progress["finished_at"] is not None

    # Finished: the same request starts a new run, which finds only duplicates.
    again = (await admin_client.post(INGEST, json=_payload(lot))).json()
    assert again["run_id"] != str(run.id)
    assert (again["imported"], again["duplicate_count"]) == (0, 5)


@pytest.mark.asyncio
async def test_failed_files_are_listed_then_retried_alone(
    admin_client, db_session, lot, monkeypatch
):
    original = _fail_on(monkeypatch, RuntimeError("fichier illisible"), name="c.txt")
    first = (await admin_client.post(INGEST, json=_payload(lot))).json()
    assert (first["imported"], first["error_count"]) == (4, 1)

    run_id = first["run_id"]
    progress = (await admin_client.get(f"{RUNS}/{run_id}")).json()
    assert (progress["status"], progress["imported"], progress["error"]) == (
        "partial",
        4,
        1,
    )
    failed = (await admin_client.get(f"{RUNS}/{run_id}/files?status=error")).json()
    assert [row["source_path"].rsplit("/", 1)[-1] for row in failed] == ["c.txt"]
    assert failed[0]["error"] == "fichier illisible"

    monkeypatch.setattr(DirectoryIngestionService, "_ingest_single_file", original)
    retry = (await admin_client.post(INGEST, json=_payload(lot))).json()
    assert retry["run_id"] == run_id
    assert (retry["already_done"], retry["imported"], retry["error_count"]) == (
        4,
        1,
        0,
    )
    progress = (await admin_client.get(f"{RUNS}/{run_id}")).json()
    assert (progress["status"], progress["imported"], progress["error"]) == (
        "completed",
        5,
        0,
    )
    assert await _count(db_session, Document) == 5
    assert await _count(db_session, AuditLog, AuditLog.action == "dup_detected") == 0


@pytest.mark.asyncio
async def test_a_run_is_visible_to_its_owner_only(
    admin_client, client_as, db_seed, lot
):
    run_id = (await admin_client.post(INGEST, json=_payload(lot))).json()["run_id"]
    assert (await admin_client.get(f"{RUNS}/{uuid.uuid4()}")).status_code == 404
    bad = await admin_client.get(f"{RUNS}/{run_id}/files?status=unknown")
    assert bad.status_code == 422

    # Same institution, another user: not found.
    async with client_as(
        "super_admin", id=uuid.uuid4(), tenant_id=db_seed["tenant_id"]
    ) as other:
        assert (await other.get(f"{RUNS}/{run_id}")).status_code == 404
        assert (await other.get(f"{RUNS}/{run_id}/files")).status_code == 404
