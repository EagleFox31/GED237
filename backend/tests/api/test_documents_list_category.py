"""GET /documents?document_category_id= filters the caller's whole scope (V1.1)."""

import uuid

import pytest
import pytest_asyncio

from app.models.document import Document
from app.models.document_category import DocumentCategory
from app.models.tenant import Tenant

DOCUMENTS = "/api/v1/documents/"


@pytest_asyncio.fixture
async def cat_seed(db_session, db_seed):
    tenant_id = db_seed["tenant_id"]
    other_cat = DocumentCategory(
        id=uuid.uuid4(), tenant_id=tenant_id, code="autre", name="Autre", is_active=True
    )
    other_tenant = Tenant(
        id=uuid.uuid4(), name="Autre tenant", short_name="autre-t", is_active=True
    )
    db_session.add_all([other_cat, other_tenant])
    await db_session.flush()
    foreign_cat = DocumentCategory(
        id=uuid.uuid4(),
        tenant_id=other_tenant.id,
        code="etrangere",
        name="Étrangère",
        is_active=True,
    )
    db_session.add(foreign_cat)

    def doc(title, category_id, **extra):
        base = dict(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            org_unit_id=db_seed["org_unit_id"],
            owner_id=db_seed["user_id"],
            document_category_id=category_id,
            title=title,
            file_path=f"/tmp/{uuid.uuid4()}.txt",
        )
        base.update(extra)
        return Document(**base)

    docs = {
        "note": doc("Note 1", db_seed["category_id"]),
        "autre": doc("Autre 1", other_cat.id),
    }
    db_session.add_all(docs.values())
    await db_session.commit()
    return {
        "ids": {k: str(v.id) for k, v in docs.items()},
        "note_cat": str(db_seed["category_id"]),
        "foreign_cat": str(foreign_cat.id),
    }


def _ids(response):
    assert response.status_code == 200, response.text
    return {d["id"] for d in response.json()}


@pytest.mark.asyncio
async def test_category_filter_returns_only_that_category(client_as, db_seed, cat_seed):
    async with client_as(
        "tenant_admin",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        everything = _ids(await client.get(DOCUMENTS))
        filtered = _ids(
            await client.get(
                DOCUMENTS, params={"document_category_id": cat_seed["note_cat"]}
            )
        )

    assert set(cat_seed["ids"].values()) <= everything
    assert cat_seed["ids"]["note"] in filtered
    assert cat_seed["ids"]["autre"] not in filtered


@pytest.mark.asyncio
async def test_category_of_another_tenant_matches_nothing(client_as, db_seed, cat_seed):
    async with client_as(
        "tenant_admin",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        found = _ids(
            await client.get(
                DOCUMENTS, params={"document_category_id": cat_seed["foreign_cat"]}
            )
        )

    assert found == set()


@pytest.mark.asyncio
async def test_invalid_category_id_is_422(client_as, db_seed):
    async with client_as(
        "tenant_admin",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        response = await client.get(DOCUMENTS, params={"document_category_id": "x"})
    assert response.status_code == 422
