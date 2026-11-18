"""Server-side filters and pagination of GET /api/v1/spaces/documents (Lot C)."""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import update

from app.models.classification_activity import ClassificationActivity
from app.models.classification_domain import ClassificationDomain
from app.models.document import Document

SPACE_DOCS = "/api/v1/spaces/documents"


@pytest_asyncio.fixture
async def filter_seed(db_session, db_seed):
    """Two domains, one activity and four documents owned by the seeded user."""
    tenant_id = db_seed["tenant_id"]
    marches = ClassificationDomain(
        id=uuid.uuid4(), tenant_id=tenant_id, code="MARCHES", name="Marchés publics"
    )
    budget = ClassificationDomain(
        id=uuid.uuid4(), tenant_id=tenant_id, code="BUDGET", name="Budget"
    )
    db_session.add_all([marches, budget])
    await db_session.commit()
    reparation = ClassificationActivity(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        domain_id=marches.id,
        code="REPARATION",
        name="Réparation",
    )
    db_session.add(reparation)
    await db_session.commit()

    def doc(title, **extra):
        return Document(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            org_unit_id=db_seed["org_unit_id"],
            owner_id=db_seed["user_id"],
            document_category_id=db_seed["category_id"],
            title=title,
            file_path=f"/tmp/{uuid.uuid4()}.txt",
            **extra,
        )

    docs = {
        "marche_2026": doc(
            "Marché réparation 2026",
            classification_domain_id=marches.id,
            classification_activity_id=reparation.id,
            classification_year=2026,
            status="validated",
            classification_status="classified",
            tags=["travaux"],
        ),
        "marche_2025": doc(
            "Marché fournitures 2025",
            classification_domain_id=marches.id,
            classification_year=2025,
            status="draft",
            classification_status="needs_review",
        ),
        "budget_2026": doc(
            "Taux 100%",
            classification_domain_id=budget.id,
            classification_year=2026,
            status="draft",
            classification_status="pending",
        ),
        "unclassified": doc("Taux 100 pour cent", status="archived"),
    }
    db_session.add_all(docs.values())
    await db_session.commit()
    return {
        "domains": {"marches": marches, "budget": budget},
        "activity": reparation,
        "docs": {k: str(v.id) for k, v in docs.items()},
    }


def _ids(response):
    assert response.status_code == 200, response.text
    return {d["id"] for d in response.json()}


@pytest.mark.asyncio
async def test_without_filters_keeps_historical_behaviour(
    auth_client: AsyncClient, db_seed, filter_seed
):
    response = await auth_client.get(
        SPACE_DOCS, params={"org_unit_id": str(db_seed["org_unit_id"])}
    )
    assert _ids(response) == set(filter_seed["docs"].values())
    assert response.headers["x-total-count"] == "4"


@pytest.mark.asyncio
async def test_single_filters(auth_client: AsyncClient, db_seed, filter_seed):
    base = {"org_unit_id": str(db_seed["org_unit_id"])}
    docs = filter_seed["docs"]
    cases = [
        (
            {"domain_id": str(filter_seed["domains"]["marches"].id)},
            {"marche_2026", "marche_2025"},
        ),
        ({"activity_id": str(filter_seed["activity"].id)}, {"marche_2026"}),
        ({"year": "2026"}, {"marche_2026", "budget_2026"}),
        ({"status": "draft"}, {"marche_2025", "budget_2026"}),
        ({"classification_status": "needs_review"}, {"marche_2025"}),
        ({"q": "réparation"}, {"marche_2026"}),  # title match, case-insensitive
        ({"q": "travaux"}, {"marche_2026"}),  # tag match
        ({"q": "budget"}, {"budget_2026"}),  # domain name match
    ]
    for params, expected in cases:
        response = await auth_client.get(SPACE_DOCS, params={**base, **params})
        assert _ids(response) == {docs[k] for k in expected}, params
        assert response.headers["x-total-count"] == str(len(expected)), params


@pytest.mark.asyncio
async def test_q_escapes_like_wildcards(auth_client: AsyncClient, db_seed, filter_seed):
    response = await auth_client.get(
        SPACE_DOCS, params={"org_unit_id": str(db_seed["org_unit_id"]), "q": "100%"}
    )
    # A literal "%" must not act as a wildcard: "Taux 100 pour cent" is excluded.
    assert _ids(response) == {filter_seed["docs"]["budget_2026"]}


@pytest.mark.asyncio
async def test_combined_filters(auth_client: AsyncClient, db_seed, filter_seed):
    response = await auth_client.get(
        SPACE_DOCS,
        params={
            "org_unit_id": str(db_seed["org_unit_id"]),
            "domain_id": str(filter_seed["domains"]["marches"].id),
            "year": "2026",
            "status": "validated",
        },
    )
    assert _ids(response) == {filter_seed["docs"]["marche_2026"]}

    response = await auth_client.get(
        SPACE_DOCS,
        params={
            "org_unit_id": str(db_seed["org_unit_id"]),
            "domain_id": str(filter_seed["domains"]["marches"].id),
            "year": "2024",
        },
    )
    assert _ids(response) == set()
    assert response.headers["x-total-count"] == "0"


