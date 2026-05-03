from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.core.search.factory import get_search_engine
from app.core.search.interfaces import SearchQuery, SortOrder
from app.schemas.search import SearchResponse, SearchHitResponse, SortOrderEnum

router = APIRouter()


@router.get("/", response_model=SearchResponse)
async def perform_search(
    q: str = Query(
        ..., min_length=1, max_length=500, description="Search query string"
    ),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    file_type: Optional[str] = Query(None),
    org_unit_id: Optional[UUID] = Query(None),
    tags: Optional[List[str]] = Query(None),
    sort: SortOrderEnum = Query(SortOrderEnum.relevance),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SearchResponse:
    """
    Full-text search across documents (OCR content + title).
    Uses PostgreSQL TSVECTOR with GIN index.
    """
    search_engine = get_search_engine(db, engine_type="postgres")

    # Map API sort enum to internal enum
    sort_mapping = {
        SortOrderEnum.relevance: SortOrder.RELEVANCE,
        SortOrderEnum.date_asc: SortOrder.DATE_ASC,
        SortOrderEnum.date_desc: SortOrder.DATE_DESC,
        SortOrderEnum.title_asc: SortOrder.TITLE_ASC,
    }

    query = SearchQuery(
        text=q,
        tenant_id=current_user.tenant_id,
        category=category,
        status=status,
        org_unit_id=org_unit_id,
        file_type=file_type,
        tags=tags or [],
        offset=offset,
        limit=limit,
        sort=sort_mapping[sort],
    )

    result = await search_engine.search(query)

    return SearchResponse(
        hits=[
            SearchHitResponse(
                document_id=hit.document_id,
                title=hit.title,
                score=hit.score,
                highlight=hit.highlight,
                category=hit.category,
                status=hit.status,
                file_type=hit.file_type,
                tags=hit.tags,
                owner_id=hit.owner_id,
                created_at=hit.created_at,
            )
            for hit in result.hits
        ],
        total_count=result.total_count,
        query=result.query_text,
        took_ms=result.took_ms,
        engine=result.engine,
    )
