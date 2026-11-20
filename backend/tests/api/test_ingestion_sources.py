"""Ingestion sources (F-NEXT-01): CRUD, tenant isolation, run, agent key.

Server paths are checked against INGEST_ALLOWED_ROOTS, pointed at tmp_path.
"""

import hashlib
import uuid
from types import SimpleNamespace

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, update

from app.api.v1.endpoints import ingestion_sources as sources_module
from app.core.config import settings
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.ingestion_source import IngestionSource
from app.models.user import User

BASE = "/api/v1/ingestion/sources"


@pytest.fixture
def ingest_fs(tmp_path, monkeypatch):
    root = tmp_path / "root"
    lot = root / "lot"
    lot.mkdir(parents=True)
    (lot / "a.txt").write_text("alpha", encoding="utf-8")
    (lot / "b.txt").write_text("beta", encoding="utf-8")
    outside = tmp_path / "autre"
    outside.mkdir()
    monkeypatch.setattr(settings, "INGEST_ALLOWED_ROOTS_STR", str(root))
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path / "storage"))
    return {"root": root, "lot": lot, "outside": outside}


@pytest.fixture
def run_redis(fake_redis, monkeypatch):
    async def _get_redis():
        return fake_redis

    monkeypatch.setattr(sources_module, "get_redis", _get_redis)
    return fake_redis


def _local(path, **extra) -> dict:
    return {
        "name": "Serveur courrier",
        "source_type": "local",
        "path": str(path),
        **extra,
    }


async def _actions(db_session, source_id) -> list[str]:
    rows = await db_session.execute(
        select(AuditLog.action).where(
            AuditLog.table_name == "ingestion_sources",
            AuditLog.record_id == uuid.UUID(str(source_id)),
        )
    )
    return list(rows.scalars())


async def _documents(db_session, tenant_id) -> int:
    result = await db_session.execute(
        select(func.count())
        .select_from(Document)
        .where(Document.tenant_id == tenant_id)
    )
    return result.scalar_one()


@pytest.mark.asyncio
async def test_crud_of_a_local_source(
    admin_client: AsyncClient, db_session, db_seed, ingest_fs
):
    created = await admin_client.post(BASE + "/", json=_local(ingest_fs["lot"]))
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["source_type"] == "local"
    assert body["path"] == str(ingest_fs["lot"])
    assert body["org_unit_id"] == str(db_seed["org_unit_id"])
    assert body["owner_id"] == str(db_seed["user_id"])
    assert body["enabled"] is True and body["last_run_at"] is None
    assert body["agent_key"] is None
    source_id = body["id"]

    listed = await admin_client.get(BASE + "/")
    assert [s["id"] for s in listed.json()] == [source_id]

    patched = await admin_client.patch(
        f"{BASE}/{source_id}", json={"enabled": False, "recursive": False}
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["enabled"] is False
    assert (await admin_client.get(BASE + "/", params={"enabled": True})).json() == []

    # Same values again: no write, no audit row.
    again = await admin_client.patch(f"{BASE}/{source_id}", json={"enabled": False})
    assert again.status_code == 200

    duplicate = await admin_client.post(BASE + "/", json=_local(ingest_fs["lot"]))
    assert duplicate.status_code == 409

    assert (await admin_client.delete(f"{BASE}/{source_id}")).status_code == 204
    assert (await admin_client.get(f"{BASE}/{source_id}")).status_code == 404
    assert sorted(await _actions(db_session, source_id)) == [
        "create",
        "delete",
        "update",
    ]


@pytest.mark.asyncio
async def test_paths_outside_the_allowed_roots_are_refused(
    admin_client: AsyncClient, ingest_fs
):
    refused = await admin_client.post(BASE + "/", json=_local(ingest_fs["outside"]))
    assert refused.status_code == 403
    assert refused.json()["error_code"] == "INGEST_PATH_FORBIDDEN"

    created = await admin_client.post(BASE + "/", json=_local(ingest_fs["lot"]))
    source_id = created.json()["id"]
    moved = await admin_client.patch(
        f"{BASE}/{source_id}", json={"path": str(ingest_fs["outside"])}
    )
    assert moved.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"name": "x", "source_type": "local"},
        {"name": "x", "source_type": "agent", "path": "/data"},
        {
            "name": "x",
            "source_type": "local",
            "path": "/data",
            "credentials_ref": "SMB",
        },
        {"name": "x", "source_type": "ftp", "path": "/data"},
    ],
)
async def test_path_and_credentials_must_match_the_type(admin_client, payload):
    assert (await admin_client.post(BASE + "/", json=payload)).status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "credentials_ref",
    ["../../etc/x", "SMB..FIN", "/etc/x", "smb/fin", ".hidden", "-x", "A" * 129],
)
async def test_credentials_ref_is_a_plain_name(
    admin_client, ingest_fs, credentials_ref
):
    payload = {
        "name": "Partage",
        "source_type": "smb",
        "path": str(ingest_fs["lot"]),
        "credentials_ref": credentials_ref,
    }
    assert (await admin_client.post(BASE + "/", json=payload)).status_code == 422

    payload["credentials_ref"] = "SMB_FIN.prod-2"
    created = await admin_client.post(BASE + "/", json=payload)
    assert created.status_code == 201, created.text
    patched = await admin_client.patch(
        f"{BASE}/{created.json()['id']}", json={"credentials_ref": credentials_ref}
    )
    assert patched.status_code == 422


