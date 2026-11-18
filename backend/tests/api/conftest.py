"""API-test fixtures for components that open their own database sessions."""

import pytest
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


# ── Delegation during an absence (DEC-2026-007) ───────────────────────────────

_WORLD_USERS = {
    # name: (role code, unit key, first name, last name, extra fields)
    "absent": ("collaborator", "u", "Awa", "Absente", {}),
    "standin": ("collaborator", "u", "Paul", "Interim", {}),
    "third": ("collaborator", "u", "Chantal", "Tierce", {}),
    "manager_u": ("manager", "u", "Marc", "Chef", {}),
    "manager_v": ("manager", "v", "Victor", "Autre", {}),
    "admin": ("tenant_admin", "u", "Alice", "Admin", {}),
    "reader": ("reader", "u", "Rita", "Lectrice", {}),
    "inactive": ("collaborator", "u", "Ina", "Ctive", {"is_active": False}),
}
_WORLD_ROLES = {"collaborator": 3, "manager": 71, "tenant_admin": 72, "reader": 74}


@pytest_asyncio.fixture
async def delegation_world(test_engine, db_seed):
    """Two services of one institution, agents of each role, a foreign agent,
    and a document of ``absent`` whose current step is assigned to ``absent``."""
    from datetime import datetime, timezone
    from uuid import uuid4

    from app.models.document import Document
    from app.models.document_version import DocumentVersion
    from app.models.org_unit import OrgUnit
    from app.models.role import Role
    from app.models.tenant import Tenant
    from app.models.user import User
    from app.models.workflow import ActionType, WorkflowStep

    tenant_id = db_seed["tenant_id"]
    foreign_tenant_id = uuid4()
    units = {"u": db_seed["org_unit_id"], "v": uuid4()}
    factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with factory() as session:
        session.add_all(
            [
                Role(id=71, code="manager", label="Manager", hierarchy_level=4),
                Role(id=72, code="tenant_admin", label="Admin", hierarchy_level=2),
                Role(id=74, code="reader", label="Lecteur", hierarchy_level=6),
                OrgUnit(
                    id=units["v"],
                    tenant_id=tenant_id,
                    code="DIR-AUTRE",
                    name="Direction Autre",
                    level=1,
                    is_active=True,
                ),
                Tenant(
                    id=foreign_tenant_id,
                    name="Other Ministry",
                    short_name="OTHER",
                    domain=f"other-{foreign_tenant_id}.gov.cm",
                    is_active=True,
                ),
            ]
        )
        await session.flush()
        users = {}
        for name, (role, unit, first, last, extra) in _WORLD_USERS.items():
            uid = uuid4()
            users[name] = User(
                id=uid,
                tenant_id=tenant_id,
                org_unit_id=units[unit],
                role_id=_WORLD_ROLES[role],
                matricule=f"DLG-{uid.hex[:8]}",
                email=f"{uid.hex[:8]}@testministry.gov.cm",
                password_hash="x",
                first_name=first,
                last_name=last,
                is_active=extra.get("is_active", True),
            )
        uid = uuid4()
        users["foreign"] = User(
            id=uid,
            tenant_id=foreign_tenant_id,
            role_id=3,
            matricule=f"DLG-{uid.hex[:8]}",
            email=f"{uid.hex[:8]}@other.gov.cm",
            password_hash="x",
            first_name="Fo",
            last_name="Reign",
            is_active=True,
        )
        session.add_all(users.values())
        await session.flush()

        document = Document(
            id=uuid4(),
            tenant_id=tenant_id,
            org_unit_id=units["u"],
            owner_id=users["absent"].id,
            title="Note à viser",
            file_path=f"tenant/unit/{uuid4()}.pdf",
            file_type="pdf",
            mime_type="application/pdf",
            file_size=128,
            document_category_id=db_seed["category_id"],
            processing_mode="archive",
            status="in_review",
            classification_status="classified",
        )
        session.add(document)
        await session.flush()
        version = DocumentVersion(
            document_id=document.id,
            version_number="1.0",
            file_path=document.file_path,
            file_size=128,
            mime_type="application/pdf",
            uploaded_by_id=users["absent"].id,
            uploaded_at=datetime.now(timezone.utc),
        )
        session.add(version)
        await session.flush()
        document.current_version_id = version.id
        step = WorkflowStep(
            document_id=document.id,
            step_order=1,
            label="Visa",
            status="current",
            assigned_to=users["absent"].id,
            expected_action_type=ActionType.visa,
        )
        session.add(step)
        await session.commit()

    return {
        "tenant_id": tenant_id,
        "units": units,
        "users": users,
        "roles": {name: spec[0] for name, spec in _WORLD_USERS.items()}
        | {"foreign": "collaborator"},
        "category_id": db_seed["category_id"],
        "document_id": document.id,
        "version_id": version.id,
        "step_id": step.id,
    }


@pytest.fixture
def as_agent(client_as, delegation_world):
    """``async with as_agent("standin") as client:`` — a world agent, real DB row."""

    def _as(name: str):
        user = delegation_world["users"][name]
        return client_as(
            delegation_world["roles"][name],
            id=user.id,
            tenant_id=user.tenant_id,
            org_unit_id=user.org_unit_id,
            first_name=user.first_name,
            last_name=user.last_name,
            matricule=user.matricule,
        )

    return _as
