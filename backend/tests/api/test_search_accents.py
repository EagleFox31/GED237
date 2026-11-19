"""Search ignores accents and case: « décret » = « DECRET » = « decret » (V1.1, lot 10-3)."""

import importlib.util
import uuid
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import func

from app.core.search.fts import FTS_CONFIG, UNACCENT_SETUP_SQL
from app.models.document import Document

DOCUMENTS = "/api/v1/documents/"
SEARCH = "/api/v1/search/"
MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "alembic"
    / "versions"
    / "0f6f64260460_french_unaccent_search.py"
)


@pytest_asyncio.fixture
async def accent_seed(db_session, db_seed):
    """One document with an accented title, one whose accented word is only in the
    OCR text, one unrelated."""

    def doc(title, ocr=None):
        extra = {}
        if ocr is not None:
            extra = dict(
                ocr_content=ocr, ocr_content_vector=func.to_tsvector(FTS_CONFIG, ocr)
            )
        return Document(
            id=uuid.uuid4(),
            tenant_id=db_seed["tenant_id"],
            org_unit_id=db_seed["org_unit_id"],
            owner_id=db_seed["user_id"],
            document_category_id=db_seed["category_id"],
            title=title,
            file_path=f"/tmp/{uuid.uuid4()}.pdf",
            **extra,
        )

    docs = {
        "title": doc("Décret de nomination du préfet"),
        "ocr": doc(
            "Scan 0107", ocr="Le DÉCRET portant organisation de l'Agence est abrogé."
        ),
        "other": doc("Note de service interne"),
    }
    db_session.add_all(docs.values())
    await db_session.commit()
    return {k: str(v.id) for k, v in docs.items()}


async def _list_ids(client_as, db_seed, q):
    async with client_as(
        "tenant_admin",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        response = await client.get(DOCUMENTS, params={"q": q})
    assert response.status_code == 200, response.text
    return {d["id"] for d in response.json()}


async def _search_ids(auth_client, q):
    response = await auth_client.get(SEARCH, params={"q": q})
    assert response.status_code == 200, response.text
    return {h["document_id"] for h in response.json()["hits"]}


@pytest.mark.asyncio
@pytest.mark.parametrize("q", ["décret", "DECRET", "decret", "prefet"])
async def test_document_list_title_ignores_accents(client_as, db_seed, accent_seed, q):
    assert accent_seed["title"] in await _list_ids(client_as, db_seed, q)
    assert accent_seed["other"] not in await _list_ids(client_as, db_seed, q)


@pytest.mark.asyncio
@pytest.mark.parametrize("q", ["décret", "DECRET", "decret", "abroge"])
async def test_search_ignores_accents_in_title_and_ocr(auth_client, accent_seed, q):
    found = await _search_ids(auth_client, q)
    if q != "abroge":
        assert accent_seed["title"] in found
    assert accent_seed["ocr"] in found
    assert accent_seed["other"] not in found


@pytest.mark.asyncio
async def test_literal_match_still_escapes_like_wildcards(
    client_as, db_seed, accent_seed
):
    # « % » is matched literally even once the pattern goes through unaccent().
    assert await _list_ids(client_as, db_seed, "%") == set()


def test_migration_setup_matches_app_setup():
    """The migration holds a frozen copy of the setup the test schema uses."""
    spec = importlib.util.spec_from_file_location("unaccent_migration", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert tuple(s.strip() for s in module.SETUP_SQL) == tuple(
        s.strip() for s in UNACCENT_SETUP_SQL
    )
