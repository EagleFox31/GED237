"""Authorization bounds, tree and delete guards on ``/api/v1/org-units``.

Nominal CRUD and the child-unit delete guard live in ``test_admin_crud_coverage.py``.
"""

import uuid

import pytest
from httpx import AsyncClient

from app.models.org_unit import OrgUnit, OrgUnitType
from app.models.tenant import Tenant

ORG_UNITS = "/api/v1/org-units"


def _unit_payload(db_seed, **overrides):
    payload = {
        "tenant_id": str(db_seed["tenant_id"]),
        "parent_id": str(db_seed["org_unit_id"]),
        "code": "SRV-NEW",
        "name": "Service Nouveau",
        "level": 2,
        "is_active": True,
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "method, path",
    [
        ("get", "/types"),
        ("get", "/tree"),
        ("get", "/"),
        ("post", "/"),
        ("get", "/{id}"),
        ("patch", "/{id}"),
        ("delete", "/{id}"),
    ],
)
async def test_org_unit_routes_require_authentication(
    async_client: AsyncClient, method, path
):
    url = ORG_UNITS + path.format(id=uuid.uuid4())
    response = await async_client.request(method, url)
    # FastAPI's HTTPBearer answers 403 when the header is missing (401 from 0.115).
    assert response.status_code in {401, 403}


@pytest.mark.asyncio
@pytest.mark.parametrize("role_code", ["manager", "reader", "standard"])
async def test_roles_without_org_units_permission_are_denied(
    client_as, db_seed, role_code
):
    target = f"{ORG_UNITS}/{db_seed['org_unit_id']}"
    async with client_as(
        role_code,
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        responses = [
            await client.get(f"{ORG_UNITS}/tree"),
            await client.get(target),
            await client.post(f"{ORG_UNITS}/", json=_unit_payload(db_seed)),
            await client.patch(target, json={"name": "Denied"}),
            await client.delete(target),
        ]
    assert [r.status_code for r in responses] == [403] * len(responses)


@pytest.mark.asyncio
async def test_unit_admin_reads_org_units_but_cannot_change_them(client_as, db_seed):
    target = f"{ORG_UNITS}/{db_seed['org_unit_id']}"
    async with client_as(
        "unit_admin",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        tree = await client.get(f"{ORG_UNITS}/tree")
        fetched = await client.get(target)
        denied = [
            await client.post(f"{ORG_UNITS}/", json=_unit_payload(db_seed)),
            await client.patch(target, json={"name": "Denied"}),
            await client.delete(target),
        ]
    assert tree.status_code == 200
    assert [node["id"] for node in tree.json()] == [str(db_seed["org_unit_id"])]
    assert fetched.status_code == 200
    assert [r.status_code for r in denied] == [403] * len(denied)


@pytest.mark.asyncio
async def test_tenant_admin_cannot_reach_org_units_of_another_tenant(
    client_as, db_seed
):
    target = f"{ORG_UNITS}/{db_seed['org_unit_id']}"
    foreign_tenant = {"tenant_id": str(db_seed["tenant_id"])}
    async with client_as("tenant_admin", tenant_id=uuid.uuid4()) as client:
        # Out-of-tenant units are invisible (404), not merely forbidden.
        hidden = [
            await client.get(target),
            await client.patch(target, json={"name": "Hijack"}),
            await client.delete(target),
        ]
        # The tenant_id filter is reserved to super_admin and ignored here.
        listing = await client.get(f"{ORG_UNITS}/", params=foreign_tenant)
        tree = await client.get(f"{ORG_UNITS}/tree", params=foreign_tenant)
        created = await client.post(f"{ORG_UNITS}/", json=_unit_payload(db_seed))

    assert [r.status_code for r in hidden] == [404] * len(hidden)
    assert listing.json() == []
    assert tree.json() == []
    assert created.status_code == 403


@pytest.mark.asyncio
async def test_org_unit_tree_nests_active_children_per_tenant(
    admin_client: AsyncClient, db_session, db_seed
):
    other_tenant_id = uuid.uuid4()
    db_session.add(
        Tenant(
            id=other_tenant_id,
            name="Other Ministry",
            short_name="OTHMIN",
            domain="other-ministry.gov.cm",
            is_active=True,
        )
    )
    await db_session.commit()
    db_session.add(
        OrgUnit(
            id=uuid.uuid4(),
            tenant_id=other_tenant_id,
            code="DIR-OTHER",
            name="Direction Autre",
            level=1,
            is_active=True,
        )
    )
    await db_session.commit()

    child = await admin_client.post(f"{ORG_UNITS}/", json=_unit_payload(db_seed))
    inactive = await admin_client.post(
        f"{ORG_UNITS}/",
        json=_unit_payload(
            db_seed, code="SRV-OFF", name="Service Ferme", is_active=False
        ),
    )
    assert child.status_code == 201
    assert inactive.status_code == 201

    own = await admin_client.get(f"{ORG_UNITS}/tree")
    assert own.status_code == 200
    [root] = own.json()
    assert root["id"] == str(db_seed["org_unit_id"])
    assert [node["id"] for node in root["children"]] == [child.json()["id"]]

    # super_admin may read another tenant's tree.
    other = await admin_client.get(
        f"{ORG_UNITS}/tree", params={"tenant_id": str(other_tenant_id)}
    )
    assert [node["code"] for node in other.json()] == ["DIR-OTHER"]


@pytest.mark.asyncio
async def test_org_unit_delete_blocked_while_active_users_attached(
    admin_client: AsyncClient, db_seed
):
    response = await admin_client.delete(f"{ORG_UNITS}/{db_seed['org_unit_id']}")
    assert response.status_code == 409
    assert "active user" in response.json()["detail"]


@pytest.mark.asyncio
async def test_org_unit_types_are_ordered_by_level(client_as, db_session, db_seed):
    db_session.add_all(
        [
            OrgUnitType(code="service", label="Service", level=3),
            OrgUnitType(code="ministere", label="Ministère", level=1),
            OrgUnitType(code="direction", label="Direction", level=2),
        ]
    )
    await db_session.commit()

    # Any authenticated role may read this reference list.
    async with client_as("reader", tenant_id=db_seed["tenant_id"]) as client:
        response = await client.get(f"{ORG_UNITS}/types")

    assert response.status_code == 200
    assert [row["code"] for row in response.json()] == [
        "ministere",
        "direction",
        "service",
    ]
