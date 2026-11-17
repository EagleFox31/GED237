"""My team (#277): everyone reads their own chain, a manager that of their direct reports.

Without users:read, anyone else is out of reach and answers 404 (#247 rule).
"""

import uuid

import pytest

from app.models.user import User

USERS = "/api/v1/users"


async def _add_user(
    db_session, db_seed, name: str, reports_to: uuid.UUID | None = None
):
    user = User(
        id=uuid.uuid4(),
        email=f"{name}-{uuid.uuid4().hex[:6]}@team.test",
        password_hash="x",
        first_name=name.title(),
        last_name="Equipe",
        matricule=f"T-{uuid.uuid4().hex[:8]}",
        role_id=3,
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        reports_to_user_id=reports_to,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
async def team(db_session, db_seed):
    """boss > manager > agent > intern, plus a neighbour who reports to boss."""
    boss = await _add_user(db_session, db_seed, "boss")
    manager = await _add_user(db_session, db_seed, "manager", boss.id)
    agent = await _add_user(db_session, db_seed, "agent", manager.id)
    intern = await _add_user(db_session, db_seed, "intern", agent.id)
    neighbour = await _add_user(db_session, db_seed, "neighbour", boss.id)
    return {u.first_name.lower(): u for u in (boss, manager, agent, intern, neighbour)}


def _as(client_as, db_seed, role_code, user):
    return client_as(
        role_code,
        id=user.id,
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    )


async def _chains(client, user) -> tuple:
    up = await client.get(f"{USERS}/{user.id}/hierarchy-up")
    down = await client.get(f"{USERS}/{user.id}/hierarchy-down")
    return up, down


@pytest.mark.asyncio
async def test_anyone_reads_their_own_chain_and_team(client_as, db_seed, team):
    async with _as(client_as, db_seed, "collaborator", team["agent"]) as client:
        up, down = await _chains(client, team["agent"])
    assert up.status_code == 200 and down.status_code == 200
    assert [u["id"] for u in up.json()] == [
        str(team["manager"].id),
        str(team["boss"].id),
    ]
    assert [u["id"] for u in down.json()] == [str(team["intern"].id)]


@pytest.mark.asyncio
async def test_a_manager_reads_the_chains_of_a_direct_report(client_as, db_seed, team):
    async with _as(client_as, db_seed, "manager", team["manager"]) as client:
        up, down = await _chains(client, team["agent"])
    assert up.status_code == 200 and down.status_code == 200
    assert [u["id"] for u in down.json()] == [str(team["intern"].id)]


@pytest.mark.asyncio
@pytest.mark.parametrize("target", ["intern", "neighbour", "boss"])
async def test_beyond_the_direct_team_is_not_found(client_as, db_seed, team, target):
    """N-2, a neighbour and one's own boss are all out of reach without users:read."""
    async with _as(client_as, db_seed, "manager", team["manager"]) as client:
        up, down = await _chains(client, team[target])
    assert (up.status_code, down.status_code) == (404, 404)


@pytest.mark.asyncio
async def test_a_role_with_users_read_keeps_reading_every_chain(
    client_as, db_seed, team
):
    async with _as(client_as, db_seed, "unit_admin", team["neighbour"]) as client:
        up, down = await _chains(client, team["intern"])
    assert (up.status_code, down.status_code) == (200, 200)
