"""Lot 13 (V1.1): « Mes dernières actions » — without journal access, one's own rows only."""

import uuid
from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.audit import AuditLog

LOGS = "/api/v1/audit/logs"


async def _seed(test_engine, db_seed) -> None:
    """Two rows by the seeded user, one system row (no user), one row of another tenant."""
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        for tenant_id, user_id, action, minute in (
            (db_seed["tenant_id"], db_seed["user_id"], "upload", 1),
            (db_seed["tenant_id"], db_seed["user_id"], "update", 2),
            (db_seed["tenant_id"], None, "dup_detected", 3),
            (uuid.uuid4(), db_seed["user_id"], "upload", 4),
        ):
            session.add(
                AuditLog(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    table_name="documents",
                    record_id=uuid.uuid4(),
                    action=action,
                    new_data={"title": f"note {action}", "secret": "brut"},
                    ip_address="10.0.0.7",
                    user_agent="navigateur",
                    created_at=datetime(2026, 11, 18, 9, minute),
                )
            )
        await session.commit()


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["collaborator", "manager"])
async def test_without_journal_access_one_sees_only_ones_own_rows(
    role, client_as, test_engine, db_seed
):
    await _seed(test_engine, db_seed)

    async with client_as(
        role, tenant_id=db_seed["tenant_id"], id=db_seed["user_id"]
    ) as client:
        response = await client.get(LOGS)

    assert response.status_code == 200, response.text
    rows = response.json()
    assert [row["action"] for row in rows] == ["update", "upload"]
    assert {row["user_id"] for row in rows} == {str(db_seed["user_id"])}
    assert rows[0]["resource_label"] == "note update"
    for row in rows:
        assert row["old_data"] is None and row["new_data"] is None
        assert row["ip_address"] is None and row["user_agent"] is None


@pytest.mark.asyncio
async def test_rows_of_others_stay_hidden(client_as, test_engine, db_seed):
    await _seed(test_engine, db_seed)

    async with client_as(
        "collaborator", tenant_id=db_seed["tenant_id"], id=uuid.uuid4()
    ) as client:
        response = await client.get(LOGS)

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["tenant_admin", "auditor"])
async def test_journal_readers_keep_the_whole_tenant_journal(
    role, client_as, test_engine, db_seed
):
    await _seed(test_engine, db_seed)

    async with client_as(
        role, tenant_id=db_seed["tenant_id"], id=uuid.uuid4()
    ) as client:
        rows = (await client.get(LOGS)).json()

    assert [row["action"] for row in rows] == ["dup_detected", "update", "upload"]
    assert rows[0]["ip_address"] == "10.0.0.7"
    assert rows[0]["new_data"]["secret"] == "brut"


@pytest.mark.asyncio
async def test_export_stays_reserved_to_journal_readers(client_as, db_seed):
    async with client_as(
        "manager", tenant_id=db_seed["tenant_id"], id=db_seed["user_id"]
    ) as client:
        assert (await client.get(f"{LOGS}/export")).status_code == 403
