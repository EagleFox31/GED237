"""Trash: DELETE moves to the trash, purge is trash-only, bulk and retention purges."""

import io
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from httpx import AsyncClient
from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings, settings
from app.models.audit import AuditLog
from app.models.document import Document
from app.services import trash_service
from app.workers.celery_app import build_beat_schedule

DOCS = "/api/v1/documents"


class RecordingStorage:
    """Stands for the storage backend: records what a purge asks to remove."""

    def __init__(self, fail_on: str | None = None):
        self.removed: list[str] = []
        self.fail_on = fail_on

    def delete_file(self, path: str) -> bool:
        if path == self.fail_on:
            raise OSError("disk unavailable")
        self.removed.append(path)
        return True


async def _upload(client: AsyncClient, db_seed, name: str) -> str:
    response = await client.post(
        f"{DOCS}/upload",
        files={"file": (name, io.BytesIO(name.encode()), "text/plain")},
        data={
            "title": name.rsplit(".", 1)[0],
            "document_category_id": str(db_seed["category_id"]),
            "processing_mode": "archive",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def _trashed(client: AsyncClient, db_seed, name: str) -> str:
    document_id = await _upload(client, db_seed, name)
    assert (await client.post(f"{DOCS}/{document_id}/trash")).status_code == 200
    return document_id


def _factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def _audit_rows(test_engine, document_id: str, action: str) -> list[AuditLog]:
    async with _factory(test_engine)() as session:
        result = await session.execute(
            select(AuditLog).where(
                AuditLog.record_id == uuid.UUID(document_id),
                AuditLog.action == action,
            )
        )
        return list(result.scalars().all())


async def _document_row(test_engine, document_id: str) -> Document | None:
    async with _factory(test_engine)() as session:
        return await session.get(Document, uuid.UUID(document_id))


async def _age_trash(test_engine, document_id: str, days: int, **values) -> None:
    async with _factory(test_engine)() as session:
        await session.execute(
            update(Document)
            .where(Document.id == uuid.UUID(document_id))
            .values(
                deleted_at=datetime.now(timezone.utc) - timedelta(days=days), **values
            )
        )
        await session.commit()


# --- DELETE /documents/{id} -------------------------------------------------


@pytest.mark.asyncio
async def test_delete_moves_the_document_to_the_trash(
    admin_client: AsyncClient, db_seed, test_engine
):
    document_id = await _upload(admin_client, db_seed, "delete-to-trash.txt")

    assert (await admin_client.delete(f"{DOCS}/{document_id}")).status_code == 204

    row = await _document_row(test_engine, document_id)
    assert row is not None and row.deleted_at is not None
    assert row.deleted_by == db_seed["user_id"]
    listing = await admin_client.get(f"{DOCS}/trash")
    assert [item["id"] for item in listing.json()] == [document_id]
    assert listing.headers["X-Total-Count"] == "1"
    trail = await _audit_rows(test_engine, document_id, "document_trashed")
    assert len(trail) == 1 and trail[0].new_data == {"via": "delete"}

    # Idempotent: a second DELETE changes nothing and adds no audit row.
    assert (await admin_client.delete(f"{DOCS}/{document_id}")).status_code == 204
    assert len(await _audit_rows(test_engine, document_id, "document_trashed")) == 1

    assert (await admin_client.post(f"{DOCS}/{document_id}/restore")).status_code == 200
    assert (await _document_row(test_engine, document_id)).deleted_at is None


@pytest.mark.asyncio
async def test_collaborator_delete_trashes_but_cannot_purge(
    auth_client: AsyncClient, db_seed, test_engine
):
    document_id = await _upload(auth_client, db_seed, "collaborator-delete.txt")

    assert (await auth_client.delete(f"{DOCS}/{document_id}")).status_code == 204
    assert (await auth_client.delete(f"{DOCS}/{document_id}/purge")).status_code == 403
    assert (await auth_client.post(f"{DOCS}/trash/empty")).status_code == 403

    row = await _document_row(test_engine, document_id)
    assert row is not None and row.deleted_at is not None


# --- GET /documents/trash ---------------------------------------------------


@pytest.mark.asyncio
async def test_trash_listing_is_bounded_and_carries_the_total(
    admin_client: AsyncClient, db_seed
):
    for index in range(3):
        await _trashed(admin_client, db_seed, f"trash-page-{index}.txt")

    page = await admin_client.get(f"{DOCS}/trash", params={"limit": 2, "skip": 1})
    assert page.status_code == 200
    assert len(page.json()) == 2
    assert page.headers["X-Total-Count"] == "3"

    # An oversized or negative page is clamped, never an error (existing callers).
    wide = await admin_client.get(f"{DOCS}/trash", params={"limit": 100000, "skip": -5})
    assert wide.status_code == 200 and len(wide.json()) == 3


# --- DELETE /documents/{id}/purge -------------------------------------------


@pytest.mark.asyncio
async def test_purge_refuses_a_document_that_is_not_in_the_trash(
    admin_client: AsyncClient, db_seed, test_engine
):
    document_id = await _upload(admin_client, db_seed, "purge-active.txt")

    response = await admin_client.delete(f"{DOCS}/{document_id}/purge")

    assert response.status_code == 409
    assert await _document_row(test_engine, document_id) is not None
    assert await _audit_rows(test_engine, document_id, "document_purged") == []


@pytest.mark.asyncio
async def test_purge_of_a_trashed_document_is_audited(
    admin_client: AsyncClient, db_seed, test_engine
):
    document_id = await _trashed(admin_client, db_seed, "purge-trashed.txt")

    assert (await admin_client.delete(f"{DOCS}/{document_id}/purge")).status_code == 200

    assert await _document_row(test_engine, document_id) is None
    trail = await _audit_rows(test_engine, document_id, "document_purged")
    assert len(trail) == 1
    assert trail[0].new_data == {"reason": "manual"}
    assert trail[0].user_id == db_seed["user_id"]
    assert (await admin_client.delete(f"{DOCS}/{document_id}/purge")).status_code == 404


class _FailingCommitSession:
    """Session whose commit fails: the purge must then leave every file in place."""

    def __init__(self):
        self.added, self.deleted = [], []

    async def execute(self, _statement):
        return SimpleNamespace(
            scalars=lambda: SimpleNamespace(all=lambda: ["store/v1.bin"])
        )

    def add(self, row):
        self.added.append(row)

    async def delete(self, row):
        self.deleted.append(row)

    async def commit(self):
        raise RuntimeError("commit failed")


def _fake_document(**overrides):
    values = {
        "id": uuid.uuid4(),
        "tenant_id": uuid.uuid4(),
        "file_path": "store/current.bin",
        "deleted_at": datetime.now(timezone.utc),
        "locked_by_user_id": None,
        "lock_expires_at": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.mark.asyncio
async def test_a_failed_commit_removes_no_file():
    storage = RecordingStorage()
    session = _FailingCommitSession()

    with pytest.raises(RuntimeError, match="commit failed"):
        await trash_service.purge_many(
            session, storage, [_fake_document()], actor_id=None, reason="manual"
        )

    assert storage.removed == []


@pytest.mark.asyncio
async def test_staging_refuses_an_active_document():
    session = _FailingCommitSession()

    with pytest.raises(trash_service.NotInTrashError):
        await trash_service.stage_purge(
            session, _fake_document(deleted_at=None), actor_id=None, reason="manual"
        )

    assert session.added == [] and session.deleted == []


def test_file_removal_is_deduplicated_and_never_raises(caplog):
    storage = RecordingStorage(fail_on="b")

    orphans = trash_service.remove_files(storage, ["a", "b", "a", "c"])

    assert storage.removed == ["a", "c"]
    assert orphans == 1
    assert "file removal failed (OSError): b" in caplog.text


# --- POST /documents/trash/empty --------------------------------------------


@pytest.mark.asyncio
async def test_empty_trash_purges_only_trashed_documents(
    admin_client: AsyncClient, db_seed, test_engine
):
    active = await _upload(admin_client, db_seed, "empty-active.txt")
    first = await _trashed(admin_client, db_seed, "empty-first.txt")
    second = await _trashed(admin_client, db_seed, "empty-second.txt")

    targeted = await admin_client.post(
        f"{DOCS}/trash/empty",
        json={"document_ids": [first, active, str(uuid.uuid4())]},
    )
    assert targeted.status_code == 200
    assert targeted.json() == {"purged": 1, "remaining": 1}
    assert await _document_row(test_engine, first) is None
    assert await _document_row(test_engine, active) is not None
    trail = await _audit_rows(test_engine, first, "document_purged")
    assert [row.new_data for row in trail] == [{"reason": "trash_emptied"}]

    # Nothing is old enough: no-op.
    aged = await admin_client.post(f"{DOCS}/trash/empty", json={"older_than_days": 30})
    assert aged.json() == {"purged": 0, "remaining": 1}

    everything = await admin_client.post(f"{DOCS}/trash/empty")
    assert everything.json() == {"purged": 1, "remaining": 0}
    assert await _document_row(test_engine, second) is None
    assert await _document_row(test_engine, active) is not None

    again = await admin_client.post(f"{DOCS}/trash/empty")
    assert again.json() == {"purged": 0, "remaining": 0}


@pytest.mark.asyncio
async def test_empty_trash_honours_older_than_days_and_the_batch(
    admin_client: AsyncClient, db_seed, test_engine, monkeypatch
):
    old = [
        await _trashed(admin_client, db_seed, f"empty-old-{index}.txt")
        for index in range(3)
    ]
    recent = await _trashed(admin_client, db_seed, "empty-recent.txt")
    for document_id in old:
        await _age_trash(test_engine, document_id, days=40)
    monkeypatch.setattr(settings, "TRASH_PURGE_BATCH", 2)

    first = await admin_client.post(f"{DOCS}/trash/empty", json={"older_than_days": 30})
    second = await admin_client.post(
        f"{DOCS}/trash/empty", json={"older_than_days": 30}
    )

    assert first.json() == {"purged": 2, "remaining": 2}
    assert second.json() == {"purged": 1, "remaining": 1}
    assert await _document_row(test_engine, recent) is not None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "body",
    [
        {"older_than_days": 0},
        {"document_ids": []},
        {"document_ids": ["not-a-uuid"]},
        {"document_ids": [str(uuid.uuid4()) for _ in range(501)]},
    ],
)
async def test_empty_trash_rejects_an_out_of_contract_body(
    admin_client: AsyncClient, body
):
    response = await admin_client.post(f"{DOCS}/trash/empty", json=body)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_another_institution_cannot_purge_the_trash(
    client_as, db_seed, test_engine
):
    async with client_as(
        "super_admin",
        id=db_seed["user_id"],
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as owner:
        document_id = await _trashed(owner, db_seed, "foreign-tenant.txt")

    async with client_as("super_admin", tenant_id=uuid.uuid4()) as stranger:
        by_id = await stranger.post(
            f"{DOCS}/trash/empty", json={"document_ids": [document_id]}
        )
        everything = await stranger.post(f"{DOCS}/trash/empty")
        direct = await stranger.delete(f"{DOCS}/{document_id}/purge")

    assert by_id.json() == {"purged": 0, "remaining": 0}
    assert everything.json() == {"purged": 0, "remaining": 0}
    assert direct.status_code == 404
    assert await _document_row(test_engine, document_id) is not None


# --- Retention (worker) -----------------------------------------------------


@pytest.mark.asyncio
async def test_retention_pass_is_idempotent_and_skips_locked_documents(
    admin_client: AsyncClient, db_seed, test_engine, fake_redis
):
    expired = await _trashed(admin_client, db_seed, "retention-expired.txt")
    recent = await _trashed(admin_client, db_seed, "retention-recent.txt")
    locked = await _trashed(admin_client, db_seed, "retention-locked.txt")
    active = await _upload(admin_client, db_seed, "retention-active.txt")
    await _age_trash(test_engine, expired, days=100)
    await _age_trash(
        test_engine,
        locked,
        days=100,
        locked_by_user_id=db_seed["user_id"],
        lock_expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    expired_path = (await _document_row(test_engine, expired)).file_path
    storage = RecordingStorage()

    async def run():
        return await trash_service.run_retention_pass(
            _factory(test_engine),
            fake_redis,
            storage,
            retention_days=90,
            batch_size=1,
        )

    assert await run() == 1
    assert await run() == 0

    assert await _document_row(test_engine, expired) is None
    for kept in (recent, locked, active):
        assert await _document_row(test_engine, kept) is not None
    assert expired_path in storage.removed
    trail = await _audit_rows(test_engine, expired, "document_purged")
    assert len(trail) == 1
    assert trail[0].user_id is None
    assert trail[0].tenant_id == db_seed["tenant_id"]
    assert trail[0].new_data == {"reason": "trash_retention", "retention_days": 90}
    assert await fake_redis.get(trash_service.LOCK_KEY) is None


@pytest.mark.asyncio
async def test_retention_pass_does_not_run_twice_at_once(fake_redis):
    await fake_redis.set(trash_service.LOCK_KEY, "another-worker")

    def no_session():
        raise AssertionError("the database must not be reached while locked")

    result = await trash_service.run_retention_pass(
        no_session, fake_redis, RecordingStorage(), retention_days=90, batch_size=10
    )

    assert result is None
    assert await fake_redis.get(trash_service.LOCK_KEY) == "another-worker"


@pytest.mark.asyncio
async def test_retention_disabled_reaches_nothing():
    result = await trash_service.run_retention_pass(
        None, None, None, retention_days=0, batch_size=10
    )
    assert result is None


def test_retention_is_off_by_default_and_the_task_touches_nothing(monkeypatch):
    import redis.asyncio as aioredis

    from app.workers.tasks import purge_expired_trash

    def no_redis(*_args, **_kwargs):
        raise AssertionError("Redis must not be reached when retention is off")

    monkeypatch.setattr(aioredis, "from_url", no_redis)
    monkeypatch.setattr(settings, "TRASH_RETENTION_DAYS", 0)

    assert Settings.model_fields["TRASH_RETENTION_DAYS"].default == 0
    assert Settings.model_fields["TRASH_PURGE_BATCH"].default == 200
    assert purge_expired_trash() is None
    with pytest.raises(ValidationError):
        Settings(TRASH_RETENTION_DAYS=-1)


# --- Beat registry ----------------------------------------------------------

WATCH_ENTRY = {
    "task": "app.workers.tasks.watch_ingest_folders",
    "schedule": 60.0,
}


def _cfg(**overrides):
    values = {
        "INGEST_WATCH_FOLDERS": [],
        "INGEST_WATCH_INTERVAL_SECONDS": 60,
        "TRASH_RETENTION_DAYS": 0,
        "TRASH_PURGE_INTERVAL_SECONDS": 3600,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_beat_registry_is_empty_by_default():
    assert build_beat_schedule(_cfg()) == {}


def test_beat_registry_keeps_the_watch_entry_identical():
    folders = [{"path": "/data/in"}]

    assert build_beat_schedule(_cfg(INGEST_WATCH_FOLDERS=folders)) == {
        "watch-ingest-folders": WATCH_ENTRY
    }
    assert (
        build_beat_schedule(
            _cfg(INGEST_WATCH_FOLDERS=folders, INGEST_WATCH_INTERVAL_SECONDS=0)
        )
        == {}
    )


def test_beat_registry_merges_retention_with_the_watch():
    schedule = build_beat_schedule(
        _cfg(INGEST_WATCH_FOLDERS=[{"path": "/data/in"}], TRASH_RETENTION_DAYS=90)
    )

    assert schedule == {
        "watch-ingest-folders": WATCH_ENTRY,
        "purge-expired-trash": {
            "task": "app.workers.tasks.purge_expired_trash",
            "schedule": 3600.0,
        },
    }