@pytest.mark.asyncio
async def test_targets_of_another_tenant_are_refused(admin_client, ingest_fs):
    for field in ("org_unit_id", "owner_id", "document_category_id"):
        response = await admin_client.post(
            BASE + "/", json=_local(ingest_fs["lot"], **{field: str(uuid.uuid4())})
        )
        assert response.status_code == 400, field


@pytest.mark.asyncio
async def test_collaborator_cannot_manage_sources(auth_client: AsyncClient):
    assert (await auth_client.get(BASE + "/")).status_code == 403
    response = await auth_client.post(
        BASE + "/", json={"name": "a", "source_type": "agent"}
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_tenant_admin_manages_its_own_tenant_only(
    client_as, db_session, db_seed, ingest_fs
):
    source = IngestionSource(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        name="Partage finances",
        source_type="smb",
        path=str(ingest_fs["lot"]),
        credentials_ref="SMB_FINANCES",
        org_unit_id=db_seed["org_unit_id"],
        owner_id=db_seed["user_id"],
    )
    db_session.add(source)
    await db_session.commit()

    async with client_as(
        "tenant_admin",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        listed = await client.get(BASE + "/")
        assert listed.status_code == 200
        assert [s["credentials_ref"] for s in listed.json()] == ["SMB_FINANCES"]

    async with client_as("tenant_admin") as stranger:
        assert (await stranger.get(BASE + "/")).json() == []
        for call in (
            stranger.get(f"{BASE}/{source.id}"),
            stranger.patch(f"{BASE}/{source.id}", json={"enabled": False}),
            stranger.post(f"{BASE}/{source.id}/run"),
            stranger.delete(f"{BASE}/{source.id}"),
        ):
            assert (await call).status_code == 404


@pytest.mark.asyncio
async def test_run_collects_the_folder_and_records_the_last_run(
    admin_client, db_session, db_seed, ingest_fs, run_redis
):
    created = await admin_client.post(
        BASE + "/", json=_local(ingest_fs["root"], processing_mode="archive")
    )
    source_id = created.json()["id"]
    before = await _documents(db_session, db_seed["tenant_id"])

    run = await admin_client.post(f"{BASE}/{source_id}/run")
    assert run.status_code == 200, run.text
    body = run.json()
    assert body["status"] == "success"
    assert body["source_id"] == source_id
    assert (body["total_found"], body["imported"], body["error_count"]) == (2, 2, 0)
    assert await _documents(db_session, db_seed["tenant_id"]) == before + 2

    saved = (await admin_client.get(f"{BASE}/{source_id}")).json()
    assert saved["last_run_status"] == "success"
    assert saved["last_run_at"] is not None
    assert saved["last_run_report"] == {
        "total_found": 2,
        "imported": 2,
        "skipped": 0,
        "error_count": 0,
        "duplicate_count": 0,
    }

    # A second run finds the same files already in the GED: nothing new.
    rerun = (await admin_client.post(f"{BASE}/{source_id}/run")).json()
    assert (rerun["imported"], rerun["duplicate_count"]) == (0, 2)
    assert await _documents(db_session, db_seed["tenant_id"]) == before + 2

    assert (await _actions(db_session, source_id)).count("ingestion_source_run") == 2
    # The lock is released after each run.
    assert (
        await run_redis.get(sources_module._run_lock_key(uuid.UUID(source_id))) is None
    )


@pytest.mark.asyncio
async def test_run_refused_while_locked_disabled_or_for_an_agent(
    admin_client, ingest_fs, run_redis
):
    source_id = (
        await admin_client.post(BASE + "/", json=_local(ingest_fs["lot"]))
    ).json()["id"]
    lock = sources_module._run_lock_key(uuid.UUID(source_id))
    await run_redis.set(lock, "1")
    assert (await admin_client.post(f"{BASE}/{source_id}/run")).status_code == 409
    await run_redis.delete(lock)

    await admin_client.patch(f"{BASE}/{source_id}", json={"enabled": False})
    assert (await admin_client.post(f"{BASE}/{source_id}/run")).status_code == 409

    agent = await admin_client.post(
        BASE + "/", json={"name": "Poste 12", "source_type": "agent"}
    )
    agent_run = await admin_client.post(f"{BASE}/{agent.json()['id']}/run")
    assert agent_run.status_code == 409


@pytest.mark.asyncio
async def test_a_run_does_not_free_a_lock_taken_by_another_run(
    admin_client, ingest_fs, run_redis, monkeypatch
):
    source_id = (
        await admin_client.post(BASE + "/", json=_local(ingest_fs["lot"]))
    ).json()["id"]
    lock = sources_module._run_lock_key(uuid.UUID(source_id))

    class _OutlivedItsLock:
        """The first run's lock expires and a second run takes it meanwhile."""

        def __init__(self, db):
            pass

        async def ingest(self, **params):
            await run_redis.set(lock, "jeton-de-la-seconde-collecte")
            empty = {
                "total_found": 0,
                "imported": 0,
                "skipped": 0,
                "error_count": 0,
                "errors": [],
                "details": [],
                "duplicate_count": 0,
            }
            return SimpleNamespace(to_dict=lambda: empty)

    monkeypatch.setattr(sources_module, "DirectoryIngestionService", _OutlivedItsLock)
    assert (await admin_client.post(f"{BASE}/{source_id}/run")).status_code == 200
    assert await run_redis.get(lock) in (
        "jeton-de-la-seconde-collecte",
        b"jeton-de-la-seconde-collecte",
    )


@pytest.mark.asyncio
async def test_run_refused_when_the_owner_is_disabled(
    admin_client, db_session, db_seed, ingest_fs, run_redis
):
    source_id = (
        await admin_client.post(BASE + "/", json=_local(ingest_fs["lot"]))
    ).json()["id"]
    owner = User.__table__.c
    await db_session.execute(
        update(User).where(owner.id == db_seed["user_id"]).values(is_active=False)
    )
    await db_session.commit()
    try:
        refused = await admin_client.post(f"{BASE}/{source_id}/run")
        assert refused.status_code == 409
        assert "owner" in refused.json()["detail"]
        # Refused before taking the lock: nothing to free, nothing recorded.
        assert (
            await run_redis.get(sources_module._run_lock_key(uuid.UUID(source_id)))
            is None
        )
        saved = (await admin_client.get(f"{BASE}/{source_id}")).json()
        assert saved["last_run_at"] is None
    finally:
        await db_session.execute(
            update(User).where(owner.id == db_seed["user_id"]).values(is_active=True)
        )
        await db_session.commit()


@pytest.mark.asyncio
async def test_run_records_a_failure_when_the_roots_changed(
    admin_client, ingest_fs, run_redis, monkeypatch
):
    source_id = (
        await admin_client.post(BASE + "/", json=_local(ingest_fs["lot"]))
    ).json()["id"]
    monkeypatch.setattr(settings, "INGEST_ALLOWED_ROOTS_STR", str(ingest_fs["outside"]))

    refused = await admin_client.post(f"{BASE}/{source_id}/run")
    assert refused.status_code == 403
    saved = (await admin_client.get(f"{BASE}/{source_id}")).json()
    assert saved["last_run_status"] == "failed"
    assert saved["last_run_report"]["error_count"] == 1
    assert (
        await run_redis.get(sources_module._run_lock_key(uuid.UUID(source_id))) is None
    )


@pytest.mark.asyncio
async def test_agent_key_is_shown_once_and_stored_hashed(admin_client, db_session):
    created = await admin_client.post(
        BASE + "/", json={"name": "Poste 12", "source_type": "agent"}
    )
    assert created.status_code == 201, created.text
    body = created.json()
    agent_key = body["agent_key"]
    assert agent_key and body["agent_key_prefix"] == agent_key[:12]
    assert body["path"] is None

    row = await db_session.get(IngestionSource, uuid.UUID(body["id"]))
    assert row.agent_key_hash == hashlib.sha256(agent_key.encode()).hexdigest()
    assert "agent_key" not in (await admin_client.get(f"{BASE}/{body['id']}")).json()
    assert agent_key not in (await admin_client.get(BASE + "/")).text

    rotated = (await admin_client.post(f"{BASE}/{body['id']}/rotate-key")).json()
    assert rotated["agent_key"] and rotated["agent_key"] != agent_key
    await db_session.refresh(row)
    assert (
        row.agent_key_hash == hashlib.sha256(rotated["agent_key"].encode()).hexdigest()
    )

    details = await db_session.execute(
        select(AuditLog.new_data).where(AuditLog.table_name == "ingestion_sources")
    )
    assert agent_key not in str(list(details.scalars()))
