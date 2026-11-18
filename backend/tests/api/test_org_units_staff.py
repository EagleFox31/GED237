"""Org tree with head and headcount (V1.2, item 12).

The deduction rule is unit-tested in tests/services/test_org_unit_staff.py; here,
the route payload and who sees it.
"""

import uuid

import pytest

from app.models.org_unit import OrgUnit
from app.models.user import User

TREE = "/api/v1/org-units/tree"


async def _unit(db_session, db_seed, code):
    unit = OrgUnit(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        parent_id=db_seed["org_unit_id"],
        code=code,
        name=f"Service {code}",
        level=2,
        is_active=True,
    )
    db_session.add(unit)
    await db_session.commit()
    return unit


async def _member(db_session, db_seed, unit, name, reports_to=None, active=True):
    user = User(
        id=uuid.uuid4(),
        email=f"{name}-{uuid.uuid4().hex[:6]}@example.com",
        password_hash="x",
        first_name=name.title(),
        last_name="Unite",
        matricule=f"U-{uuid.uuid4().hex[:8]}",
        role_id=3,
        tenant_id=db_seed["tenant_id"],
        org_unit_id=unit.id,
        reports_to_user_id=reports_to,
        is_active=active,
    )
    db_session.add(user)
    await db_session.commit()
    return user


def _find(nodes, unit_id):
    for node in nodes:
        if node["id"] == str(unit_id):
            return node
        found = _find(node["children"], unit_id)
        if found:
            return found
    return None


@pytest.fixture
async def units(db_session, db_seed):
    """One unit with a clear head, one with two candidates, one empty."""
    led = await _unit(db_session, db_seed, "SRV-LED")
    chef = await _member(db_session, db_seed, led, "chef")
    await _member(db_session, db_seed, led, "agent", chef.id)
    await _member(db_session, db_seed, led, "agent2", chef.id)
    await _member(db_session, db_seed, led, "parti", chef.id, active=False)

    shared = await _unit(db_session, db_seed, "SRV-TWO")
    await _member(db_session, db_seed, shared, "interim")
    await _member(db_session, db_seed, shared, "adjoint")

    empty = await _unit(db_session, db_seed, "SRV-EMPTY")
    return {"led": led, "chef": chef, "shared": shared, "empty": empty}


async def _tree_as(client_as, db_seed, role):
    async with client_as(role, tenant_id=db_seed["tenant_id"]) as client:
        return await client.get(TREE)


@pytest.mark.asyncio
async def test_a_unit_with_one_candidate_shows_its_head_and_active_count(
    client_as, db_seed, units
):
    response = await _tree_as(client_as, db_seed, "tenant_admin")
    assert response.status_code == 200
    led = _find(response.json(), units["led"].id)
    assert led["users_count"] == 3  # the inactive member is not counted
    assert led["head"] == {
        "id": str(units["chef"].id),
        "full_name": units["chef"].full_name,
    }


@pytest.mark.asyncio
async def test_two_candidates_or_none_give_no_head(client_as, db_seed, units):
    response = await _tree_as(client_as, db_seed, "tenant_admin")
    shared = _find(response.json(), units["shared"].id)
    empty = _find(response.json(), units["empty"].id)
    assert (shared["users_count"], shared["head"]) == (2, None)
    assert (empty["users_count"], empty["head"]) == (0, None)


@pytest.mark.asyncio
async def test_the_auditor_keeps_the_whole_tenant_tree(client_as, db_seed, units):
    response = await _tree_as(client_as, db_seed, "auditor")
    assert response.status_code == 200
    for key in ("led", "shared", "empty"):
        assert _find(response.json(), units[key].id) is not None
    assert _find(response.json(), units["led"].id)["head"]["id"] == str(
        units["chef"].id
    )
