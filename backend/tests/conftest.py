# backend/tests/conftest.py
import os
import uuid
from contextlib import asynccontextmanager
from unittest.mock import MagicMock

# Force test database URL BEFORE any app imports
# CI/CD requirement: TEST_DATABASE_URL must be provided as environment variable
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    raise RuntimeError(
        "TEST_DATABASE_URL environment variable is required for tests. "
        "Set it to a PostgreSQL connection string like: "
        "postgresql+asyncpg://user:pass@host:port/db"
    )
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

# Optional Redis URL for auth tests (defaults to config.py default if not set)
TEST_REDIS_URL = os.getenv("TEST_REDIS_URL", "redis://localhost:6379/0")
os.environ["REDIS_URL"] = TEST_REDIS_URL

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from typing import AsyncGenerator, AsyncIterator

from app.main import app
from app.core.database import get_db, Base
from app.core.dependencies import get_current_user
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.org_unit import OrgUnit
from app.models.user import User
from app.core.security import hash_password
import app.core.redis as _redis_module


@pytest.fixture(autouse=True)
def reset_redis_singleton():
    """
    Reset the Redis global singleton before each test so that each test
    obtains a fresh connection bound to its own asyncio event loop.
    Without this, the second test that calls get_redis() reuses a client
    created in the previous test's (now-closed) event loop and gets a 500.
    """
    _redis_module.redis_client = None
    yield
    _redis_module.redis_client = None


@pytest_asyncio.fixture
async def test_engine():
    """Create an isolated engine for the current test context."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def prepare_database(test_engine):
    """Reset application tables before and after every test.

    CI runs Alembic migrations before pytest, and some migrations seed reference
    data such as roles. A bare ``create_all`` therefore preserves those rows and
    makes test fixtures that use deterministic primary keys fail on the very
    first test. Drop/create gives each test the same clean starting state,
    independent of whether the database was freshly migrated or reused locally.
    """
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session for direct DB operations in tests."""
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def db_seed(test_engine):
    """
    Insert the minimal set of rows required to satisfy all FK constraints
    when creating documents: Role → Tenant → OrgUnit → User.

    Returns a dict with the created IDs and the User ORM object.
    """
    tenant_id = uuid.uuid4()
    org_unit_id = uuid.uuid4()
    user_id = uuid.uuid4()
    role_id = 3  # integer PK

    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        # 1. Role (integer PK, no UUID)
        role = Role(
            id=role_id,
            code="standard",
            label="Standard User",
            hierarchy_level=3,
        )
        session.add(role)
        await session.flush()

        # 2. Tenant
        tenant = Tenant(
            id=tenant_id,
            name="Test Ministry",
            short_name="TESTMIN",
            domain=f"testmin-{tenant_id}.gov.cm",
            is_active=True,
        )
        session.add(tenant)
        await session.flush()

        # 3. OrgUnit (level=1, no parent)
        org_unit = OrgUnit(
            id=org_unit_id,
            tenant_id=tenant_id,
            code="DIR-TEST",
            name="Direction Test",
            level=1,
            is_active=True,
        )
        session.add(org_unit)
        await session.flush()

        # 4. User
        user = User(
            id=user_id,
            tenant_id=tenant_id,
            org_unit_id=org_unit_id,
            role_id=role_id,
            matricule="TEST001",
            email="test@testministry.gov.cm",
            first_name="Test",
            last_name="User",
            password_hash=hash_password("testpassword123"),
            is_active=True,
        )
        session.add(user)
        await session.flush()

        # 5. DocumentCategory
        from app.models.document_category import DocumentCategory

        category_id = uuid.uuid4()
        cat = DocumentCategory(
            id=category_id,
            tenant_id=tenant_id,
            code="note_de_service",
            name="Note de Service",
            is_active=True,
        )
        session.add(cat)
        await session.flush()

        # 6. GEDRules: WorkflowTemplate
        from app.models.gedrules import (
            WorkflowTemplate,
            WorkflowTemplateStep,
            RoutingRule,
            AssignmentScope,
        )
        from app.models.workflow import ActionType

        template_id = uuid.uuid4()
        template = WorkflowTemplate(
            id=template_id,
            tenant_id=tenant_id,
            code="NS_TEMPLATE",
            name="Template Note de Service",
            is_active=True,
        )
        session.add(template)
        await session.flush()

        # 7. WorkflowTemplateStep
        t_step = WorkflowTemplateStep(
            id=uuid.uuid4(),
            template_id=template_id,
            step_order=1,
            label="Visa Direction",
            expected_action_type=ActionType.visa,
            role_id=role_id,  # Assigne au même rôle que le user seedé
            assignment_scope=AssignmentScope.same_org_unit,
        )
        session.add(t_step)
        await session.flush()

        # 8. RoutingRule
        # RoutingRule is multi-category / multi-org-unit now. Use ORM
        # relationships instead of the removed legacy scalar FK fields
        # document_category_id and org_unit_id.
        rule_id = uuid.uuid4()
        rule = RoutingRule(
            id=rule_id,
            tenant_id=tenant_id,
            code="NS_RULE",
            name="Règle Note de Service",
            priority=10,
            document_categories=[cat],
            org_units=[],  # Empty list means the rule is not restricted to one unit.
            workflow_template_id=template_id,
            is_active=True,
        )
        session.add(rule)
        await session.commit()

    return {
        "tenant_id": tenant_id,
        "org_unit_id": org_unit_id,
        "user_id": user_id,
        "role_id": role_id,
        "category_id": category_id,
        "template_id": template_id,
        "rule_id": rule_id,
    }


