"""V1.1: free-text search ``q`` on the audit journal (list and CSV export)."""

import uuid
from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.audit import AuditLog
from app.models.user import User

LOGS = "/api/v1/audit/logs"
EXPORT = "/api/v1/audit/logs/export"


async def _seed(test_engine, db_seed) -> User:
    factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with factory() as session:
        actor = await session.get(User, db_seed["user_id"])
        for i, (action, title) in enumerate(
            (
                ("upload", "Rapport annuel"),
                ("delete", "100% fiable"),
                ("view", "budget_2026"),
                ("view", "budgetX2026"),
            )
        ):
            session.add(
                AuditLog(
                    tenant_id=db_seed["tenant_id"],
                    user_id=None,
                    table_name="documents",
                    record_id=uuid.uuid4(),
                    action=action,
                    new_data={"title": title},
                    created_at=datetime(2026, 11, 3, 8, i),
                )
            )
        session.add(
            AuditLog(
                tenant_id=db_seed["tenant_id"],
                user_id=actor.id,
                table_name="users",
                record_id=actor.id,
                action="login",
                new_data={},
                created_at=datetime(2026, 11, 4, 8, 0),
            )
        )
        await session.commit()
        return actor


async def _actions(client: AsyncClient, **params) -> list[str]:
    response = await client.get(LOGS, params=params)
    assert response.status_code == 200, response.text
    return sorted(row["action"] for row in response.json())


@pytest.mark.asyncio
async def test_empty_or_blank_q_changes_nothing(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed(test_engine, db_seed)
    everything = await _actions(admin_client)
    assert len(everything) >= 5
    assert await _actions(admin_client, q="") == everything
    assert await _actions(admin_client, q="   ") == everything


@pytest.mark.asyncio
async def test_matches_object_label_action_and_actor(
    admin_client: AsyncClient, test_engine, db_seed
):
    actor = await _seed(test_engine, db_seed)

    assert await _actions(admin_client, q="RAPPORT ann") == ["upload"]
    assert await _actions(admin_client, q="delet") == ["delete"]
    by_matricule = await _actions(admin_client, q=actor.matricule)
    assert "login" in by_matricule
    if actor.email:
        assert "login" in await _actions(admin_client, q=actor.email.upper())


@pytest.mark.asyncio
async def test_wildcards_are_taken_literally(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed(test_engine, db_seed)

    assert await _actions(admin_client, q="%") == ["delete"]
    assert await _actions(admin_client, q="100%") == ["delete"]
    assert await _actions(admin_client, q="budget_2026") == ["view"]
    assert await _actions(admin_client, q="_") == ["view"]
    assert await _actions(admin_client, q="\\") == []


@pytest.mark.asyncio
async def test_combines_with_other_filters(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed(test_engine, db_seed)

    assert await _actions(admin_client, q="budget", action="view") == ["view", "view"]
    assert await _actions(admin_client, q="budget", action="upload") == []
    assert await _actions(admin_client, q="budget", table_name="users") == []


@pytest.mark.asyncio
async def test_q_longer_than_100_chars_is_422(admin_client: AsyncClient):
    assert (await admin_client.get(LOGS, params={"q": "a" * 101})).status_code == 422
    assert (await admin_client.get(LOGS, params={"q": "a" * 100})).status_code == 200


@pytest.mark.asyncio
async def test_other_tenant_sees_nothing(client_as, test_engine, db_seed):
    actor = await _seed(test_engine, db_seed)

    async with client_as("auditor", tenant_id=uuid.uuid4(), id=uuid.uuid4()) as client:
        assert await _actions(client, q="Rapport") == []
        assert await _actions(client, q=actor.matricule) == []


@pytest.mark.asyncio
async def test_export_uses_the_same_search(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed(test_engine, db_seed)

    response = await admin_client.get(EXPORT, params={"q": "Rapport"})

    assert response.status_code == 200
    text = response.content.decode("utf-8-sig")
    assert "Rapport annuel" in text
    assert "budget" not in text
