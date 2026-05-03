"""
Search Engine - Abstract Interface (SRP: Define the search contract)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Any, Optional
from uuid import UUID
from enum import Enum


class SortOrder(Enum):
    RELEVANCE = "relevance"
    DATE_ASC = "date_asc"
    DATE_DESC = "date_desc"
    TITLE_ASC = "title_asc"


@dataclass
class SearchQuery:
    """Structured search query"""

    text: str
    tenant_id: UUID
    # Filters
    category: Optional[str] = None
    status: Optional[str] = None
    owner_id: Optional[UUID] = None
    org_unit_id: Optional[UUID] = None
    file_type: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    # Pagination
    offset: int = 0
    limit: int = 20
    # Sorting
    sort: SortOrder = SortOrder.RELEVANCE


@dataclass
class SearchHit:
    """Single search result"""

    document_id: UUID
    title: str
    score: float
    highlight: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    file_type: Optional[str] = None
    tags: Optional[list[str]] = None
    owner_id: Optional[UUID] = None
    created_at: Optional[str] = None


@dataclass
class SearchResult:
    """Full search response with metadata"""

    hits: list[SearchHit]
    total_count: int
    query_text: str
    took_ms: float
    engine: str


class ISearchEngine(ABC):
    """
    Abstract Search Engine Interface
    SRP: Define the contract all search engines must follow

    Current implementations:
    - PostgresSearchEngine: Uses PostgreSQL TSVECTOR + GIN index

    Future implementations:
    - ElasticsearchEngine: Uses Elasticsearch cluster
    """

    @abstractmethod
    async def search(self, query: SearchQuery) -> SearchResult:
        """Execute a full-text search"""
        pass

    @abstractmethod
    async def index_document(
        self, document_id: str, text: str, metadata: Dict[str, Any] = None
    ) -> bool:
        """Index or re-index a document for search"""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Engine name"""
        pass