def _make_fake_user(
    role_code: str = "standard",
    role_id: int = 3,
    user_id: uuid.UUID | None = None,
    tenant_id: uuid.UUID | None = None,
    org_unit_id: uuid.UUID | None = None,
) -> User:
    """Build a fake User with a mocked role relationship."""
    fake_role = MagicMock()
    fake_role.code = role_code
    fake_role.label = role_code.replace("_", " ").title()
    fake_role.id = role_id

    fake_user = User(
        id=user_id or uuid.uuid4(),
        email="test@testministry.gov.cm",
        password_hash="fakehash",
        first_name="Test",
        last_name="User",
        matricule="TEST001",
        role_id=role_id,
        tenant_id=tenant_id or uuid.uuid4(),
        org_unit_id=org_unit_id or uuid.uuid4(),
        is_active=True,
    )
    fake_user.role = fake_role
    return fake_user


@pytest_asyncio.fixture
async def async_client(test_engine) -> AsyncGenerator[AsyncClient, None]:
    """Provide an async test client for FastAPI (no auth)."""
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def auth_client(test_engine, db_seed) -> AsyncGenerator[AsyncClient, None]:
    """Async test client with a standard-role user (bypasses JWT).
    Uses real DB rows (Tenant, OrgUnit, User) so FK constraints are satisfied.
    """
    fake_user = _make_fake_user(
        role_code="standard",
        role_id=db_seed["role_id"],
        user_id=db_seed["user_id"],
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    )
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_db():
        async with session_factory() as session:
            yield session

    async def override_get_current_user():
        return fake_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def admin_client(test_engine, db_seed) -> AsyncGenerator[AsyncClient, None]:
    """Async test client with a super_admin-role user (bypasses JWT).
    Uses real DB rows (Tenant, OrgUnit, User) so FK constraints are satisfied.
    """
    fake_user = _make_fake_user(
        role_code="super_admin",
        role_id=db_seed["role_id"],
        user_id=db_seed["user_id"],
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    )
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_db():
        async with session_factory() as session:
            yield session

    async def override_get_current_user():
        return fake_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def client_as(test_engine):
    """Factory for a client authenticated as any role (bypasses JWT).

    ``async with client_as("unit_admin", tenant_id=..., org_unit_id=None) as c:``
    Keyword arguments are set on the fake user as-is, so ``None`` really means
    ``None``. Clients share the app's dependency overrides: open them one at a
    time, and not alongside ``auth_client`` / ``admin_client``.
    """
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_db():
        async with session_factory() as session:
            yield session

    @asynccontextmanager
    async def _client(role_code: str, **user_fields) -> AsyncIterator[AsyncClient]:
        fake_user = _make_fake_user(role_code=role_code)
        for field, value in user_fields.items():
            setattr(fake_user, field, value)

        async def override_get_current_user():
            return fake_user

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(
                transport=transport, base_url="http://test"
            ) as client:
                yield client
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(get_db, None)

    return _client
