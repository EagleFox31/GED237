"""Authorization bounds and account actions on ``/api/v1/users``.

Nominal CRUD and hierarchy reads live in ``test_admin_crud_coverage.py``.
"""

import io
import uuid

import pytest
from httpx import AsyncClient

from app.core.security import hash_password
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User

USERS = "/api/v1/users"


def _user_payload(db_seed, **overrides):
    payload = {
        "matricule": "NEW001",
        "email": "new.agent@testministry.gov.cm",
        "first_name": "New",
        "last_name": "Agent",
        "role_id": db_seed["role_id"],
        "tenant_id": str(db_seed["tenant_id"]),
        "org_unit_id": str(db_seed["org_unit_id"]),
        "password": "agent123",
    }
    payload.update(overrides)
    return payload


async def _add_user(db_session, tenant_id, org_unit_id, matricule, **fields):
    user = User(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        org_unit_id=org_unit_id,
        role_id=3,
        matricule=matricule,
        email=f"{matricule.lower()}@testministry.gov.cm",
        password_hash=hash_password("password123"),
        is_active=True,
        **fields,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "method, path",
    [
        ("get", "/"),
        ("post", "/"),
        ("get", "/me"),
        ("get", "/assignable-roles"),
        ("get", "/{id}"),
        ("patch", "/{id}"),
        ("delete", "/{id}"),
        ("post", "/{id}/reset-password"),
        ("post", "/{id}/toggle-active"),
        ("post", "/{id}/disable-mfa"),
        ("get", "/{id}/hierarchy-up"),
        ("get", "/{id}/hierarchy-down"),
    ],
)
async def test_users_routes_require_authentication(
    async_client: AsyncClient, method, path
):
    url = USERS + path.format(id=uuid.uuid4())
    response = await async_client.request(method, url)
    # FastAPI's HTTPBearer answers 403 when the header is missing (401 from 0.115).
    assert response.status_code in {401, 403}


