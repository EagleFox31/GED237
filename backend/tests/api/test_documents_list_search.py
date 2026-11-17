"""GET /documents?q= searches the caller's whole read scope, not the first page (#256)."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio

from app.models.document import Document
from app.models.org_unit import OrgUnit

DOCUMENTS = "/api/v1/documents/"
NEEDLE = "Bordereau ciblé"


@pytest_asyncio.fixture
async def list_seed(db_session, db_seed):
    """101 recent filler documents, then older ones matching ``NEEDLE``:
    one in the user's unit, one in another unit, one in the trash."""
    tenant_id = db_seed["tenant_id"]
    other_unit = OrgUnit(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        code="DIR-LISTE",
        name="Direction Liste",
        level=1,
        is_active=True,
    )
    db_session.add(other_unit)
    await db_session.commit()

    # Colonne `created_at` sans fuseau : datetime naïf en UTC.
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    def doc(title, age_days, **extra):
        base = dict(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            org_unit_id=db_seed["org_unit_id"],
            owner_id=db_seed["user_id"],
            document_category_id=db_seed["category_id"],
            title=title,
            file_path=f"/tmp/{uuid.uuid4()}.txt",
            created_at=now - timedelta(days=age_days),
        )
        base.update(extra)
        return Document(**base)

    fillers = [doc(f"Courrier {i}", age_days=0) for i in range(101)]
    targets = {
        "own": doc(f"{NEEDLE} 2024", age_days=400),
        "other_unit": doc(f"{NEEDLE} autre", age_days=400, org_unit_id=other_unit.id),
        "trashed": doc(
            f"{NEEDLE} supprimé", age_days=400, deleted_at=now - timedelta(days=1)
        ),
    }
    db_session.add_all([*fillers, *targets.values()])
    await db_session.commit()
    return {k: str(v.id) for k, v in targets.items()}


def _ids(response):
    assert response.status_code == 200, response.text
    return {d["id"] for d in response.json()}


@pytest.mark.asyncio
async def test_old_document_is_found_beyond_first_page(client_as, db_seed, list_seed):
    async with client_as(
        "tenant_admin",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        first_page = _ids(await client.get(DOCUMENTS))
        found = _ids(await client.get(DOCUMENTS, params={"q": "bordereau CIBLÉ"}))

    assert len(first_page) == 100
    assert list_seed["own"] not in first_page
    assert {list_seed["own"], list_seed["other_unit"]} <= found
    assert list_seed["trashed"] not in found
    assert all(doc_id in list_seed.values() for doc_id in found)


@pytest.mark.asyncio
async def test_search_cannot_widen_org_unit_scope(client_as, db_seed, list_seed):
    async with client_as(
        "reader", tenant_id=db_seed["tenant_id"], org_unit_id=db_seed["org_unit_id"]
    ) as client:
        found = _ids(await client.get(DOCUMENTS, params={"q": NEEDLE}))
    assert found == {list_seed["own"]}


@pytest.mark.asyncio
async def test_search_is_literal_and_bounded(client_as, db_seed, list_seed):
    async with client_as(
        "tenant_admin",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        wildcard = await client.get(DOCUMENTS, params={"q": "%"})
        blank = await client.get(DOCUMENTS, params={"q": "   "})
        too_long = await client.get(DOCUMENTS, params={"q": "x" * 121})
    assert _ids(wildcard) == set()
    assert len(_ids(blank)) == 100
    assert too_long.status_code == 422
