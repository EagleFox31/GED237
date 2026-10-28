import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.models.audit import AuditLog
from app.models.local_organize_event import LocalOrganizeEvent


def _snapshot_payload(**overrides):
    payload = {
        "id": "arr-001",
        "created_at": 1_761_600_000_000,
        "destination": "Mes documents",
        "wrapper": None,
        "strategy": "by_type",
        "mode": "zip",
        "files": [
            {
                "name": "note.pdf",
                "folder_path": "PDF",
                "size": 1024,
                "last_modified": 1_761_600_000_000,
            }
        ],
        "total_files": 1,
        "total_folders": 1,
        "files_unranged": 0,
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_local_organize_event_is_persisted_and_audited(
    admin_client: AsyncClient, db_session, db_seed
):
    created = await admin_client.post(
        "/api/v1/usage/local-organize",
        json={
            "file_count": 12,
            "folders_created": 3,
            "files_unranged": 1,
            "strategy": "by_type_year",
            "mode": "fsa",
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["tenant_id"] == str(db_seed["tenant_id"])
    assert body["file_count"] == 12

    events = await db_session.scalar(select(func.count(LocalOrganizeEvent.id)))
    audits = await db_session.scalar(
        select(func.count(AuditLog.id)).where(AuditLog.action == "local_organize")
    )
    assert events == 1
    assert audits == 1

    invalid = await admin_client.post(
        "/api/v1/usage/local-organize",
        json={
            "file_count": -1,
            "folders_created": 0,
            "files_unranged": 0,
            "strategy": "by_type",
            "mode": "zip",
        },
    )
    assert invalid.status_code == 422


@pytest.mark.asyncio
async def test_local_arrangement_snapshot_lifecycle(admin_client: AsyncClient):
    empty = await admin_client.get("/api/v1/usage/local-arrangement-snapshot")
    assert empty.status_code == 200
    assert empty.json() == {"snapshot": None}

    created = await admin_client.put(
        "/api/v1/usage/local-arrangement-snapshot", json=_snapshot_payload()
    )
    assert created.status_code == 200
    assert created.json()["snapshot"]["id"] == "arr-001"

    # Second PUT replaces the single row kept per user.
    replaced = await admin_client.put(
        "/api/v1/usage/local-arrangement-snapshot",
        json=_snapshot_payload(id="arr-002", total_files=2),
    )
    assert replaced.status_code == 200

    fetched = await admin_client.get("/api/v1/usage/local-arrangement-snapshot")
    assert fetched.json()["snapshot"]["id"] == "arr-002"
    assert fetched.json()["snapshot"]["files"][0]["name"] == "note.pdf"

    deleted = await admin_client.delete("/api/v1/usage/local-arrangement-snapshot")
    assert deleted.status_code == 204

    after = await admin_client.get("/api/v1/usage/local-arrangement-snapshot")
    assert after.json() == {"snapshot": None}


@pytest.mark.asyncio
@pytest.mark.parametrize("granularity", ["day", "week", "month"])
async def test_reports_evolution_granularities(
    admin_client: AsyncClient, db_seed, granularity
):
    response = await admin_client.get(
        "/api/v1/reports/evolution",
        params={
            "date_from": "2026-01-01",
            "date_to": "2026-03-15",
            "granularity": granularity,
            "tenant_id": str(db_seed["tenant_id"]),
            "org_unit_id": str(db_seed["org_unit_id"]),
            "recursive": True,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["filters"]["granularity"] == granularity
    assert body["series"]["documents_created"]
    assert all(point["value"] == 0 for point in body["series"]["documents_created"])


@pytest.mark.asyncio
async def test_reports_evolution_rejects_inverted_period(admin_client: AsyncClient):
    response = await admin_client.get(
        "/api/v1/reports/evolution",
        params={"date_from": "2026-03-01", "date_to": "2026-01-01"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path", ["document-activity", "workflow-activity", "service-activity"]
)
async def test_reports_activity_panels(admin_client: AsyncClient, db_seed, path):
    await admin_client.post(
        "/api/v1/usage/local-organize",
        json={
            "file_count": 4,
            "folders_created": 2,
            "files_unranged": 0,
            "strategy": "by_type",
            "mode": "zip",
        },
    )

    tenant_wide = await admin_client.get(f"/api/v1/reports/{path}")
    assert tenant_wide.status_code == 200

    scoped = await admin_client.get(
        f"/api/v1/reports/{path}",
        params={
            "org_unit_id": str(db_seed["org_unit_id"]),
            "recursive": True,
            "document_category_id": str(db_seed["category_id"]),
        },
    )
    assert scoped.status_code == 200
