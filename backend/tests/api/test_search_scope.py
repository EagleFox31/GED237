"""Search results are bounded to the caller's tenant and read scope (DEC-2026-002)."""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.document import Document
from app.models.org_unit import OrgUnit
from app.models.tenant import Tenant

SEARCH = "/api/v1/search/"
NEEDLE = "rapport"
CATEGORY_CODE = "note_de_service"  # seeded in conftest.db_seed


@pytest_asyncio.fixture
async def scope_seed(db_session, db_seed):
    """Three documents matching ``rapport``, all owned by the seed user:
    one in the user's unit, one in another unit, one in the trash."""
    tenant_id = db_seed["tenant_id"]
    other_unit = OrgUnit(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        code="DIR-AUTRE",
        name="Direction Autre",
        level=1,
        is_active=True,
    )
    other_tenant_id = uuid.uuid4()
    other_tenant = Tenant(
        id=other_tenant_id,
        name="Other Ministry",
        short_name="OTHER",
        domain=f"other-{other_tenant_id}.gov.cm",
        is_active=True,
    )
    db_session.add_all([other_unit, other_tenant])
    await db_session.commit()

    def doc(title, **extra):
        base = dict(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            org_unit_id=db_seed["org_unit_id"],
            owner_id=db_seed["user_id"],
            document_category_id=db_seed["category_id"],
            title=title,
            file_path=f"/tmp/{uuid.uuid4()}.txt",
        )
        base.update(extra)
        return Document(**base)

    docs = {
        "own": doc("Rapport annuel direction test"),
        "other_unit": doc("Rapport direction autre", org_unit_id=other_unit.id),
        "trashed": doc("Rapport supprimé", deleted_at=datetime.now(timezone.utc)),
    }
    db_session.add_all(docs.values())
    await db_session.commit()
    return {
        "other_unit_id": other_unit.id,
        "other_tenant_id": other_tenant_id,
        "docs": {k: str(v.id) for k, v in docs.items()},
    }


def _hit_ids(response):
    assert response.status_code == 200, response.text
    data = response.json()
    ids = {h["document_id"] for h in data["hits"]}
    assert data["total_count"] == len(ids)
    return ids


@pytest.mark.asyncio
async def test_trashed_documents_never_match(auth_client: AsyncClient, scope_seed):
    ids = _hit_ids(await auth_client.get(SEARCH, params={"q": NEEDLE}))
    assert scope_seed["docs"]["trashed"] not in ids
    assert scope_seed["docs"]["own"] in ids


@pytest.mark.asyncio
async def test_org_unit_role_is_bounded_to_its_unit(client_as, db_seed, scope_seed):
    async with client_as(
        "reader", tenant_id=db_seed["tenant_id"], org_unit_id=db_seed["org_unit_id"]
    ) as client:
        ids = _hit_ids(await client.get(SEARCH, params={"q": NEEDLE}))
        assert ids == {scope_seed["docs"]["own"]}

        # Asking for another unit cannot widen the scope.
        widened = _hit_ids(
            await client.get(
                SEARCH,
                params={"q": NEEDLE, "org_unit_id": str(scope_seed["other_unit_id"])},
            )
        )
        assert widened == set()


@pytest.mark.asyncio
async def test_tenant_wide_role_sees_tenant_but_not_trash(
    client_as, db_seed, scope_seed
):
    async with client_as(
        "tenant_admin",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        ids = _hit_ids(await client.get(SEARCH, params={"q": NEEDLE}))
    docs = scope_seed["docs"]
    assert {docs["own"], docs["other_unit"]} <= ids
    assert docs["trashed"] not in ids


@pytest.mark.asyncio
async def test_other_tenant_sees_nothing(client_as, db_seed, scope_seed):
    async with client_as(
        "tenant_admin",
        tenant_id=scope_seed["other_tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        response = await client.get(SEARCH, params={"q": NEEDLE})
    assert response.status_code == 200
    assert response.json()["hits"] == []
    assert response.json()["total_count"] == 0


@pytest.mark.asyncio
async def test_hits_expose_category_code_and_category_filter(
    auth_client: AsyncClient, db_seed, scope_seed
):
    """Regression: building a hit used to read ``Document.category`` (absent)
    and crashed on the first match; the category filter did the same."""
    response = await auth_client.get(SEARCH, params={"q": NEEDLE})
    ids = _hit_ids(response)
    own = next(h for h in response.json()["hits"] if h["document_id"] in ids)
    assert own["category"] == CATEGORY_CODE

    filtered = _hit_ids(
        await auth_client.get(SEARCH, params={"q": NEEDLE, "category": CATEGORY_CODE})
    )
    assert filtered == ids
    none = await auth_client.get(SEARCH, params={"q": NEEDLE, "category": "NOPE"})
    assert _hit_ids(none) == set()
