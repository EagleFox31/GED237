"""Organisation tree seen by role: unit_admin sees its unit and the units below it.

Tree, in the seeded institution: A (seeded unit) > A1 > A2, and B beside A.
Same answer on GET /org-units/, /org-units/tree, /org-units/{id} and /spaces/tree;
tenant_admin keeps the whole institution, unit_admin without a unit sees nothing.
"""

import uuid

import pytest
import pytest_asyncio

from app.models.org_unit import OrgUnit

LIST = "/api/v1/org-units/"
TREE = "/api/v1/org-units/tree"
SPACES_TREE = "/api/v1/spaces/tree"
BY_ID = "/api/v1/org-units/{}"


async def _unit(db, tenant_id, parent=None) -> uuid.UUID:
    unit_id = uuid.uuid4()
    db.add(
        OrgUnit(
            id=unit_id,
            tenant_id=tenant_id,
            parent_id=parent,
            code=f"OU-{str(unit_id)[:8]}",
            name=f"Service {str(unit_id)[:8]}",
            level=2 if parent else 1,
            is_active=True,
        )
    )
    await db.flush()
    return unit_id


@pytest_asyncio.fixture
async def units(db_session, db_seed):
    tenant_id = db_seed["tenant_id"]
    found = {"a": db_seed["org_unit_id"]}
    found["a1"] = await _unit(db_session, tenant_id, found["a"])
    found["a2"] = await _unit(db_session, tenant_id, found["a1"])
    found["b"] = await _unit(db_session, tenant_id)
    await db_session.commit()
    return found


def _flatten(nodes) -> set[str]:
    out = set()
    for node in nodes:
        out.add(node["id"])
        out |= _flatten(node["children"])
    return out


def _caller(db_seed, units, unit="a1"):
    return {"tenant_id": db_seed["tenant_id"], "org_unit_id": units[unit]}


@pytest.mark.asyncio
async def test_unit_admin_sees_its_subtree_only(client_as, db_seed, units):
    expected = {str(units["a1"]), str(units["a2"])}
    async with client_as("unit_admin", **_caller(db_seed, units)) as client:
        listed = {u["id"] for u in (await client.get(LIST)).json()}
        tree = (await client.get(TREE)).json()
        spaces = (await client.get(SPACES_TREE)).json()
        inside = await client.get(BY_ID.format(units["a2"]))
        outside = await client.get(BY_ID.format(units["b"]))
        above = await client.get(BY_ID.format(units["a"]))

    assert listed == expected
    assert _flatten(tree) == expected
    assert _flatten(spaces) == expected
    # Its own unit is the root of what it sees, even though it has a parent.
    assert [n["id"] for n in tree] == [str(units["a1"])]
    assert inside.status_code == 200
    assert outside.status_code == 404
    assert above.status_code == 404


@pytest.mark.asyncio
async def test_tenant_admin_keeps_the_whole_institution(client_as, db_seed, units):
    async with client_as("tenant_admin", **_caller(db_seed, units)) as client:
        listed = {
            u["id"] for u in (await client.get(LIST, params={"limit": 100})).json()
        }
        tree = (await client.get(TREE)).json()
        outside = await client.get(BY_ID.format(units["b"]))

    assert {str(units[k]) for k in ("a", "a1", "a2", "b")} <= listed
    assert {str(units[k]) for k in ("a", "a1", "a2", "b")} <= _flatten(tree)
    assert outside.status_code == 200


@pytest.mark.asyncio
async def test_unit_admin_without_unit_sees_no_unit(client_as, db_seed, units):
    async with client_as(
        "unit_admin", tenant_id=db_seed["tenant_id"], org_unit_id=None
    ) as client:
        listed = (await client.get(LIST)).json()
        tree = (await client.get(TREE)).json()

    assert listed == []
    assert tree == []
