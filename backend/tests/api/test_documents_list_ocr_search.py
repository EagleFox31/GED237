"""GET /documents?q= also matches the OCR text, within the caller's tenant (V1.1, Lot 10-1)."""

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import bindparam, func, select, text
from sqlalchemy.dialects import postgresql

from app.api.v1.endpoints.documents import _ocr_text_match
from app.core.search.postgres_engine import PostgresSearchEngine
from app.models.document import Document
from app.models.org_unit import OrgUnit
from app.models.tenant import Tenant

DOCUMENTS = "/api/v1/documents/"
OCR_TEXT = "Convention de financement signée avec la commune de Bafoussam."


@pytest_asyncio.fixture
async def ocr_seed(db_session, db_seed):
    """Two documents whose title says nothing of their OCR text: one in the
    caller's tenant, one in another tenant with the same OCR text."""
    other_tenant_id = uuid.uuid4()
    other_tenant = Tenant(
        id=other_tenant_id,
        name="Other Ministry",
        short_name="OTHOCR",
        domain=f"other-ocr-{other_tenant_id}.gov.cm",
        is_active=True,
    )
    other_unit = OrgUnit(
        id=uuid.uuid4(),
        tenant_id=other_tenant_id,
        code="DIR-OCR",
        name="Direction OCR",
        level=1,
        is_active=True,
    )
    sibling_unit = OrgUnit(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        code="DIR-VOISINE",
        name="Direction voisine",
        level=1,
        is_active=True,
    )
    db_session.add_all([other_tenant, other_unit, sibling_unit])
    await db_session.commit()

    def doc(tenant_id, org_unit_id):
        return Document(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            org_unit_id=org_unit_id,
            owner_id=db_seed["user_id"],
            document_category_id=db_seed["category_id"],
            title="Scan 0042",
            file_path=f"/tmp/{uuid.uuid4()}.pdf",
            ocr_content=OCR_TEXT,
            ocr_content_vector=func.to_tsvector(
                PostgresSearchEngine.FTS_CONFIG, OCR_TEXT
            ),
        )

    docs = {
        "own": doc(db_seed["tenant_id"], db_seed["org_unit_id"]),
        "other_tenant": doc(other_tenant_id, other_unit.id),
        "sibling_unit": doc(db_seed["tenant_id"], sibling_unit.id),
    }
    db_session.add_all(docs.values())
    await db_session.commit()
    return {k: str(v.id) for k, v in docs.items()}


def _ids(response):
    assert response.status_code == 200, response.text
    return {d["id"] for d in response.json()}


async def _search(client_as, db_seed, q, role="tenant_admin"):
    async with client_as(
        role,
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        return _ids(await client.get(DOCUMENTS, params={"q": q}))


@pytest.mark.asyncio
async def test_ocr_text_is_searched(client_as, db_seed, ocr_seed):
    # Word only present in the OCR text; plural form matches through stemming.
    same_tenant = {ocr_seed["own"], ocr_seed["sibling_unit"]}
    assert await _search(client_as, db_seed, "conventions") == same_tenant
    assert await _search(client_as, db_seed, "commune Bafoussam") == same_tenant


@pytest.mark.asyncio
async def test_ocr_search_without_match(client_as, db_seed, ocr_seed):
    assert await _search(client_as, db_seed, "Douala") == set()
    # Stop words alone give an empty text query: no OCR match, no error.
    assert await _search(client_as, db_seed, "de la") == set()


@pytest.mark.asyncio
async def test_ocr_search_stays_in_tenant(client_as, db_seed, ocr_seed):
    found = await _search(client_as, db_seed, "financement")
    assert ocr_seed["other_tenant"] not in found
    assert found == {ocr_seed["own"], ocr_seed["sibling_unit"]}


@pytest.mark.asyncio
async def test_ocr_search_cannot_widen_org_unit_scope(client_as, db_seed, ocr_seed):
    # An agent of one service does not reach another service's document through its OCR text.
    found = await _search(client_as, db_seed, "financement", role="reader")
    assert found == {ocr_seed["own"]}


@pytest.mark.asyncio
async def test_ocr_predicate_can_use_gin_index(db_session, ocr_seed):
    # Explain the exact predicate the endpoint uses, with its bound parameters.
    stmt = select(Document.id).where(_ocr_text_match("financement"))
    compiled = stmt.compile(dialect=postgresql.dialect(paramstyle="named"))
    await db_session.execute(text("SET LOCAL enable_seqscan = off"))
    explain = text(f"EXPLAIN {compiled}").bindparams(
        *(
            bindparam(name, value, type_=compiled.binds[name].type)
            for name, value in compiled.params.items()
        )
    )
    plan = (await db_session.execute(explain)).scalars().all()
    assert any("idx_documents_ocr_vector" in line for line in plan), plan
