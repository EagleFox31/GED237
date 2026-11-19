"""Hierarchy tree (V1.2, item 11): N-2 and beyond in one call, scope in cascade.

Rights as in #285: without users:read, oneself and one's N-1 only, anything else
404 (#247 rule). The cap and the cascade logic are unit-tested in
tests/services/test_hierarchy_tree.py; here, the route and its rights.
"""

import uuid

import pytest

from app.models.user import User

USERS = "/api/v1/users"


async def _add_user(db_session, db_seed, name: str, reports_to=None):
    user = User(
        id=uuid.uuid4(),
        email=f"{name}-{uuid.uuid4().hex[:6]}@example.com",
        password_hash="x",
        first_name=name.title(),
        last_name="Arbre",
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


def _tree(client, user, **params):
    return client.get(f"{USERS}/{user.id}/hierarchy-tree", params=params)


def _ids(nodes):
    return [n["id"] for n in nodes]


@pytest.mark.asyncio
async def test_with_users_read_the_default_depth_is_two_levels(
    client_as, db_seed, team
):
    async with _as(client_as, db_seed, "unit_admin", team["neighbour"]) as client:
        response = await _tree(client, team["boss"])
    assert response.status_code == 200
    root = response.json()["root"]
    assert root["id"] == str(team["boss"].id)
    assert root["reports_count"] == 2
    manager = next(n for n in root["children"] if n["id"] == str(team["manager"].id))
    assert set(manager) == {
        "id",
        "full_name",
        "matricule",
        "role_label",
        "reports_count",
        "children",
    }
    assert _ids(manager["children"]) == [str(team["agent"].id)]
    agent = manager["children"][0]
    # N-3 (intern) is not loaded yet: same call with agent as the root.
    assert agent["reports_count"] == 1 and agent["children"] is None


@pytest.mark.asyncio
async def test_depth_three_reaches_n3(client_as, db_seed, team):
    async with _as(client_as, db_seed, "unit_admin", team["neighbour"]) as client:
        response = await _tree(client, team["boss"], depth=3)
    manager = next(
        n
        for n in response.json()["root"]["children"]
        if n["id"] == str(team["manager"].id)
    )
    agent = manager["children"][0]
    assert _ids(agent["children"]) == [str(team["intern"].id)]
    assert agent["children"][0]["children"] == []


@pytest.mark.asyncio
async def test_without_users_read_oneself_and_n1_only(client_as, db_seed, team):
    async with _as(client_as, db_seed, "manager", team["manager"]) as client:
        response = await _tree(client, team["manager"], depth=6)
    assert response.status_code == 200
    root = response.json()["root"]
    assert _ids(root["children"]) == [str(team["agent"].id)]
    agent = root["children"][0]
    # N-2 is beyond reach: neither listed nor counted.
    assert agent["reports_count"] == 0 and agent["children"] == []


@pytest.mark.asyncio
async def test_without_users_read_an_n1_root_shows_no_subordinate(
    client_as, db_seed, team
):
    async with _as(client_as, db_seed, "manager", team["manager"]) as client:
        response = await _tree(client, team["agent"])
    assert response.status_code == 200
    root = response.json()["root"]
    assert root["reports_count"] == 0 and root["children"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize("target", ["intern", "neighbour", "boss"])
async def test_without_users_read_beyond_the_team_is_not_found(
    client_as, db_seed, team, target
):
    async with _as(client_as, db_seed, "manager", team["manager"]) as client:
        response = await _tree(client, team[target])
    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize("depth", [0, 7])
async def test_depth_is_bounded(client_as, db_seed, team, depth):
    async with _as(client_as, db_seed, "unit_admin", team["neighbour"]) as client:
        response = await _tree(client, team["boss"], depth=depth)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_an_unknown_user_is_not_found(client_as, db_seed, team):
    async with _as(client_as, db_seed, "unit_admin", team["neighbour"]) as client:
        response = await client.get(
            f"{USERS}/00000000-0000-0000-0000-000000000000/hierarchy-tree"
        )
    assert response.status_code == 404