@pytest.mark.asyncio
async def test_pagination_is_stable_and_total_is_unpaginated(
    auth_client: AsyncClient, db_seed, filter_seed
):
    base = {"org_unit_id": str(db_seed["org_unit_id"]), "limit": "3"}
    page1 = await auth_client.get(SPACE_DOCS, params={**base, "offset": "0"})
    page2 = await auth_client.get(SPACE_DOCS, params={**base, "offset": "3"})
    page3 = await auth_client.get(SPACE_DOCS, params={**base, "offset": "6"})
    ids1, ids2, ids3 = _ids(page1), _ids(page2), _ids(page3)
    assert len(ids1) == 3 and len(ids2) == 1 and ids3 == set()
    assert ids1.isdisjoint(ids2)
    assert ids1 | ids2 == set(filter_seed["docs"].values())
    for page in (page1, page2, page3):
        assert page.headers["x-total-count"] == "4"


@pytest.mark.asyncio
async def test_foreign_tenant_sees_nothing(client_as, db_seed, filter_seed):
    async with client_as(
        "tenant_admin", tenant_id=uuid.uuid4(), org_unit_id=db_seed["org_unit_id"]
    ) as client:
        response = await client.get(
            SPACE_DOCS,
            params={
                "org_unit_id": str(db_seed["org_unit_id"]),
                "domain_id": str(filter_seed["domains"]["marches"].id),
            },
        )
    assert response.status_code == 200
    assert response.json() == []
    assert response.headers["x-total-count"] == "0"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "params",
    [
        {"status": "bogus"},
        {"classification_status": "bogus"},
        {"year": "abc"},
        {"year": "1800"},
        {"domain_id": "not-a-uuid"},
        {"activity_id": "42"},
        {"limit": "0"},
        {"limit": "201"},
        {"offset": "-1"},
        {"q": "x" * 121},
        {"sort": "file_path"},
        {"sort": "title; drop table documents"},
        {"order": "up"},
    ],
)
async def test_invalid_values_are_rejected_with_422(
    auth_client: AsyncClient, db_seed, params
):
    response = await auth_client.get(
        SPACE_DOCS, params={"org_unit_id": str(db_seed["org_unit_id"]), **params}
    )
    assert response.status_code == 422, response.text


def _ordered(response):
    assert response.status_code == 200, response.text
    return [d["id"] for d in response.json()]


@pytest.mark.asyncio
async def test_sort_by_size_spans_pages_with_empty_sizes_last(
    auth_client: AsyncClient, db_session, db_seed, filter_seed
):
    docs = filter_seed["docs"]
    sizes = {"marche_2026": 300, "marche_2025": 100, "budget_2026": 200}
    for key, size in sizes.items():
        await db_session.execute(
            update(Document)
            .where(Document.id == uuid.UUID(docs[key]))
            .values(file_size=size)
        )
    await db_session.commit()

    base = {"org_unit_id": str(db_seed["org_unit_id"]), "sort": "size", "limit": "3"}
    expected = {
        "asc": ["marche_2025", "budget_2026", "marche_2026", "unclassified"],
        "desc": ["marche_2026", "budget_2026", "marche_2025", "unclassified"],
    }
    for order, keys in expected.items():
        page1 = await auth_client.get(SPACE_DOCS, params={**base, "order": order})
        page2 = await auth_client.get(
            SPACE_DOCS, params={**base, "order": order, "offset": "3"}
        )
        # Page 2 continues page 1: no row skipped or repeated across pages.
        assert _ordered(page1) + _ordered(page2) == [docs[k] for k in keys], order
        assert page1.headers["x-total-count"] == "4"


@pytest.mark.asyncio
async def test_sort_by_title_is_case_insensitive(
    auth_client: AsyncClient, db_seed, filter_seed
):
    docs = filter_seed["docs"]
    base = {"org_unit_id": str(db_seed["org_unit_id"]), "sort": "title"}
    taux = {docs["budget_2026"], docs["unclassified"]}

    asc = _ordered(await auth_client.get(SPACE_DOCS, params={**base, "order": "asc"}))
    assert asc[:2] == [docs["marche_2025"], docs["marche_2026"]]
    assert set(asc[2:]) == taux

    desc = _ordered(await auth_client.get(SPACE_DOCS, params={**base, "order": "desc"}))
    assert set(desc[:2]) == taux
    assert desc[2:] == [docs["marche_2026"], docs["marche_2025"]]


@pytest.mark.asyncio
async def test_without_sort_keeps_newest_first(
    auth_client: AsyncClient, db_seed, filter_seed
):
    params = {"org_unit_id": str(db_seed["org_unit_id"])}
    default = _ordered(await auth_client.get(SPACE_DOCS, params=params))
    explicit = _ordered(
        await auth_client.get(
            SPACE_DOCS, params={**params, "sort": "created_at", "order": "desc"}
        )
    )
    assert default == explicit
