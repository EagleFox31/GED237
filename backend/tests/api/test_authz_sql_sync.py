"""Additive CSV -> SQL policy sync (#232): rules added to policy.csv later reach
a SQL policy store that is already in use, without touching the rules changed
through the admin API. A converged store gives zero writes."""

import os
import tempfile

import pytest
from sqlalchemy import create_engine, text

from app.core.authz.casbin_enforcer import (
    add_sql_policy,
    bootstrap_sql_policies_from_csv,
    csv_sql_policy_drift,
    enforce_permission,
    get_known_roles_from_csv,
    reload_enforcer,
    sync_sql_policies_from_csv,
)
from app.core.config import settings
from app.models.casbin_rule import CasbinRule

API_RULE = ["auditor", "__api_resource__", "read"]


@pytest.fixture
async def sql_store():
    fd, path = tempfile.mkstemp(prefix="authz_sql_sync_", suffix=".db")
    os.close(fd)
    url = f"sqlite:///{path}"
    engine = create_engine(url, future=True)
    CasbinRule.__table__.create(bind=engine)
    old_backend = settings.AUTHZ_BACKEND
    old_url = settings.AUTHZ_POLICY_DATABASE_URL
    settings.AUTHZ_BACKEND = "sql"
    settings.AUTHZ_POLICY_DATABASE_URL = url
    await reload_enforcer()
    try:
        yield engine
    finally:
        settings.AUTHZ_BACKEND = old_backend
        settings.AUTHZ_POLICY_DATABASE_URL = old_url
        try:
            await reload_enforcer()
        finally:
            engine.dispose()
            try:
                os.remove(path)
            except (FileNotFoundError, PermissionError):
                pass


def _state(engine) -> tuple[int, int, int]:
    """(rows, highest id, policy version): any write changes one of them."""
    with engine.connect() as conn:
        rows, top = conn.execute(
            text("SELECT COUNT(*), COALESCE(MAX(id), 0) FROM casbin_rule")
        ).one()
        has_version = conn.execute(
            text(
                "SELECT COUNT(*) FROM sqlite_master "
                "WHERE type='table' AND name='authz_policy_version'"
            )
        ).scalar_one()
        version = (
            conn.execute(
                text("SELECT version FROM authz_policy_version WHERE id = 1")
            ).scalar_one()
            if has_version
            else 0
        )
    return int(rows), int(top), int(version)


def _no_missing(drift) -> bool:
    return not drift["missing_p"] and not drift["missing_g"]


@pytest.mark.asyncio
async def test_sync_fills_an_empty_store_then_a_second_run_writes_nothing(sql_store):
    inserted = await sync_sql_policies_from_csv()
    assert inserted > 0

    drift = await csv_sql_policy_drift()
    # CSV and SQL now hold the same rules.
    assert _no_missing(drift) and not drift["sql_only_p"] and not drift["sql_only_g"]
    assert await enforce_permission("collaborator", "documents", "read_own")

    before = _state(sql_store)
    assert await sync_sql_policies_from_csv() == 0
    assert _state(sql_store) == before


@pytest.mark.asyncio
async def test_sync_adds_a_rule_new_in_the_csv_and_keeps_api_changes(sql_store):
    await bootstrap_sql_policies_from_csv(force=True)
    assert await add_sql_policy(API_RULE)
    # A store bootstrapped before a rule was added to policy.csv.
    with sql_store.begin() as conn:
        conn.execute(
            text(
                "DELETE FROM casbin_rule WHERE ptype='p' AND v0='tenant_admin' "
                "AND v1='documents' AND v2='delete'"
            )
        )
    await reload_enforcer()
    assert not await enforce_permission("tenant_admin", "documents", "delete")
    drift = await csv_sql_policy_drift()
    assert drift["missing_p"] == [["tenant_admin", "documents", "delete"]]

    assert await sync_sql_policies_from_csv() == 1

    await reload_enforcer()
    assert await enforce_permission("tenant_admin", "documents", "delete")
    assert await enforce_permission(*API_RULE)
    drift = await csv_sql_policy_drift()
    assert _no_missing(drift) and drift["sql_only_p"] == [API_RULE]


@pytest.mark.asyncio
async def test_dry_run_lists_without_writing(sql_store):
    before = _state(sql_store)

    planned = await sync_sql_policies_from_csv(dry_run=True)

    assert planned > 0
    assert _state(sql_store) == before
    assert len((await csv_sql_policy_drift())["missing_p"]) > 0


@pytest.mark.asyncio
async def test_every_csv_role_is_enforced_by_sql_after_sync(sql_store):
    await sync_sql_policies_from_csv()
    await reload_enforcer()
    drift = await csv_sql_policy_drift()
    assert _no_missing(drift)
    # The roles of policy.csv all exist in SQL, not only one sample rule.
    with sql_store.connect() as conn:
        sql_roles = {
            row[0]
            for row in conn.execute(
                text("SELECT DISTINCT v0 FROM casbin_rule WHERE ptype='p'")
            )
        }
    assert get_known_roles_from_csv() <= sql_roles
