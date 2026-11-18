"""unit_admin only reaches the users of its unit and sub-units (decision PO 18/11, élément 13).

Tree in the seeded institution: A (seeded unit, the caller's) > A1, and B beside A.
Outside the tree a route answers 404 (the user is not visible), inside it is not 404.
No row is written to org_unit_closure: the scope rests on ``parent_id`` alone.
"""

import uuid

import pytest
import pytest_asyncio

from app.models.org_unit import OrgUnit
from app.models.user import User

USERS = "/api/v1/users/"


async def _unit(db, tenant_id, parent=None) -> uuid.UUID:
    unit_id = uuid.uuid4()
    db.add(
        OrgUnit(
            id=unit_id,
            tenant_id=tenant_id,
            parent_id=parent,
            code=f"OU-{unit_id.hex[:8]}",
            name=f"Service {unit_id.hex[:8]}",
            level=2 if parent else 1,
            is_active=True,
        )
    )
    await db.flush()
    return unit_id


async def _user(db, db_seed, unit_id, name) -> uuid.UUID:
    seeded = await db.get(User, db_seed["user_id"])
    user_id = uuid.uuid4()
    db.add(
        User(
            id=user_id,
            tenant_id=db_seed["tenant_id"],
            org_unit_id=unit_id,
            role_id=seeded.role_id,
            matricule=f"{name}-{user_id.hex[:6]}",
            email=f"{name}.{user_id.hex[:6]}@example.com",
            first_name=name,
            last_name="Test",
            password_hash="unused",
            is_active=True,
        )
    )
    await db.flush()
    return user_id


@pytest_asyncio.fixture
async def tree(db_session, db_seed):
    tenant_id = db_seed["tenant_id"]
    a = db_seed["org_unit_id"]
    a1 = await _unit(db_session, tenant_id, a)
    b = await _unit(db_session, tenant_id)
    found = {
        "a": a,
        "inside": await _user(db_session, db_seed, a1, "Dedans"),
        "outside": await _user(db_session, db_seed, b, "Dehors"),
        "b": b,
        "a1": a1,
    }
    await db_session.commit()  # the API reads through its own session
    return found


def _caller(client_as, db_seed, tree):
    return client_as(
        "unit_admin", tenant_id=db_seed["tenant_id"], org_unit_id=tree["a"]
    )


# method, path template, json body
ROUTES = [
    ("GET", "{id}", None),
    ("PATCH", "{id}", {"first_name": "Renomme"}),
    ("DELETE", "{id}", None),
    ("POST", "{id}/reset-password", None),
    ("POST", "{id}/toggle-active", None),
    ("POST", "{id}/disable-mfa", None),
    ("GET", "{id}/hierarchy-up", None),
    ("GET", "{id}/hierarchy-down", None),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("method,path,body", ROUTES)
async def test_route_hides_users_outside_the_tree(
    client_as, db_seed, tree, method, path, body
):
    async with _caller(client_as, db_seed, tree) as client:
        outside = await client.request(
            method, USERS + path.format(id=tree["outside"]), json=body
        )
        inside = await client.request(
            method, USERS + path.format(id=tree["inside"]), json=body
        )

    assert outside.status_code == 404, outside.text
    assert inside.status_code != 404, inside.text


@pytest.mark.asyncio
async def test_list_keeps_the_tree_and_ignores_a_foreign_unit_filter(
    client_as, db_seed, tree
):
    async with _caller(client_as, db_seed, tree) as client:
        listed = (await client.get(USERS, params={"limit": 500})).json()
        foreign = await client.get(USERS, params={"org_unit_id": str(tree["b"])})

    ids = {row["id"] for row in listed}
    assert str(tree["inside"]) in ids
    assert str(tree["outside"]) not in ids
    assert foreign.status_code in (200, 403)
    if foreign.status_code == 200:
        assert foreign.json() == []


@pytest.mark.asyncio
async def test_tenant_admin_still_sees_every_unit(client_as, db_seed, tree):
    async with client_as("tenant_admin", tenant_id=db_seed["tenant_id"]) as client:
        listed = (await client.get(USERS, params={"limit": 500})).json()
        one = await client.get(USERS + str(tree["outside"]))

    assert str(tree["outside"]) in {row["id"] for row in listed}
    assert one.status_code == 200


def _new_user(db_seed, unit_id):
    return {
        "matricule": f"NEW-{uuid.uuid4().hex[:6]}",
        "first_name": "Nouveau",
        "last_name": "Compte",
        "role_code": "reader",
        "tenant_id": str(db_seed["tenant_id"]),
        "org_unit_id": str(unit_id),
    }


@pytest.mark.asyncio
async def test_unit_admin_cannot_create_a_user_outside_the_tree(
    client_as, db_seed, tree
):
    async with _caller(client_as, db_seed, tree) as client:
        outside = await client.post(USERS, json=_new_user(db_seed, tree["b"]))

    assert outside.status_code in (403, 404), outside.text


@pytest.mark.asyncio
async def test_unit_admin_cannot_move_a_user_outside_the_tree(client_as, db_seed, tree):
    async with _caller(client_as, db_seed, tree) as client:
        outside = await client.patch(
            USERS + str(tree["inside"]), json={"org_unit_id": str(tree["b"])}
        )

    assert outside.status_code in (403, 404), outside.text
