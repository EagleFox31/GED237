"""API-test fixtures for components that open their own database sessions."""

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

import app.services.gedrules_listeners as gedrules_listeners


@pytest_asyncio.fixture(autouse=True)
async def bind_gedrules_listener_session_to_test_engine(test_engine, monkeypatch):
    """Keep GEDRules listener sessions on the current test's event loop/engine.

    FastAPI's ``get_db`` dependency is overridden by the root test fixtures, but
    the GEDRules DOCUMENT_CREATED listener deliberately opens an independent
    session from its module-level ``async_session_maker``. In pytest each async
    test may run on a fresh event loop, so reusing the application's pooled
    asyncpg engine across tests can hand the listener a connection attached to
    a previous loop.

    Bind only the listener's session factory to the per-test ``test_engine``.
    This preserves the production design (the listener still owns a dedicated
    AsyncSession) while keeping API tests isolated and deterministic.
    """
    session_factory = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    monkeypatch.setattr(
        gedrules_listeners,
        "async_session_maker",
        session_factory,
    )
    yield
