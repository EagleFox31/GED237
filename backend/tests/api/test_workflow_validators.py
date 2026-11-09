"""``GET /workflows/validators`` and ``current_version_id`` in pending tasks (P8)."""

import io
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User

VALIDATORS = "/api/v1/workflows/validators"


def _user(tenant_id, role_id, first, last, **extra):
    uid = uuid.uuid4()
    base = dict(
        id=uid,
        tenant_id=tenant_id,
        role_id=role_id,
        matricule=f"VAL-{uid.hex[:8]}",
        email=f"{uid.hex[:8]}@testministry.gov.cm",
        password_hash="x",
        first_name=first,
        last_name=last,
        is_active=True,
    )
    base.update(extra)
    return User(**base)


@pytest_asyncio.fixture
async def validators_seed(test_engine, db_seed):
    """Two eligible validators in the tenant, plus decoys: an inactive
    manager, a user with the default role, and a manager of another tenant."""
    tenant_id = db_seed["tenant_id"]
    other_tenant_id = uuid.uuid4()
    factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with factory() as session:
        manager = Role(id=71, code="manager", label="Manager", hierarchy_level=4)
        tenant_admin = Role(
            id=72, code="tenant_admin", label="Admin", hierarchy_level=2
        )
        session.add_all(
            [
                manager,
                tenant_admin,
                Tenant(
                    id=other_tenant_id,
                    name="Other Ministry",
                    short_name="OTHER",
                    domain=f"other-{other_tenant_id}.gov.cm",
                    is_active=True,
                ),
            ]
        )
        await session.flush()
        users = {
            "manager": _user(tenant_id, manager.id, "Marie", "Valideuse"),
            "admin": _user(tenant_id, tenant_admin.id, "Albert", "Admin"),
            "inactive": _user(tenant_id, manager.id, "Ina", "Ctive", is_active=False),
            "author": _user(tenant_id, db_seed["role_id"], "Auteur", "Simple"),
            "foreign": _user(other_tenant_id, manager.id, "Fo", "Reign"),
        }
        session.add_all(users.values())
        await session.commit()
    return {name: str(u.id) for name, u in users.items()}


@pytest.mark.asyncio
async def test_author_lists_tenant_validators_only(
    auth_client: AsyncClient, validators_seed
):
    response = await auth_client.get(VALIDATORS)
    assert response.status_code == 200, response.text
    items = response.json()
    ids = {item["id"] for item in items}
    assert {validators_seed["manager"], validators_seed["admin"]} <= ids
    for decoy in ("inactive", "author", "foreign"):
        assert validators_seed[decoy] not in ids, decoy
    # Least privilege: only what the picker needs.
    assert all(set(item) == {"id", "full_name"} for item in items)
    marie = next(i for i in items if i["id"] == validators_seed["manager"])
    assert marie["full_name"] == "Marie Valideuse"


@pytest.mark.asyncio
async def test_reader_cannot_list_validators(client_as, db_seed, validators_seed):
    async with client_as("reader", tenant_id=db_seed["tenant_id"]) as client:
        response = await client.get(VALIDATORS)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_other_tenant_sees_no_validator_of_ours(client_as, validators_seed):
    # A tenant-wide role of a third tenant: bounded to its own (empty) tenant.
    async with client_as("tenant_admin", tenant_id=uuid.uuid4()) as client:
        response = await client.get(VALIDATORS)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_pending_task_exposes_current_version_id(
    auth_client: AsyncClient, db_seed
):
    """Regression (VAL-D2): the validator's screen posts the version it
    reads in the pending task; without it the action was a 422."""
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("v.txt", io.BytesIO(b"version test"), "text/plain")},
        data={"title": "Version Test"},
    )
    assert up_resp.status_code == 201, up_resp.text
    doc = up_resp.json()
    assert doc["current_version_id"]

    create = await auth_client.post(
        f"/api/v1/workflows/document/{doc['id']}/steps",
        json=[
            {
                "document_id": doc["id"],
                "step_order": 1,
                "label": "Visa",
                "assigned_to": str(db_seed["user_id"]),
                "expected_action_type": "visa",
            }
        ],
    )
    assert create.status_code in (200, 201), create.text

    pending = await auth_client.get("/api/v1/workflows/pending")
    task = next(t for t in pending.json() if t["document_id"] == doc["id"])
    assert task["document"]["current_version_id"] == doc["current_version_id"]

    action = await auth_client.post(
        f"/api/v1/workflows/step/{task['id']}/actions",
        json={
            "action_type": "visa",
            "outcome": "accepted",
            "document_version_id": task["document"]["current_version_id"],
        },
    )
    assert action.status_code in (200, 201), action.text
