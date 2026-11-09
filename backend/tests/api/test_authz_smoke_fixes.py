"""Authorization defects found by the e2e smoke of PR #39 (SMK-04, SMK-05, SMK-10).

SMK-04: policy.csv named the collaborator role ``standard`` while the seed
creates ``collaborator`` -> no rule matched, upload 403.
SMK-05: every profile reads its own tenant (Sidebar); only admins had
``tenants read``, and that action also covers the list.
SMK-10: categories are reference data needed to display documents; reading
roles had no ``categories read``.
"""

import io
import uuid

import pytest

from app.core.authz.casbin_enforcer import enforce_permission

# Role codes as seeded today (conftest + scripts/seed_db.py). Kept literal on
# purpose until the role-code migration lands; that work will import the set
# from the seed source so the policy is checked against what is really seeded.
SEEDED_ROLE_CODES = {
    "super_admin",
    "tenant_admin",
    "unit_admin",
    "manager",
    "collaborator",
    "reader",
    "auditor",
}
READING_ROLES = ["collaborator", "reader", "manager", "unit_admin", "auditor"]


def _policy_roles():
    import pathlib

    path = pathlib.Path(__file__).resolve().parents[2] / "app/core/authz/policy.csv"
    roles = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("p,"):
            roles.add(line.split(",")[1].strip())
    return roles


def test_every_seeded_role_has_policy_lines_and_no_orphan_role():
    """Guardrail for SMK-04: seed codes and policy subjects are the same set."""
    roles = _policy_roles()
    assert SEEDED_ROLE_CODES <= roles, SEEDED_ROLE_CODES - roles
    assert roles - SEEDED_ROLE_CODES == set(), roles - SEEDED_ROLE_CODES


@pytest.mark.asyncio
@pytest.mark.parametrize("role", READING_ROLES)
async def test_reading_roles_can_read_categories_but_not_write(role):
    assert await enforce_permission(role, "categories", "read") is True
    for action in ("create", "update", "delete", "manage"):
        assert await enforce_permission(role, "categories", action) is False


@pytest.mark.asyncio
async def test_collaborator_can_upload(client_as, db_seed):
    async with client_as(
        "collaborator",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        id=db_seed["user_id"],
    ) as client:
        response = await client.post(
            "/api/v1/documents/upload",
            files={
                "file": ("smk04.txt", io.BytesIO(b"collaborator upload"), "text/plain")
            },
            data={"title": "SMK-04 upload"},
        )
    assert response.status_code == 201, response.text


@pytest.mark.asyncio
async def test_reader_reads_categories_and_cannot_create(client_as, db_seed):
    async with client_as(
        "reader", tenant_id=db_seed["tenant_id"], org_unit_id=db_seed["org_unit_id"]
    ) as client:
        listing = await client.get("/api/v1/categories/")
        assert listing.status_code == 200, listing.text
        assert {c["code"] for c in listing.json()} >= {"note_de_service"}
        created = await client.post(
            "/api/v1/categories/", json={"code": "smk10", "name": "SMK-10"}
        )
        assert created.status_code == 403


@pytest.mark.asyncio
async def test_reader_reads_own_tenant_only_and_never_the_list(client_as, db_seed):
    tenant_id = db_seed["tenant_id"]
    async with client_as(
        "reader", tenant_id=tenant_id, org_unit_id=db_seed["org_unit_id"]
    ) as client:
        own = await client.get(f"/api/v1/tenants/{tenant_id}")
        assert own.status_code == 200, own.text
        assert own.json()["id"] == str(tenant_id)

        foreign = await client.get(f"/api/v1/tenants/{uuid.uuid4()}")
        assert foreign.status_code == 403

        listing = await client.get("/api/v1/tenants/")
        assert listing.status_code == 403
