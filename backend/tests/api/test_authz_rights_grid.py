"""Rights grid (#280): tenant admins read the rules, only super admins change them, every
change lands in the audit journal, and csv mode serves the grid read-only."""

import os
import tempfile
from contextlib import asynccontextmanager

import pytest
from casbin import Enforcer
from httpx import AsyncClient
from sqlalchemy import create_engine, select

from app.core.authz import casbin_enforcer as casbin_enforcer_module
from app.core.authz.casbin_enforcer import reload_enforcer
from app.core.config import settings
from app.main import app
from app.models.audit import AuditLog
from app.models.casbin_rule import CasbinRule

POLICIES = "/api/v1/authz/policies"
RULE = {"ptype": "p", "v0": "collaborator", "v1": "categories", "v2": "create"}
RIGHTS_ACTIONS = ("authz_policy_added", "authz_policy_removed")


def _reset_rate_limit() -> None:
    storage = getattr(
        getattr(getattr(app.state, "limiter", None), "limiter", None), "storage", None
    )
    reset = getattr(storage, "reset", None) or getattr(storage, "clear", None)
    if callable(reset):
        reset()


@pytest.fixture(autouse=True)
def _fresh_policy_rate_limit():
    # Test clients share one IP, so the 10/minute policy bucket is shared too: start and
    # leave each test with an empty bucket so neither this file nor the next one hits 429.
    _reset_rate_limit()
    yield
    _reset_rate_limit()


@asynccontextmanager
async def _backend(name: str):
    """Switch the policy backend for one test; sql uses a throwaway sqlite store."""
    old_backend = settings.AUTHZ_BACKEND
    old_url = settings.AUTHZ_POLICY_DATABASE_URL
    path = engine = None
    try:
        settings.AUTHZ_BACKEND = name
        settings.AUTHZ_POLICY_DATABASE_URL = ""
        if name == "sql":
            fd, path = tempfile.mkstemp(prefix="authz_grid_", suffix=".db")
            os.close(fd)
            url = f"sqlite:///{path}"
            engine = create_engine(url, future=True)
            CasbinRule.__table__.create(bind=engine)
            settings.AUTHZ_POLICY_DATABASE_URL = url
        await reload_enforcer()
        yield
    finally:
        settings.AUTHZ_BACKEND = old_backend
        settings.AUTHZ_POLICY_DATABASE_URL = old_url
        try:
            await reload_enforcer()
        except Exception:
            pass
        if engine is not None:
            engine.dispose()
        if path:
            try:
                os.remove(path)
            except (FileNotFoundError, PermissionError):
                pass


def _csv_rules() -> list[list[str]]:
    enforcer = Enforcer(
        casbin_enforcer_module._MODEL_PATH, casbin_enforcer_module._POLICY_PATH
    )
    return enforcer.get_policy()


async def _rights_audit(db_session, user_id) -> list[AuditLog]:
    rows = await db_session.scalars(
        select(AuditLog)
        .where(AuditLog.user_id == user_id, AuditLog.action.in_(RIGHTS_ACTIONS))
        .order_by(AuditLog.created_at)
    )
    return list(rows)


@pytest.mark.asyncio
async def test_csv_mode_serves_policy_csv_read_only(admin_client: AsyncClient):
    async with _backend("csv"):
        resp = await admin_client.get(POLICIES)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        expected = _csv_rules()
        assert len(body) == len(expected) > 0
        # Same record shape as in sql mode: ptype plus v0..v5, unused columns null.
        assert all(
            set(row) == {"ptype", "v0", "v1", "v2", "v3", "v4", "v5"} for row in body
        )
        assert [
            [row[f"v{i}"] for i in range(len(rule))]
            for row, rule in zip(body, expected)
        ] == expected

        assert (await admin_client.post(POLICIES, json=RULE)).status_code == 409
        assert (
            await admin_client.request("DELETE", POLICIES, json=RULE)
        ).status_code == 409


@pytest.mark.asyncio
@pytest.mark.parametrize("backend", ["csv", "sql"])
async def test_tenant_admin_reads_the_grid_but_cannot_change_it(client_as, backend):
    async with _backend(backend), client_as("tenant_admin") as client:
        assert (await client.get(POLICIES)).status_code == 200
        assert (await client.post(POLICIES, json=RULE)).status_code == 403
        assert (await client.request("DELETE", POLICIES, json=RULE)).status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["unit_admin", "manager", "collaborator", "auditor"])
async def test_other_roles_cannot_read_the_grid(client_as, role):
    async with _backend("csv"), client_as(role) as client:
        assert (await client.get(POLICIES)).status_code == 403


@pytest.mark.asyncio
async def test_every_rights_change_is_audited_once(
    admin_client: AsyncClient, db_session, db_seed
):
    async with _backend("sql"):
        assert (await admin_client.post(POLICIES, json=RULE)).status_code == 201
        # Replays change nothing, so they add no audit row.
        assert (await admin_client.post(POLICIES, json=RULE)).status_code == 200
        assert (await admin_client.request("DELETE", POLICIES, json=RULE)).json()[
            "deleted"
        ] is True
        assert (await admin_client.request("DELETE", POLICIES, json=RULE)).json()[
            "deleted"
        ] is False

    added, removed = await _rights_audit(db_session, db_seed["user_id"])
    assert (added.action, removed.action) == RIGHTS_ACTIONS
    assert added.table_name == removed.table_name == "casbin_rule"
    assert added.tenant_id == db_seed["tenant_id"]
    assert added.new_data["v0"] == "collaborator" and added.old_data is None
    assert removed.old_data["v2"] == "create" and removed.new_data is None
    # Same rule, same record: the journal links the addition and the removal.
    assert added.record_id == removed.record_id

    journal = await admin_client.get(
        "/api/v1/audit/logs", params={"table_name": "casbin_rule"}
    )
    assert journal.status_code == 200, journal.text
    labels = {entry["action_label"] for entry in journal.json()}
    assert {"Ajout d'un droit d'accès", "Retrait d'un droit d'accès"} <= labels
