from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from enum import Enum


class SortOrderEnum(str, Enum):
    relevance = "relevance"
    date_asc = "date_asc"
    date_desc = "date_desc"
    title_asc = "title_asc"


class SearchRequest(BaseModel):
    """Search query from user"""

    q: str = Field(..., min_length=1, max_length=500, description="Search text")
    category: Optional[str] = None
    status: Optional[str] = None
    file_type: Optional[str] = None
    tags: Optional[List[str]] = None
    sort: SortOrderEnum = SortOrderEnum.relevance
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=20, ge=1, le=100)


class SearchHitResponse(BaseModel):
    """Single search result"""

    document_id: UUID
    title: str
    score: float
    highlight: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    file_type: Optional[str] = None
    tags: Optional[List[str]] = None
    owner_id: Optional[UUID] = None
    created_at: Optional[str] = None


class SearchResponse(BaseModel):
    """Full search response"""

    hits: List[SearchHitResponse]
    total_count: int
    query: str
    took_ms: float
    engine: str
