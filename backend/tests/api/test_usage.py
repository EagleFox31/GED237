"""Caller scoping on ``/api/v1/usage``.

These routes carry no RBAC on purpose: every authenticated user records their
own telemetry and snapshot. The bounds tested here are authentication and the
user/tenant attribution. Nominal lifecycles live in ``test_reports_usage_coverage.py``.
"""

import uuid

import pytest
from httpx import AsyncClient

from app.core.security import hash_password
from app.models.user import User

USAGE = "/api/v1/usage"
SNAPSHOT = f"{USAGE}/local-arrangement-snapshot"


def _snapshot(snapshot_id: str):
    return {
        "id": snapshot_id,
        "created_at": 1_761_600_000_000,
        "destination": "Mes documents",
        "wrapper": None,
        "strategy": "by_type",
        "mode": "zip",
        "files": [],
        "total_files": 0,
        "total_folders": 0,
        "files_unranged": 0,
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "method, path",
    [
        ("post", "/local-organize"),
        ("get", "/local-arrangement-snapshot"),
        ("put", "/local-arrangement-snapshot"),
        ("delete", "/local-arrangement-snapshot"),
    ],
)
async def test_usage_routes_require_authentication(
    async_client: AsyncClient, method, path
):
    response = await async_client.request(method, USAGE + path)
    # FastAPI's HTTPBearer answers 403 when the header is missing (401 from 0.115).
    assert response.status_code in {401, 403}


@pytest.mark.asyncio
async def test_local_organize_event_is_attributed_to_the_caller(client_as, db_seed):
    async with client_as(
        "reader",
        id=db_seed["user_id"],
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        response = await client.post(
            f"{USAGE}/local-organize",
            json={
                "file_count": 2,
                "folders_created": 1,
                "files_unranged": 0,
                "strategy": "by_type",
                "mode": "zip",
                # Spoofed attribution must be ignored.
                "tenant_id": str(uuid.uuid4()),
                "user_id": str(uuid.uuid4()),
            },
        )
    assert response.status_code == 201
    assert response.json()["tenant_id"] == str(db_seed["tenant_id"])
    assert response.json()["user_id"] == str(db_seed["user_id"])


@pytest.mark.asyncio
async def test_local_arrangement_snapshot_is_private_to_each_user(
    client_as, db_session, db_seed
):
    colleague = User(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        role_id=db_seed["role_id"],
        matricule="COLL001",
        email="colleague@testministry.gov.cm",
        password_hash=hash_password("password123"),
        is_active=True,
    )
    db_session.add(colleague)
    await db_session.commit()

    def as_user(user_id):
        return client_as(
            "standard",
            id=user_id,
            tenant_id=db_seed["tenant_id"],
            org_unit_id=db_seed["org_unit_id"],
        )

    async with as_user(db_seed["user_id"]) as owner:
        assert (
            await owner.put(SNAPSHOT, json=_snapshot("owner-arr"))
        ).status_code == 200

    async with as_user(colleague.id) as other:
        unseen = await other.get(SNAPSHOT)
        # Deleting "my" snapshot must not touch someone else's.
        deleted = await other.delete(SNAPSHOT)

    async with as_user(db_seed["user_id"]) as owner:
        kept = await owner.get(SNAPSHOT)

    assert unseen.json() == {"snapshot": None}
    assert deleted.status_code == 204
    assert kept.json()["snapshot"]["id"] == "owner-arr"
