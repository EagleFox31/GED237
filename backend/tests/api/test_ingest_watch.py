"""Watched folders (lot 5): periodic ingestion, files moved away, status endpoint.

The pass runs through ``run_watch_pass`` with an in-memory Redis stand-in; the
folders live under tmp_path, declared as INGEST_ALLOWED_ROOTS.
"""

import json
import os
import time
import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.services import ingest_watch
from app.services.ingest_watch import LAST_RUN_KEY, LOCK_KEY, run_watch_pass
from app.services.ingestion import DirectoryIngestionService

STATUS = "/api/v1/documents/ingest-watch/status"


class MemoryRedis:
    """The few Redis calls the watch uses: SET NX EX, GET, compare-and-delete."""

    def __init__(self):
        self.data: dict[str, str] = {}

    async def set(self, key, value, nx=False, ex=None):
        if nx and key in self.data:
            return None
        self.data[key] = value
        return True

    async def get(self, key):
        return self.data.get(key)

    async def eval(self, _script, _numkeys, key, token):
        if self.data.get(key) == token:
            del self.data[key]
            return 1
        return 0


@pytest.fixture
def watch_fs(tmp_path, monkeypatch):
    root = tmp_path / "root"
    folder = root / "courrier"
    folder.mkdir(parents=True)
    monkeypatch.setattr(settings, "INGEST_ALLOWED_ROOTS_STR", str(root))
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path / "storage"))
    monkeypatch.setattr(settings, "INGEST_WATCH_INTERVAL_SECONDS", 60)
    monkeypatch.setattr(settings, "INGEST_WATCH_SETTLE_SECONDS", 0)
    return {"root": root, "folder": folder, "tmp": tmp_path}


def _watch(monkeypatch, *folders: dict) -> None:
    monkeypatch.setattr(settings, "INGEST_WATCH_FOLDERS_STR", json.dumps(list(folders)))


def _entry(path, **extra) -> dict:
    return {
        "path": str(path),
        "tenant_code": "TESTMIN",
        "org_unit_code": "DIR-TEST",
        "matricule": "TEST001",
        "document_category_code": "note_de_service",
        "processing_mode": "archive",
        **extra,
    }


