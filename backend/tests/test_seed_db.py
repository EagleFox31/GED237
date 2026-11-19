"""scripts/seed_db.py must converge on a database already populated by the
alembic migrations (LESSON-2026-021): same reference codes, no look-alike rows,
a second pass leaves counts and ids unchanged."""

import importlib.util
import pathlib
import re

import pytest
from sqlalchemy import func, select

from app.core.schema_check import SchemaStatus
from app.models.org_unit import OrgUnitType

BACKEND = pathlib.Path(__file__).resolve().parents[1]


def _load_seed_module():
    spec = importlib.util.spec_from_file_location(
        "seed_db", BACKEND / "scripts/seed_db.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _migration_org_unit_type_codes():
    text = (BACKEND / "alembic/versions/001_initial_schema.py").read_text(
        encoding="utf-8"
    )
    block = re.search(
        r"INSERT INTO org_unit_types \(code, label, level\) VALUES(.*?)\"\"\"",
        text,
        re.S,
    )
    return set(re.findall(r"\('([A-Za-z_]+)',", block.group(1)))


def test_seed_org_unit_types_are_the_migration_rows():
    seed_db = _load_seed_module()
    seeded = {row["code"] for row in seed_db.ORG_UNIT_TYPES}
    migrated = _migration_org_unit_type_codes()
    assert seeded <= migrated, seeded - migrated


@pytest.mark.asyncio
async def test_upsert_by_code_is_idempotent(db_session):
    seed_db = _load_seed_module()
    rows = lambda: [OrgUnitType(**row) for row in seed_db.ORG_UNIT_TYPES]  # noqa: E731
    first = await seed_db.upsert_by_code(db_session, OrgUnitType, rows())
    second = await seed_db.upsert_by_code(db_session, OrgUnitType, rows())
    assert first == second
    count = await db_session.scalar(select(func.count()).select_from(OrgUnitType))
    assert count == len(seed_db.ORG_UNIT_TYPES)


@pytest.mark.asyncio
async def test_seed_refuses_a_database_not_at_head(monkeypatch):
    """The schema comes from the migrations: no create_all, an actionable exit."""
    seed_db = _load_seed_module()

    async def not_at_head(engine):
        return SchemaStatus(current=frozenset(), expected=frozenset({"head"}))

    monkeypatch.setattr(seed_db, "get_schema_status", not_at_head)
    with pytest.raises(SystemExit) as exc:
        await seed_db.seed()
    assert exc.value.code == 2


async def _minfi_daf(db_session):
    from app.models.org_unit import OrgUnit
    from app.models.tenant import Tenant

    tenant = Tenant(
        name="Ministère des Finances",
        short_name="MINFI",
        domain="minfi-seed-test.gov.cm",
        is_active=True,
    )
    db_session.add(tenant)
    await db_session.flush()
    unit = OrgUnit(
        tenant_id=tenant.id, code="MINFI-DAF", name="DAF", level=1, is_active=True
    )
    db_session.add(unit)
    await db_session.flush()
    return unit


@pytest.mark.asyncio
async def test_extra_demo_users_are_added_once_to_an_already_seeded_database(
    db_session, db_seed
):
    """A database seeded before MINFI003 existed gets the third DAF agent on the next
    pass (the MINFI guard skips the user block); the pass after that writes nothing."""
    from app.models.user import User

    seed_db = _load_seed_module()
    unit = await _minfi_daf(db_session)
    role_ids = {"collaborator": db_seed["role_id"]}

    first = await seed_db.ensure_extra_demo_users(db_session, role_ids)
    second = await seed_db.ensure_extra_demo_users(db_session, role_ids)
    await db_session.commit()

    agents = (
        (await db_session.execute(select(User).where(User.matricule == "MINFI003")))
        .scalars()
        .all()
    )
    assert (first, second) == (1, 0)
    assert [(a.org_unit_id, a.is_active) for a in agents] == [(unit.id, True)]


@pytest.mark.asyncio
async def test_extra_demo_users_never_modify_an_existing_account(db_session, db_seed):
    from app.models.user import User

    seed_db = _load_seed_module()
    unit = await _minfi_daf(db_session)
    db_session.add(
        User(
            tenant_id=unit.tenant_id,
            org_unit_id=unit.id,
            role_id=db_seed["role_id"],
            matricule="MINFI003",
            email="renamed@minfi.gov.cm",
            first_name="Nom",
            last_name="Choisi",
            password_hash="kept",
            is_active=False,
        )
    )
    await db_session.flush()

    created = await seed_db.ensure_extra_demo_users(
        db_session, {"collaborator": db_seed["role_id"]}
    )

    agent = await db_session.scalar(select(User).where(User.matricule == "MINFI003"))
    assert created == 0
    assert (agent.last_name, agent.password_hash, agent.is_active) == (
        "Choisi",
        "kept",
        False,
    )
