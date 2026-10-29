"""
PostgreSQL Full-Text Search Engine (SRP: Handle Postgres-specific search)
Uses TSVECTOR + GIN index already configured on the documents table
"""

import time
from typing import Dict, Any

from sqlalchemy import func, desc, asc, or_, text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.search.interfaces import (
    ISearchEngine,
    SearchQuery,
    SearchResult,
    SearchHit,
    SortOrder,
)
from app.models.document import Document


class PostgresSearchEngine(ISearchEngine):
    """
    PostgreSQL Full-Text Search Implementation

    Uses:
    - to_tsvector / plainto_tsquery for French + English text search
    - ts_rank for relevance scoring
    - ts_headline for highlighted snippets
    - GIN index (idx_documents_ocr_vector) for performance

    Good for: up to ~1M documents, zero extra infrastructure
    """

    FTS_CONFIG = "french"

    def __init__(self, db: AsyncSession):
        self.db = db

    @property
    def name(self) -> str:
        return "PostgreSQL FTS"

    async def search(self, query: SearchQuery) -> SearchResult:
        """
        Full-text search across documents

        Searches in:
        1. ocr_content_vector (TSVECTOR - indexed via GIN, fast)
        2. title (ILIKE fallback for documents without OCR)
        """
        start_time = time.time()

        ts_query = func.plainto_tsquery(self.FTS_CONFIG, query.text)

        # Relevance score
        rank = func.ts_rank(
            func.coalesce(
                Document.ocr_content_vector, func.to_tsvector(self.FTS_CONFIG, "")
            ),
            ts_query,
        )

        # Highlighted snippet
        headline = func.ts_headline(
            self.FTS_CONFIG,
            func.coalesce(Document.ocr_content, ""),
            ts_query,
            sql_text("'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=20'"),
        )

        # Base query with tenant isolation
        title_match = func.to_tsvector(self.FTS_CONFIG, Document.title).op("@@")(
            ts_query
        )
        content_match = Document.ocr_content_vector.op("@@")(ts_query)

        stmt = (
            select(Document, rank.label("relevance"), headline.label("headline"))
            .filter(
                Document.tenant_id == query.tenant_id,
            )
            .filter(
                or_(content_match, title_match, Document.title.ilike(f"%{query.text}%"))
            )
        )

        # Apply filters
        if query.category:
            stmt = stmt.filter(Document.category == query.category)
        if query.status:
            stmt = stmt.filter(Document.status == query.status)
        if query.owner_id:
            stmt = stmt.filter(Document.owner_id == query.owner_id)
        if query.org_unit_id:
            stmt = stmt.filter(Document.org_unit_id == query.org_unit_id)
        if query.file_type:
            stmt = stmt.filter(Document.file_type == query.file_type)
        if query.tags:
            stmt = stmt.filter(Document.tags.overlap(query.tags))

        # Count total before pagination
        count_stmt = select(func.count()).select_from(stmt.subquery())
        count_result = await self.db.execute(count_stmt)
        total_count = count_result.scalar() or 0

        # Sorting
        if query.sort == SortOrder.RELEVANCE:
            stmt = stmt.order_by(desc("relevance"))
        elif query.sort == SortOrder.DATE_DESC:
            stmt = stmt.order_by(desc(Document.created_at))
        elif query.sort == SortOrder.DATE_ASC:
            stmt = stmt.order_by(asc(Document.created_at))
        elif query.sort == SortOrder.TITLE_ASC:
            stmt = stmt.order_by(asc(Document.title))

        # Pagination
        stmt = stmt.offset(query.offset).limit(query.limit)

        result = await self.db.execute(stmt)
        rows = result.all()

        # Build hits
        hits = []
        for row in rows:
            doc = row[0]
            relevance = float(row[1]) if row[1] else 0.0
            snippet = row[2] if row[2] else None

            normalized_score = min(relevance / 1.0, 1.0) if relevance > 0 else 0.1

            hits.append(
                SearchHit(
                    document_id=doc.id,
                    title=doc.title,
                    score=round(normalized_score, 4),
                    highlight=snippet,
                    category=doc.category,
                    status=doc.status,
                    file_type=doc.file_type,
                    tags=doc.tags,
                    owner_id=doc.owner_id,
                    created_at=doc.created_at.isoformat() if doc.created_at else None,
                )
            )

        took_ms = (time.time() - start_time) * 1000

        return SearchResult(
            hits=hits,
            total_count=total_count,
            query_text=query.text,
            took_ms=round(took_ms, 2),
            engine=self.name,
        )

    async def index_document(
        self, document_id: str, text: str, metadata: Dict[str, Any] = None
    ) -> bool:
        """
        Index document content into TSVECTOR column
        Also done in tasks.py after OCR - this allows manual re-indexing
        """
        try:
            document = await self.db.get(Document, document_id)
            if not document:
                return False

            document.ocr_content_vector = func.to_tsvector(self.FTS_CONFIG, text)
            await self.db.commit()
            return True
        except Exception as e:
            print(f"Indexing error: {e}")
            return False
