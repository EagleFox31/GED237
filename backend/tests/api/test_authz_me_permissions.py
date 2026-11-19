"""GET /authz/me/permissions: which actions the interface may offer."""

import pytest

URL = "/api/v1/authz/me/permissions"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("role", "purge", "manage"),
    [
        ("super_admin", True, True),
        # Permanent deletion is reserved to the platform administrator (PO, V1.1).
        ("tenant_admin", False, False),
        ("unit_admin", False, False),
        ("manager", False, False),
        ("collaborator", False, False),
    ],
)
async def test_same_answer_as_the_routes(client_as, db_seed, role, purge, manage):
    async with client_as(role, tenant_id=db_seed["tenant_id"]) as client:
        response = await client.get(
            URL, params={"checks": "documents:purge,documents:manage"}
        )
    assert response.status_code == 200, response.text
    assert response.json() == {"documents:purge": purge, "documents:manage": manage}


@pytest.mark.asyncio
async def test_unknown_or_malformed_pairs_are_false(client_as, db_seed):
    async with client_as("super_admin", tenant_id=db_seed["tenant_id"]) as client:
        response = await client.get(
            URL,
            params={"checks": "nowhere:read, documents:fly ,documents, documents:read"},
        )
    assert response.json() == {
        "nowhere:read": False,
        "documents:fly": False,
        "documents": False,
        "documents:read": True,
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "checks", [" , ", ",".join(f"documents:a{n}" for n in range(21))]
)
async def test_between_one_and_twenty_pairs(client_as, db_seed, checks):
    async with client_as("tenant_admin", tenant_id=db_seed["tenant_id"]) as client:
        response = await client.get(URL, params={"checks": checks})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_requires_authentication(async_client):
    response = await async_client.get(URL, params={"checks": "documents:purge"})
    assert response.status_code in (401, 403)  # HTTPBearer: depends on FastAPI version
