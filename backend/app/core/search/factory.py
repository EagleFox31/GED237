"""
Search Engine Factory (SRP: Instantiate the correct engine)
"""

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.search.interfaces import ISearchEngine
from app.core.search.postgres_engine import PostgresSearchEngine


def get_search_engine(db: AsyncSession, engine_type: str = "postgres") -> ISearchEngine:
    """
    Factory to retrieve the configured search engine.

    Current:
    - "postgres": PostgresSearchEngine (TSVECTOR + GIN)

    Future:
    - "elastic": ElasticsearchEngine
    """
    if engine_type == "postgres":
        return PostgresSearchEngine(db)
    # elif engine_type == "elastic":
    #     return ElasticsearchEngine(...)
    else:
        raise ValueError(f"Unknown search engine type: {engine_type}")
