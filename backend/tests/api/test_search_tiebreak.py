"""Search pages are stable when documents tie on the sort key.

Every document below has the same title, tags and creation date, so they tie on
relevance, date and title alike. Paging through the results must then give each
document exactly once, in one fixed order (by id), whatever the sort.
"""

import datetime as dt

import pytest
import pytest_asyncio
from sqlalchemy import insert, select

from app.core.search.interfaces import SearchQuery, SortOrder
from app.core.search.postgres_engine import PostgresSearchEngine
from app.models.document import Document

ROWS = 60
PAGE = 7
CREATED = dt.datetime(2026, 11, 2, 9, 30)


@pytest_asyncio.fixture
async def tied_documents(db_session, db_seed):
    await db_session.execute(
        insert(Document),
        [
            dict(
                tenant_id=db_seed["tenant_id"],
                org_unit_id=db_seed["org_unit_id"],
                owner_id=db_seed["user_id"],
                title="Courrier arrivé",
                tags=["courrier"],
                file_path=f"/tmp/{i}.pdf",
                created_at=CREATED,
            )
            for i in range(ROWS)
        ],
    )
    await db_session.commit()
    ids = (
        await db_session.execute(
            select(Document.id).where(Document.tenant_id == db_seed["tenant_id"])
        )
    ).scalars()
    return db_seed["tenant_id"], sorted(ids)


@pytest.mark.asyncio
@pytest.mark.parametrize("sort", list(SortOrder))
async def test_pages_list_each_tied_document_once_in_id_order(
    db_session, tied_documents, sort
):
    tenant_id, ids = tied_documents
    engine = PostgresSearchEngine(db_session)
    seen = []
    for offset in range(0, ROWS, PAGE):
        result = await engine.search(
            SearchQuery(
                text="courrier",
                tenant_id=tenant_id,
                sort=sort,
                offset=offset,
                limit=PAGE,
            )
        )
        assert result.total_count == ROWS
        seen += [hit.document_id for hit in result.hits]
    assert len(set(seen)) == ROWS, "a page repeated or skipped a document"
    assert seen == ids