def _sessions(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def _count(test_engine, model, *where) -> int:
    async with _sessions(test_engine)() as db:
        return await db.scalar(select(func.count()).select_from(model).where(*where))


def _processed(folder) -> list[str]:
    today = datetime.now(timezone.utc).date().isoformat()
    target = folder / "_traites" / today
    return sorted(os.listdir(target)) if target.exists() else []


def test_invalid_watch_config_is_ignored(monkeypatch):
    monkeypatch.setattr(settings, "INGEST_WATCH_FOLDERS_STR", "{pas du json")
    assert settings.INGEST_WATCH_FOLDERS == []
    assert ingest_watch.watch_enabled() is False

    monkeypatch.setattr(
        settings,
        "INGEST_WATCH_FOLDERS_STR",
        json.dumps([{"tenant_code": "X"}, "a", {"path": "/d"}]),
    )
    assert settings.INGEST_WATCH_FOLDERS == [{"path": "/d"}]


@pytest.mark.asyncio
async def test_pass_imports_then_moves_files_and_second_pass_is_a_no_op(
    test_engine, db_seed, watch_fs, monkeypatch
):
    folder = watch_fs["folder"]
    (folder / "a.txt").write_text("alpha", encoding="utf-8")
    (folder / "b.txt").write_text("beta", encoding="utf-8")
    _watch(monkeypatch, _entry(folder))
    redis = MemoryRedis()

    first = await run_watch_pass(_sessions(test_engine), redis)
    second = await run_watch_pass(_sessions(test_engine), redis)

    tenant = Document.tenant_id == db_seed["tenant_id"]
    assert first["folders"][0]["imported"] == 2
    assert _processed(folder) == ["a.txt", "b.txt"]
    assert sorted(os.listdir(folder)) == ["_traites"]
    assert await _count(test_engine, Document, tenant) == 2
    assert (
        await _count(
            test_engine, DocumentVersion, DocumentVersion.checksum_sha256.is_not(None)
        )
        == 2
    )
    # Second pass: nothing found, nothing written, no audit row for an idle folder.
    assert {k: second["folders"][0][k] for k in ("found", "imported", "errors")} == {
        "found": 0,
        "imported": 0,
        "errors": 0,
    }
    assert await _count(test_engine, Document, tenant) == 2
    assert await _count(test_engine, AuditLog, AuditLog.action == "watch_ingested") == 1
    assert json.loads(redis.data[LAST_RUN_KEY]) == second
    assert LOCK_KEY not in redis.data


@pytest.mark.asyncio
async def test_file_already_in_the_ged_is_not_imported_again(
    test_engine, db_seed, watch_fs, monkeypatch
):
    folder = watch_fs["folder"]
    (folder / "note.txt").write_text("meme contenu", encoding="utf-8")
    _watch(monkeypatch, _entry(folder))
    await run_watch_pass(_sessions(test_engine), MemoryRedis())
    (folder / "copie.txt").write_text("meme contenu", encoding="utf-8")

    result = await run_watch_pass(_sessions(test_engine), MemoryRedis())

    assert {k: result["folders"][0][k] for k in ("found", "imported", "skipped")} == {
        "found": 1,
        "imported": 0,
        "skipped": 1,
    }
    assert _processed(folder) == ["copie.txt", "note.txt"]
    assert (
        await _count(test_engine, Document, Document.tenant_id == db_seed["tenant_id"])
        == 1
    )
    assert await _count(test_engine, AuditLog, AuditLog.action == "dup_detected") == 1


@pytest.mark.asyncio
async def test_folder_outside_allowed_roots_is_never_read(
    test_engine, db_seed, watch_fs, monkeypatch
):
    outside = watch_fs["tmp"] / "autre"
    outside.mkdir()
    (outside / "x.txt").write_text("secret", encoding="utf-8")
    _watch(monkeypatch, _entry(outside))

    result = await run_watch_pass(_sessions(test_engine), MemoryRedis())

    assert result["folders"] == []
    assert os.listdir(outside) == ["x.txt"]
    assert (
        await _count(test_engine, Document, Document.tenant_id == db_seed["tenant_id"])
        == 0
    )


@pytest.mark.asyncio
async def test_file_still_being_copied_waits_for_the_next_pass(
    test_engine, db_seed, watch_fs, monkeypatch
):
    folder = watch_fs["folder"]
    fresh = folder / "en_cours.txt"
    fresh.write_text("copie", encoding="utf-8")
    monkeypatch.setattr(settings, "INGEST_WATCH_SETTLE_SECONDS", 600)
    _watch(monkeypatch, _entry(folder))

    waiting = await run_watch_pass(_sessions(test_engine), MemoryRedis())
    old = time.time() - 3600
    os.utime(fresh, (old, old))
    settled = await run_watch_pass(_sessions(test_engine), MemoryRedis())

    assert waiting["folders"][0]["found"] == 0
    assert fresh.exists() is False
    assert settled["folders"][0]["imported"] == 1


@pytest.mark.asyncio
async def test_failing_file_goes_to_errors_and_others_are_imported(
    test_engine, db_seed, watch_fs, monkeypatch
):
    folder = watch_fs["folder"]
    (folder / "bon.txt").write_text("bon", encoding="utf-8")
    (folder / "casse.txt").write_text("casse", encoding="utf-8")
    _watch(monkeypatch, _entry(folder))
    original = DirectoryIngestionService._ingest_single_file

    async def failing(self, **kwargs):
        if kwargs["file_path"].endswith("casse.txt"):
            raise RuntimeError("fichier illisible")
        return await original(self, **kwargs)

    monkeypatch.setattr(DirectoryIngestionService, "_ingest_single_file", failing)

    result = await run_watch_pass(_sessions(test_engine), MemoryRedis())

    assert {k: result["folders"][0][k] for k in ("imported", "errors")} == {
        "imported": 1,
        "errors": 1,
    }
    assert os.listdir(folder / "_erreurs") == ["casse.txt"]
    assert _processed(folder) == ["bon.txt"]


@pytest.mark.asyncio
async def test_pass_is_skipped_while_another_one_holds_the_lock(
    test_engine, db_seed, watch_fs, monkeypatch
):
    (watch_fs["folder"] / "a.txt").write_text("alpha", encoding="utf-8")
    _watch(monkeypatch, _entry(watch_fs["folder"]))
    redis = MemoryRedis()
    redis.data[LOCK_KEY] = "autre-passage"

    assert await run_watch_pass(_sessions(test_engine), redis) is None
    assert redis.data[LOCK_KEY] == "autre-passage"
    assert (watch_fs["folder"] / "a.txt").exists()


@pytest.mark.asyncio
async def test_status_shows_only_the_folders_of_the_current_tenant(
    auth_client: AsyncClient, db_seed, watch_fs, monkeypatch
):
    other_tenant = str(uuid.uuid4())
    _watch(
        monkeypatch,
        _entry(watch_fs["folder"]),
        _entry("/data/autre", tenant_code="AUTRE"),
    )
    redis = MemoryRedis()
    redis.data[LAST_RUN_KEY] = json.dumps(
        {
            "at": "2026-11-10T12:00:00+00:00",
            "folders": [
                {
                    "path": str(watch_fs["folder"]),
                    "tenant_id": str(db_seed["tenant_id"]),
                    "found": 2,
                    "imported": 1,
                    "skipped": 1,
                    "errors": 0,
                },
                {
                    "path": "/data/autre",
                    "tenant_id": other_tenant,
                    "found": 9,
                    "imported": 9,
                    "skipped": 0,
                    "errors": 0,
                },
            ],
        }
    )

    async def fake_redis():
        return redis

    monkeypatch.setattr("app.api.v1.endpoints.documents.get_redis", fake_redis)

    response = await auth_client.get(STATUS)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["enabled"] is True
    assert body["interval_seconds"] == 60
    assert body["last_run"]["folders"] == [
        {
            "path": str(watch_fs["folder"]),
            "found": 2,
            "imported": 1,
            "skipped": 1,
            "errors": 0,
        }
    ]

    monkeypatch.setattr(settings, "INGEST_WATCH_INTERVAL_SECONDS", 0)
    assert (await auth_client.get(STATUS)).json()["enabled"] is False


@pytest.mark.asyncio
async def test_status_requires_the_right_to_create_documents(
    client_as, db_seed, watch_fs, monkeypatch
):
    async with client_as("reader", tenant_id=db_seed["tenant_id"]) as client:
        response = await client.get(STATUS)
    assert response.status_code == 403, response.text


def test_watch_is_off_by_default_and_the_task_touches_nothing(monkeypatch):
    """Default config: no schedule, and a stray task call reads neither Redis nor folders."""
    import redis.asyncio as aioredis

    from app.workers.celery_app import celery_app
    from app.workers.tasks import watch_ingest_folders

    monkeypatch.setattr(
        settings,
        "INGEST_WATCH_FOLDERS_STR",
        type(settings).model_fields["INGEST_WATCH_FOLDERS_STR"].default,
    )

    def no_redis(*_args, **_kwargs):
        raise AssertionError("Redis must not be reached when nothing is watched")

    monkeypatch.setattr(aioredis, "from_url", no_redis)

    assert settings.INGEST_WATCH_FOLDERS == []
    assert "watch-ingest-folders" not in (celery_app.conf.beat_schedule or {})
    assert watch_ingest_folders() is None


@pytest.mark.asyncio
async def test_folder_overlapping_the_hand_import_folder_is_never_emptied(
    test_engine, db_seed, watch_fs, monkeypatch
):
    root = watch_fs["root"]
    live = root / "live"
    (live / "lot").mkdir(parents=True)
    (live / "lot" / "p2.txt").write_text("demo", encoding="utf-8")
    (watch_fs["folder"] / "courrier.txt").write_text("courrier", encoding="utf-8")
    monkeypatch.setattr(settings, "INGEST_WATCH_PROTECTED_DIRS_STR", str(live))
    _watch(
        monkeypatch,
        _entry(live),  # the folder itself
        _entry(root),  # a parent, recursive by default
        _entry(live / "lot"),  # a child
        _entry(watch_fs["folder"]),  # a sibling: still watched
    )

    result = await run_watch_pass(_sessions(test_engine), MemoryRedis())

    assert [f["path"] for f in result["folders"]] == [str(watch_fs["folder"])]
    assert os.listdir(live / "lot") == ["p2.txt"]
    assert _processed(watch_fs["folder"]) == ["courrier.txt"]
