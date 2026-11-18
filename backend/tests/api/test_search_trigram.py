"""« Contains » search is served by indexes, not by a full table scan.

``q`` on the document list and the search engine match with ILIKE '%…%' and a
stemmed title vector. Each branch of their OR must hit an index, otherwise
PostgreSQL falls back to reading every document. With sequential scans disabled,
a plan still showing ``Seq Scan on documents`` means a branch has no usable
index (often a query expression that drifted from the index expression).
"""

import importlib.util
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import insert, select, text

from app.api.v1.endpoints.documents import _apply_text_filter
from app.core.search.fts import TRIGRAM_SETUP_SQL
from app.core.search.interfaces import SearchQuery
from app.core.search.postgres_engine import PostgresSearchEngine
from app.models.document import Document

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "alembic"
    / "versions"
    / "60e40a686375_trigram_indexes_for_contains_search.py"
)


ROWS = 3000


@pytest_asyncio.fixture
async def one_tenant_table(db_session, db_seed):
    """A table where the tenant filter keeps every row, as in production: only
    the text conditions can narrow it, so their indexes must be usable.

    No category: a single category shared by every row would make the planner
    expect ``document_category_id = ANY(…)`` to keep them all, unlike real data
    spread over many categories, and give up the index combination for that."""
    await db_session.execute(
        insert(Document),
        [
            dict(
                tenant_id=db_seed["tenant_id"],
                org_unit_id=db_seed["org_unit_id"],
                owner_id=db_seed["user_id"],
                title=f"Courrier arrivé n° {i}",
                tags=["courrier", f"lot-{i % 50}"],
                file_path=f"/tmp/{i}.pdf",
            )
            for i in range(ROWS)
        ],
    )
    await db_session.commit()
    await db_session.execute(text("ANALYZE documents"))
    await db_session.commit()
    return db_seed["tenant_id"]


async def _plan(db_session, statement) -> str:
    """EXPLAIN of ``statement`` exactly as the app sends it (same SQL, same binds)."""
    conn = await db_session.connection()
    compiled = statement.compile(dialect=conn.dialect)
    params = tuple(compiled.params[name] for name in compiled.positiontup)
    await conn.exec_driver_sql("SET LOCAL enable_seqscan = off")
    rows = await conn.exec_driver_sql(f"EXPLAIN {compiled}", params)
    plan = "\n".join(row[0] for row in rows)
    await db_session.rollback()
    return plan


@pytest.mark.asyncio
async def test_document_list_filter_uses_indexes(db_session, one_tenant_table):
    statement = _apply_text_filter(
        select(Document.id).where(Document.tenant_id == one_tenant_table), "décret"
    )
    plan = await _plan(db_session, statement)
    assert "Seq Scan on documents" not in plan, plan
    assert "idx_documents_title_trgm" in plan, plan
    assert "idx_documents_tags_trgm" in plan, plan


@pytest.mark.asyncio
async def test_search_engine_uses_indexes(db_session, one_tenant_table):
    engine = PostgresSearchEngine(db_session)
    statement = engine.build_statement(
        SearchQuery(text="décret", tenant_id=one_tenant_table)
    )
    plan = await _plan(db_session, statement)
    assert "Seq Scan on documents" not in plan, plan
    for index in (
        "idx_documents_ocr_vector",
        "idx_documents_title_fts",
        "idx_documents_title_trgm",
    ):
        assert index in plan, plan


def test_migration_setup_matches_app_setup():
    """The migration holds a frozen copy of the setup the test schema uses."""
    spec = importlib.util.spec_from_file_location("trigram_migration", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert tuple(s.strip() for s in module.SETUP_SQL) == tuple(
        s.strip() for s in TRIGRAM_SETUP_SQL
    )