@pytest.mark.asyncio
@pytest.mark.parametrize("role_code", ["manager", "reader", "standard"])
async def test_roles_without_users_permission_are_denied(client_as, db_seed, role_code):
    target = f"{USERS}/{db_seed['user_id']}"
    async with client_as(
        role_code,
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        responses = [
            await client.get(f"{USERS}/"),
            await client.get(target),
            await client.get(f"{target}/hierarchy-up"),
            await client.post(f"{USERS}/", json=_user_payload(db_seed)),
            await client.patch(target, json={"first_name": "Denied"}),
            await client.post(f"{target}/reset-password"),
        ]
    assert [r.status_code for r in responses] == [403] * len(responses)


@pytest.mark.asyncio
async def test_unit_admin_reads_users_but_cannot_change_them(client_as, db_seed):
    target = f"{USERS}/{db_seed['user_id']}"
    async with client_as(
        "unit_admin",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        assert (await client.get(target)).status_code == 200
        assert (await client.get(f"{target}/hierarchy-down")).status_code == 200
        denied = [
            await client.post(f"{USERS}/", json=_user_payload(db_seed)),
            await client.patch(target, json={"first_name": "Denied"}),
            await client.delete(target),
            await client.post(f"{target}/reset-password"),
            await client.post(f"{target}/toggle-active"),
            await client.post(f"{target}/disable-mfa"),
        ]
    assert [r.status_code for r in denied] == [403] * len(denied)


@pytest.mark.asyncio
async def test_tenant_admin_cannot_reach_users_of_another_tenant(client_as, db_seed):
    target = f"{USERS}/{db_seed['user_id']}"
    async with client_as("tenant_admin", tenant_id=uuid.uuid4()) as client:
        # Out-of-tenant users are invisible (404), not merely forbidden.
        hidden = [
            await client.get(target),
            await client.patch(target, json={"first_name": "Hijack"}),
            await client.delete(target),
            await client.post(f"{target}/reset-password"),
            await client.post(f"{target}/toggle-active"),
            await client.post(f"{target}/disable-mfa"),
            await client.get(f"{target}/hierarchy-up"),
            await client.get(f"{target}/hierarchy-down"),
        ]
        # The tenant_id filter is reserved to super_admin and ignored here.
        listing = await client.get(
            f"{USERS}/", params={"tenant_id": str(db_seed["tenant_id"])}
        )
        created = await client.post(f"{USERS}/", json=_user_payload(db_seed))

    assert [r.status_code for r in hidden] == [404] * len(hidden)
    assert listing.status_code == 200
    assert listing.json() == []
    assert created.status_code == 403


@pytest.mark.asyncio
async def test_tenant_admin_account_recovery_actions(client_as, db_session, db_seed):
    seeded = await db_session.get(User, db_seed["user_id"])
    seeded.mfa_secret = "JBSWY3DPEHPK3PXP"
    old_hash = seeded.password_hash
    await db_session.commit()

    target = f"{USERS}/{db_seed['user_id']}"
    async with client_as("tenant_admin", tenant_id=db_seed["tenant_id"]) as client:
        reset = await client.post(f"{target}/reset-password")
        deactivated = await client.post(f"{target}/toggle-active")
        reactivated = await client.post(f"{target}/toggle-active")
        mfa = await client.post(f"{target}/disable-mfa")

    assert reset.status_code == 200
    assert len(reset.json()["temporary_password"]) >= 16
    assert deactivated.json()["is_active"] is False
    assert reactivated.json()["is_active"] is True
    assert mfa.status_code == 200

    stored = await db_session.get(User, db_seed["user_id"], populate_existing=True)
    assert stored.must_change_password is True
    assert stored.password_hash != old_hash
    assert stored.mfa_secret is None


@pytest.mark.asyncio
async def test_admin_cannot_reset_or_deactivate_own_account(client_as, db_seed):
    target = f"{USERS}/{db_seed['user_id']}"
    async with client_as(
        "tenant_admin", tenant_id=db_seed["tenant_id"], id=db_seed["user_id"]
    ) as client:
        reset = await client.post(f"{target}/reset-password")
        toggled = await client.post(f"{target}/toggle-active")
    assert reset.status_code == 400
    assert toggled.status_code == 400


@pytest.mark.asyncio
async def test_create_user_resolves_role_code_and_generates_password(
    client_as, db_seed
):
    async with client_as("tenant_admin", tenant_id=db_seed["tenant_id"]) as client:
        created = await client.post(
            f"{USERS}/",
            json=_user_payload(
                db_seed, role_id=None, role_code="standard", password=None
            ),
        )
        unknown_role = await client.post(
            f"{USERS}/",
            json=_user_payload(
                db_seed, matricule="NEW002", role_id=None, role_code="ghost"
            ),
        )
        no_role = await client.post(
            f"{USERS}/", json=_user_payload(db_seed, matricule="NEW003", role_id=None)
        )
        duplicate_email = await client.post(
            f"{USERS}/",
            json=_user_payload(
                db_seed, matricule="NEW004", email="test@testministry.gov.cm"
            ),
        )

    assert created.status_code == 201
    body = created.json()
    assert len(body["generated_password"]) >= 16
    assert body["user"]["role"] == "standard"
    assert body["user"]["must_change_password"] is True
    assert unknown_role.status_code == 422
    assert no_role.status_code == 422
    assert duplicate_email.status_code == 400


@pytest.mark.asyncio
async def test_reports_to_rejects_unknown_foreign_self_and_cycles(
    client_as, db_session, db_seed
):
    other_tenant = Tenant(
        id=uuid.uuid4(),
        name="Other Ministry",
        short_name="OTHMIN",
        domain="other-ministry.gov.cm",
        is_active=True,
    )
    db_session.add(other_tenant)
    await db_session.commit()
    foreign = await _add_user(db_session, other_tenant.id, None, "FOREIGN01")

    target = f"{USERS}/{db_seed['user_id']}"
    async with client_as("tenant_admin", tenant_id=db_seed["tenant_id"]) as client:
        unknown = await client.post(
            f"{USERS}/",
            json=_user_payload(db_seed, reports_to_user_id=str(uuid.uuid4())),
        )
        cross_tenant = await client.post(
            f"{USERS}/",
            json=_user_payload(db_seed, reports_to_user_id=str(foreign.id)),
        )
        to_self = await client.patch(
            target, json={"reports_to_user_id": str(db_seed["user_id"])}
        )
        subordinate = await client.post(
            f"{USERS}/",
            json=_user_payload(db_seed, reports_to_user_id=str(db_seed["user_id"])),
        )
        cycle = await client.patch(
            target, json={"reports_to_user_id": subordinate.json()["user"]["id"]}
        )

    assert unknown.status_code == 422
    assert cross_tenant.status_code == 422
    assert to_self.status_code == 422
    assert subordinate.status_code == 201
    assert cycle.status_code == 422
    assert cycle.json()["detail"] == "Hierarchy cycle detected"


@pytest.mark.asyncio
async def test_delete_user_blocked_while_owning_active_documents(client_as, db_seed):
    async with client_as(
        "super_admin",
        id=db_seed["user_id"],
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as owner:
        upload = await owner.post(
            "/api/v1/documents/upload",
            files={"file": ("owned.txt", io.BytesIO(b"owned"), "text/plain")},
            data={"title": "Owned Document", "processing_mode": "archive"},
        )
    assert upload.status_code == 201

    async with client_as("tenant_admin", tenant_id=db_seed["tenant_id"]) as client:
        blocked = await client.delete(f"{USERS}/{db_seed['user_id']}")
    assert blocked.status_code == 409
    assert "active document" in blocked.json()["detail"]


@pytest.mark.asyncio
async def test_assignable_roles_exclude_super_admin(client_as, db_session, db_seed):
    db_session.add_all(
        [
            Role(id=1, code="super_admin", label="Super Admin", hierarchy_level=0),
            Role(id=2, code="tenant_admin", label="Admin", hierarchy_level=1),
        ]
    )
    await db_session.commit()

    async with client_as("tenant_admin", tenant_id=db_seed["tenant_id"]) as client:
        response = await client.get(f"{USERS}/assignable-roles")

    assert response.status_code == 200
    assert [row["code"] for row in response.json()] == ["tenant_admin", "standard"]
