"""Documentary quality: indicator counts and per-indicator document lists."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from app.models.classification_domain import ClassificationDomain
from app.models.document import Document

QUALITY = "/api/v1/analytics/quality"


async def _seed_documents(db_session, db_seed) -> dict[str, uuid.UUID]:
    """Five documents: one clean, one per defect, one in the trash."""
    domain = ClassificationDomain(
        id=uuid.uuid4(), tenant_id=db_seed["tenant_id"], code="RH", name="RH"
    )
    db_session.add(domain)
    await db_session.flush()
    base = datetime(2026, 11, 1)  # created_at is a naive TIMESTAMP

    def doc(name: str, minutes: int, **overrides) -> Document:
        fields = dict(
            id=uuid.uuid4(),
            tenant_id=db_seed["tenant_id"],
            org_unit_id=db_seed["org_unit_id"],
            owner_id=db_seed["user_id"],
            title=name,
            file_path=f"x/{name}.pdf",
            document_category_id=db_seed["category_id"],
            classification_domain_id=domain.id,
            classification_year=2026,
            classification_status="classified",
            ocr_content="texte reconnu",
            created_at=base + timedelta(minutes=minutes),
        )
        fields.update(overrides)
        return Document(**fields)

    documents = {
        "clean": doc("clean", 1),
        "no_year": doc("no_year", 2, classification_year=None),
        "review": doc("review", 3, classification_status="needs_review"),
        "no_text": doc("no_text", 4, ocr_content="  "),
        "trashed": doc(
            "trashed",
            5,
            classification_year=None,
            deleted_at=datetime(2026, 11, 2, tzinfo=timezone.utc),
        ),
    }
    db_session.add_all(documents.values())
    await db_session.commit()
    return {name: document.id for name, document in documents.items()}


def _counts(body) -> dict[str, int]:
    return {item["key"]: item["count"] for item in body["indicators"]}


@pytest.mark.asyncio
async def test_summary_counts_each_indicator(
    admin_client: AsyncClient, db_session, db_seed
):
    await _seed_documents(db_session, db_seed)
    response = await admin_client.get(QUALITY)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total_documents"] == 4  # the trashed one is left out
    assert body["documents_to_fix"] == 3
    assert body["quality_rate"] == 25.0
    assert _counts(body) == {
        "missing_metadata": 1,
        "missing_category": 0,
        "missing_domain": 0,
        "missing_year": 1,
        "needs_review": 1,
        "no_text": 1,
    }


@pytest.mark.asyncio
async def test_empty_scope_has_no_rate(admin_client: AsyncClient):
    body = (await admin_client.get(QUALITY)).json()
    assert body["total_documents"] == 0
    assert body["quality_rate"] is None
    assert all(item["rate"] is None for item in body["indicators"])


@pytest.mark.asyncio
async def test_documents_of_one_indicator(
    admin_client: AsyncClient, db_session, db_seed
):
    ids = await _seed_documents(db_session, db_seed)
    response = await admin_client.get(
        f"{QUALITY}/documents", params={"indicator": "missing_metadata"}
    )
    assert response.status_code == 200
    assert response.headers["x-total-count"] == "1"
    assert [item["id"] for item in response.json()] == [str(ids["no_year"])]

    paged = await admin_client.get(
        f"{QUALITY}/documents",
        params={"indicator": "no_text", "limit": 1, "skip": 0},
    )
    assert paged.json()[0]["title"] == "no_text"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "params",
    [{}, {"indicator": "unknown"}, {"indicator": "no_text", "limit": 201}],
)
async def test_documents_outside_contract_is_422(admin_client: AsyncClient, params):
    response = await admin_client.get(f"{QUALITY}/documents", params=params)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_reader_is_refused(client_as, db_seed):
    async with client_as(
        "reader", tenant_id=db_seed["tenant_id"], org_unit_id=db_seed["org_unit_id"]
    ) as client:
        assert (await client.get(QUALITY)).status_code == 403
        listed = await client.get(
            f"{QUALITY}/documents", params={"indicator": "no_text"}
        )
    assert listed.status_code == 403


@pytest.mark.asyncio
async def test_collaborator_gets_counts_but_not_titles(client_as, db_session, db_seed):
    await _seed_documents(db_session, db_seed)
    async with client_as(
        "collaborator",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        summary = await client.get(QUALITY)
        listed = await client.get(
            f"{QUALITY}/documents", params={"indicator": "no_text"}
        )
    assert summary.status_code == 200
    assert listed.status_code == 403


@pytest.mark.asyncio
async def test_foreign_tenant_sees_nothing(client_as, db_session, db_seed):
    await _seed_documents(db_session, db_seed)
    async with client_as("tenant_admin", tenant_id=uuid.uuid4()) as client:
        summary = await client.get(QUALITY)
        listed = await client.get(
            f"{QUALITY}/documents", params={"indicator": "no_text"}
        )
    assert summary.json()["total_documents"] == 0
    assert listed.json() == []
    assert listed.headers["x-total-count"] == "0"


@pytest.mark.asyncio
async def test_manager_is_pinned_to_own_unit(client_as, db_session, db_seed):
    await _seed_documents(db_session, db_seed)
    async with client_as(
        "manager", tenant_id=db_seed["tenant_id"], org_unit_id=db_seed["org_unit_id"]
    ) as client:
        own = await client.get(QUALITY)
        other = await client.get(QUALITY, params={"org_unit_id": str(uuid.uuid4())})
    assert own.json()["total_documents"] == 4
    assert other.status_code == 403
