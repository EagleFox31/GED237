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
