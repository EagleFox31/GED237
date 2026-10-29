# backend/tests/api/test_authz.py
"""
Phase P5.6 — Tests RBAC + cross-tenant isolation.

Trois familles :
1. Tests RBAC Casbin purs (without Django/FastAPI stack)
2. Tests HTTP : rôles bloqués / autorisés sur des endpoints stratégiques
3. Tests cross-tenant : un user du tenant A ne peut pas accéder aux ressources du tenant B
"""

import asyncio
import io
import uuid
import tempfile
import os
import logging
import multiprocessing as mp
import subprocess
import sys
import time
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.authz.casbin_enforcer import (
    get_enforcer,
    reload_enforcer,
    bootstrap_sql_policies_from_csv,
    enforce_permission,
)
from app.core.authz import casbin_enforcer as casbin_enforcer_module
from app.core.authz import metrics as authz_metrics_module
from app.core.authz.service import authorize_or_403, can_perform
from app.core.authz.metrics import get_authz_metrics_snapshot, reset_authz_metrics
from app.core.authz.context import AuthzContext
from app.core.observability.request_id import set_request_id, reset_request_id
from app.core.config import settings
from app.main import app
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.casbin_rule import CasbinRule
from app.models.user import User


# ─── helpers ──────────────────────────────────────────────────────────────────


def _fake_user(role_code: str, tenant_id=None, user_id=None, org_unit_id=None) -> User:
    role = MagicMock()
    role.code = role_code
    user = User(
        id=user_id or uuid.uuid4(),
        tenant_id=tenant_id or uuid.uuid4(),
        org_unit_id=org_unit_id or uuid.uuid4(),
        is_active=True,
        matricule="TEST",
        password_hash="x",
        first_name="T",
        last_name="U",
    )
    user.role = role
    return user


def _make_client(
    test_engine, role_code: str, tenant_id=None, user_id=None, org_unit_id=None
):
    """Fixture factory for a client with any role."""
    fake_user = _fake_user(role_code, tenant_id, user_id, org_unit_id)
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
    return fake_user, ASGITransport(app=app)


def _worker_enforce_sql(sqlite_url: str, queue: mp.Queue) -> None:
    """
    Separate-process worker to simulate independent app worker caches.
    """
    os.environ["AUTHZ_BACKEND"] = "sql"
    os.environ["AUTHZ_POLICY_DATABASE_URL"] = sqlite_url
    os.environ.setdefault("DATABASE_URL", sqlite_url)
    try:
        from app.core.config import settings as runtime_settings
        from app.core.authz import casbin_enforcer as worker_authz

        # In spawn mode, module-level settings may already be instantiated in child process.
        # Force runtime settings to the worker-specific SQL policy DB.
        runtime_settings.AUTHZ_BACKEND = "sql"
        runtime_settings.AUTHZ_POLICY_DATABASE_URL = sqlite_url

        async def _run():
            await worker_authz.reload_enforcer()
            return await worker_authz.enforce_permission(
                "standard", "categories", "create"
            )

        allowed = asyncio.run(_run())
        queue.put({"ok": True, "allowed": bool(allowed)})
    except Exception as exc:
        queue.put({"ok": False, "error": str(exc)})


# ─── 1. Tests Casbin purs ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_casbin_tenant_admin_can_manage_categories():
    enforcer = await get_enforcer()
    assert enforcer.enforce("tenant_admin", "categories", "create") is True
    assert enforcer.enforce("tenant_admin", "categories", "manage") is True


@pytest.mark.asyncio
async def test_casbin_standard_cannot_manage_categories():
    enforcer = await get_enforcer()
    assert enforcer.enforce("standard", "categories", "create") is False
    assert enforcer.enforce("standard", "categories", "delete") is False


@pytest.mark.asyncio
async def test_casbin_standard_can_read_own_documents():
    enforcer = await get_enforcer()
    assert enforcer.enforce("standard", "documents", "read_own") is True
    assert enforcer.enforce("standard", "documents", "read") is False


@pytest.mark.asyncio
async def test_casbin_manager_can_read_documents_and_assign():
    enforcer = await get_enforcer()
    assert enforcer.enforce("manager", "documents", "read") is True
    assert enforcer.enforce("manager", "workflows", "assign") is True


@pytest.mark.asyncio
async def test_casbin_super_admin_passes_all_via_manage():
    enforcer = await get_enforcer()
    for resource in [
        "documents",
        "categories",
        "gedrules.templates",
        "tenants",
        "users",
    ]:
        assert (
            enforcer.enforce("super_admin", resource, "read") is True
        ), f"super_admin read {resource}"
        assert (
            enforcer.enforce("super_admin", resource, "manage") is True
        ), f"super_admin manage {resource}"


@pytest.mark.asyncio
async def test_casbin_auditor_read_only():
    enforcer = await get_enforcer()
    assert enforcer.enforce("auditor", "documents", "read") is True
    assert enforcer.enforce("auditor", "documents", "create") is False
    assert enforcer.enforce("auditor", "documents", "delete") is False


# ─── 2. Tests façade : ownership et cross-tenant ──────────────────────────────


@pytest.mark.asyncio
async def test_facade_ownership_check_passes_for_owner():
    uid = uuid.uuid4()
    tid = uuid.uuid4()
    user = _fake_user("standard", tenant_id=tid, user_id=uid)
    ctx = AuthzContext(tenant_id=tid, owner_id=uid)
    # Doit passer sans exception
    await authorize_or_403(user, "documents", "read_own", ctx)


@pytest.mark.asyncio
async def test_facade_ownership_check_fails_for_non_owner():
    uid = uuid.uuid4()
    tid = uuid.uuid4()
    user = _fake_user("standard", tenant_id=tid, user_id=uid)
    ctx = AuthzContext(tenant_id=tid, owner_id=uuid.uuid4())  # autre propriétaire
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await authorize_or_403(user, "documents", "read_own", ctx)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_facade_cross_tenant_blocked_for_tenant_admin():
    tid_a = uuid.uuid4()
    tid_b = uuid.uuid4()
    admin = _fake_user("tenant_admin", tenant_id=tid_a)
    ctx = AuthzContext(tenant_id=tid_b)  # ressource du tenant B
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await authorize_or_403(admin, "documents", "read", ctx)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_facade_super_admin_exempt_from_cross_tenant():
    tid_a = uuid.uuid4()
    tid_b = uuid.uuid4()
    super_admin = _fake_user("super_admin", tenant_id=tid_a)
    ctx = AuthzContext(tenant_id=tid_b)
    # Super admin est exempté du check tenant — ne doit pas lever d'exception
    await authorize_or_403(super_admin, "documents", "read", ctx)


@pytest.mark.asyncio
async def test_facade_rbac_denied_raises_403():
    user = _fake_user("standard")
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await authorize_or_403(user, "categories", "create")
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_authz_deny_log_contains_request_id(caplog):
    user = _fake_user("standard")
    token = set_request_id("req-deny-1")
    try:
        from fastapi import HTTPException

        with caplog.at_level(logging.INFO):
            with pytest.raises(HTTPException):
                await authorize_or_403(user, "categories", "create")
    finally:
        reset_request_id(token)
    assert any(
        "[AUTHZ_DENY]" in rec.message and "request_id=req-deny-1" in rec.message
        for rec in caplog.records
    )


@pytest.mark.asyncio
async def test_authz_allow_sensitive_is_logged_with_request_id(caplog):
    user = _fake_user("super_admin")
    token = set_request_id("req-allow-1")
    try:
        with caplog.at_level(logging.INFO):
            await authorize_or_403(user, "documents", "manage")
    finally:
        reset_request_id(token)
    assert any(
        "[AUTHZ_ALLOW]" in rec.message and "request_id=req-allow-1" in rec.message
        for rec in caplog.records
    )


@pytest.mark.asyncio
async def test_authz_allow_non_sensitive_not_logged(caplog):
    user = _fake_user("manager")
    token = set_request_id("req-allow-2")
    try:
        with caplog.at_level(logging.INFO):
            await authorize_or_403(user, "documents", "read")
    finally:
        reset_request_id(token)
    assert not any("[AUTHZ_ALLOW]" in rec.message for rec in caplog.records)


@pytest.mark.asyncio
async def test_authz_metrics_aggregate_allow_and_deny():
    reset_authz_metrics()
    allow_user = _fake_user("manager")
    deny_user = _fake_user("standard")

    await authorize_or_403(allow_user, "documents", "read")
    from fastapi import HTTPException

    with pytest.raises(HTTPException):
        await authorize_or_403(deny_user, "categories", "create")

    snapshot = get_authz_metrics_snapshot()
    assert any(
        item["decision"] == "allow"
        and item["role"] == "manager"
        and item["resource"] == "documents"
        and item["action"] == "read"
        and item["count"] >= 1
        for item in snapshot
    )
    assert any(
        item["decision"] == "deny"
        and item["role"] == "standard"
        and item["resource"] == "categories"
        and item["action"] == "create"
        and item["count"] >= 1
        for item in snapshot
    )


@pytest.mark.asyncio
async def test_can_perform_is_silent_no_logs_no_metrics(caplog):
    reset_authz_metrics()
    user = _fake_user("standard")

    with caplog.at_level(logging.INFO):
        allowed = await can_perform(user, "categories", "create")

    assert allowed is False
    assert not any(
        "[AUTHZ_DENY]" in rec.message or "[AUTHZ_ALLOW]" in rec.message
        for rec in caplog.records
    )
    assert get_authz_metrics_snapshot() == []


@pytest.mark.asyncio
async def test_request_id_middleware_echoes_header():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health", headers={"X-Request-ID": "req-health-1"})
    assert resp.status_code == 200
    assert resp.headers.get("X-Request-ID") == "req-health-1"


@pytest.mark.asyncio
async def test_sql_backend_policy_decision_and_reload():
    """
    Integration: SQL backend policy is enforced, and decision changes after reload.
    """
    fd, path = tempfile.mkstemp(prefix="authz_sql_", suffix=".db")
    os.close(fd)
    sqlite_url = f"sqlite:///{path}"
    old_backend = settings.AUTHZ_BACKEND
    old_policy_url = settings.AUTHZ_POLICY_DATABASE_URL

    engine = create_engine(sqlite_url, future=True)
    try:
        CasbinRule.__table__.create(bind=engine)
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO casbin_rule (ptype, v0, v1, v2) VALUES (:ptype, :v0, :v1, :v2)"
                ),
                {"ptype": "p", "v0": "standard", "v1": "categories", "v2": "create"},
            )

        settings.AUTHZ_BACKEND = "sql"
        settings.AUTHZ_POLICY_DATABASE_URL = sqlite_url
        await reload_enforcer()

        user = _fake_user("standard")

        # Allowed by SQL policy
        await authorize_or_403(user, "categories", "create")

        # Remove policy then reload -> now denied without restart
        with engine.begin() as conn:
            conn.execute(
                text(
                    "DELETE FROM casbin_rule "
                    "WHERE ptype='p' AND v0='standard' AND v1='categories' AND v2='create'"
                )
            )

        await reload_enforcer()
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await authorize_or_403(user, "categories", "create")
        assert exc_info.value.status_code == 403

    finally:
        settings.AUTHZ_BACKEND = old_backend
        settings.AUTHZ_POLICY_DATABASE_URL = old_policy_url
        try:
            await reload_enforcer()
        except Exception:
            # Teardown must not hide assertion result from the test body.
            pass
        finally:
            engine.dispose()
            try:
                os.remove(path)
            except FileNotFoundError:
                pass


@pytest.mark.asyncio
async def test_sql_bootstrap_from_csv_imports_policies():
    """
    Bootstrap CSV -> SQL imports rules and they are enforceable in SQL mode.
    """
    fd, path = tempfile.mkstemp(prefix="authz_sql_bootstrap_", suffix=".db")
    os.close(fd)
    sqlite_url = f"sqlite:///{path}"
    old_backend = settings.AUTHZ_BACKEND
    old_policy_url = settings.AUTHZ_POLICY_DATABASE_URL

    engine = create_engine(sqlite_url, future=True)
    try:
        CasbinRule.__table__.create(bind=engine)

        settings.AUTHZ_BACKEND = "sql"
        settings.AUTHZ_POLICY_DATABASE_URL = sqlite_url

        imported = await bootstrap_sql_policies_from_csv(force=True)
        assert imported > 0

        await reload_enforcer()
        user = _fake_user("standard")
        await authorize_or_403(user, "documents", "read_own")
    finally:
        settings.AUTHZ_BACKEND = old_backend
        settings.AUTHZ_POLICY_DATABASE_URL = old_policy_url
        try:
            await reload_enforcer()
        except Exception:
            pass
        finally:
            engine.dispose()
            try:
                os.remove(path)
            except FileNotFoundError:
                pass


@pytest.mark.asyncio
async def test_sql_policy_version_triggers_lazy_reload_without_manual_reload():
    fd, path = tempfile.mkstemp(prefix="authz_sql_lazy_", suffix=".db")
    os.close(fd)
    sqlite_url = f"sqlite:///{path}"
    old_backend = settings.AUTHZ_BACKEND
    old_policy_url = settings.AUTHZ_POLICY_DATABASE_URL

    engine = create_engine(sqlite_url, future=True)
    try:
        CasbinRule.__table__.create(bind=engine)
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS authz_policy_version ("
                    "id INTEGER PRIMARY KEY, "
                    "version BIGINT NOT NULL)"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO authz_policy_version (id, version) "
                    "SELECT 1, 1 "
                    "WHERE NOT EXISTS (SELECT 1 FROM authz_policy_version WHERE id = 1)"
                )
            )

        settings.AUTHZ_BACKEND = "sql"
        settings.AUTHZ_POLICY_DATABASE_URL = sqlite_url
        await reload_enforcer()
        user = _fake_user("standard")

        from fastapi import HTTPException

        with pytest.raises(HTTPException):
            await authorize_or_403(user, "categories", "create")

        # External mutation + version bump, without calling reload_enforcer().
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO casbin_rule (ptype, v0, v1, v2) VALUES (:ptype, :v0, :v1, :v2)"
                ),
                {"ptype": "p", "v0": "standard", "v1": "categories", "v2": "create"},
            )
            conn.execute(
                text(
                    "UPDATE authz_policy_version SET version = version + 1 WHERE id = 1"
                )
            )

        # Lazy invalidation should reload and allow without explicit reload call.
        await authorize_or_403(user, "categories", "create")

        # External delete + version bump, still without manual reload.
        with engine.begin() as conn:
            conn.execute(
                text(
                    "DELETE FROM casbin_rule "
                    "WHERE ptype='p' AND v0='standard' AND v1='categories' AND v2='create'"
                )
            )
            conn.execute(
                text(
                    "UPDATE authz_policy_version SET version = version + 1 WHERE id = 1"
                )
            )

        with pytest.raises(HTTPException):
            await authorize_or_403(user, "categories", "create")
    finally:
        settings.AUTHZ_BACKEND = old_backend
        settings.AUTHZ_POLICY_DATABASE_URL = old_policy_url
        try:
            await reload_enforcer()
        except Exception:
            pass
        finally:
            engine.dispose()
            try:
                os.remove(path)
            except (FileNotFoundError, PermissionError):
                pass


@pytest.mark.asyncio
async def test_sql_mutation_visible_across_two_simulated_workers():
    """
    Simulates two process workers sharing the same SQL policy store.
    A mutation done between worker runs must be observed by the next worker.
    """
    fd, path = tempfile.mkstemp(prefix="authz_sql_workers_", suffix=".db")
    os.close(fd)
    sqlite_url = f"sqlite:///{path}"

    engine = create_engine(sqlite_url, future=True)
    ctx = mp.get_context("spawn")
    try:
        CasbinRule.__table__.create(bind=engine)
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS authz_policy_version ("
                    "id INTEGER PRIMARY KEY, "
                    "version BIGINT NOT NULL)"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO authz_policy_version (id, version) "
                    "SELECT 1, 1 "
                    "WHERE NOT EXISTS (SELECT 1 FROM authz_policy_version WHERE id = 1)"
                )
            )

        q1 = ctx.Queue()
        p1 = ctx.Process(target=_worker_enforce_sql, args=(sqlite_url, q1))
        p1.start()
        p1.join(timeout=30)
        assert p1.exitcode == 0
        r1 = q1.get(timeout=2)
        assert r1["ok"] is True
        assert r1["allowed"] is False

        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO casbin_rule (ptype, v0, v1, v2) VALUES (:ptype, :v0, :v1, :v2)"
                ),
                {"ptype": "p", "v0": "standard", "v1": "categories", "v2": "create"},
            )
            conn.execute(
                text(
                    "UPDATE authz_policy_version SET version = version + 1 WHERE id = 1"
                )
            )

        q2 = ctx.Queue()
        p2 = ctx.Process(target=_worker_enforce_sql, args=(sqlite_url, q2))
        p2.start()
        p2.join(timeout=30)
        assert p2.exitcode == 0
        r2 = q2.get(timeout=2)
        assert r2["ok"] is True
        assert r2["allowed"] is True
    finally:
        engine.dispose()
        try:
            os.remove(path)
        except (FileNotFoundError, PermissionError):
            pass


@pytest.mark.asyncio
async def test_sql_bootstrap_force_replaces_old_policies():
    """
    Bootstrap force=True must replace stale SQL policies, not keep old leftovers.
    """
    fd, path = tempfile.mkstemp(prefix="authz_sql_force_", suffix=".db")
    os.close(fd)
    sqlite_url = f"sqlite:///{path}"
    old_backend = settings.AUTHZ_BACKEND
    old_policy_url = settings.AUTHZ_POLICY_DATABASE_URL

    engine = create_engine(sqlite_url, future=True)
    try:
        CasbinRule.__table__.create(bind=engine)
        with engine.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO casbin_rule (ptype, v0, v1, v2) VALUES (:ptype, :v0, :v1, :v2)"
                ),
                {
                    "ptype": "p",
                    "v0": "standard",
                    "v1": "__old_resource__",
                    "v2": "legacy_action",
                },
            )

        settings.AUTHZ_BACKEND = "sql"
        settings.AUTHZ_POLICY_DATABASE_URL = sqlite_url
        await reload_enforcer()

        imported = await bootstrap_sql_policies_from_csv(force=True)
        assert imported > 0

        with engine.begin() as conn:
            stale_count = conn.execute(
                text(
                    "SELECT COUNT(*) FROM casbin_rule "
                    "WHERE ptype='p' AND v0='standard' AND v1='__old_resource__' AND v2='legacy_action'"
                )
            ).scalar_one()
        assert stale_count == 0
    finally:
        settings.AUTHZ_BACKEND = old_backend
        settings.AUTHZ_POLICY_DATABASE_URL = old_policy_url
        try:
            await reload_enforcer()
        except Exception:
            pass
        finally:
            engine.dispose()
            try:
                os.remove(path)
            except (FileNotFoundError, PermissionError):
                pass


@pytest.mark.asyncio
async def test_shadow_mode_returns_csv_decision_and_logs_diff(caplog, monkeypatch):
    """
    Shadow contract: active decision comes from CSV, divergence with SQL is logged.
    """
    old_backend = settings.AUTHZ_BACKEND
    old_policy_url = settings.AUTHZ_POLICY_DATABASE_URL
    settings.AUTHZ_BACKEND = "shadow"
    settings.AUTHZ_POLICY_DATABASE_URL = ""

    class _DummyEnforcer:
        def __init__(self, allow: bool):
            self.allow = allow

        def enforce(self, *_args, **_kwargs):
            return self.allow

    async def _fake_get_csv():
        return _DummyEnforcer(False)

    async def _fake_get_sql():
        return _DummyEnforcer(True)

    monkeypatch.setattr(casbin_enforcer_module, "_get_csv_enforcer", _fake_get_csv)
    monkeypatch.setattr(casbin_enforcer_module, "_get_sql_enforcer", _fake_get_sql)

    with caplog.at_level(logging.WARNING):
        allowed = await enforce_permission("standard", "categories", "create")

    settings.AUTHZ_BACKEND = old_backend
    settings.AUTHZ_POLICY_DATABASE_URL = old_policy_url

    assert allowed is False
    assert any("[AUTHZ_SHADOW_DIFF]" in rec.message for rec in caplog.records)


@pytest.mark.asyncio
async def test_shadow_mode_sql_error_falls_back_to_csv(caplog, monkeypatch):
    """
    Shadow contract: SQL failure must not block; CSV decision is returned.
    """
    old_backend = settings.AUTHZ_BACKEND
    old_policy_url = settings.AUTHZ_POLICY_DATABASE_URL
    settings.AUTHZ_BACKEND = "shadow"
    settings.AUTHZ_POLICY_DATABASE_URL = ""

    class _DummyEnforcer:
        def __init__(self, allow: bool):
            self.allow = allow

        def enforce(self, *_args, **_kwargs):
            return self.allow

    async def _fake_get_csv():
        return _DummyEnforcer(True)

    async def _fake_get_sql():
        raise RuntimeError("sql backend down")

    monkeypatch.setattr(casbin_enforcer_module, "_get_csv_enforcer", _fake_get_csv)
    monkeypatch.setattr(casbin_enforcer_module, "_get_sql_enforcer", _fake_get_sql)

    with caplog.at_level(logging.ERROR):
        allowed = await enforce_permission("standard", "documents", "read")

    settings.AUTHZ_BACKEND = old_backend
    settings.AUTHZ_POLICY_DATABASE_URL = old_policy_url

    assert allowed is True
    assert any("[AUTHZ_SHADOW_ERROR]" in rec.message for rec in caplog.records)


@pytest.mark.asyncio
async def test_authz_policy_api_super_admin_idempotent_cycle(admin_client: AsyncClient):
    fd, path = tempfile.mkstemp(prefix="authz_api_", suffix=".db")
    os.close(fd)
    sqlite_url = f"sqlite:///{path}"
    old_backend = settings.AUTHZ_BACKEND
    old_policy_url = settings.AUTHZ_POLICY_DATABASE_URL

    engine = create_engine(sqlite_url, future=True)
    try:
        CasbinRule.__table__.create(bind=engine)
        settings.AUTHZ_BACKEND = "sql"
        settings.AUTHZ_POLICY_DATABASE_URL = sqlite_url
        await reload_enforcer()

        payload = {
            "ptype": "p",
            "v0": "standard",
            "v1": "categories",
            "v2": "create",
        }

        create1 = await admin_client.post("/api/v1/authz/policies", json=payload)
        assert create1.status_code == 201
        assert create1.json()["created"] is True

        create2 = await admin_client.post("/api/v1/authz/policies", json=payload)
        assert create2.status_code == 200
        assert create2.json()["created"] is False

        list_resp = await admin_client.get("/api/v1/authz/policies")
        assert list_resp.status_code == 200
        assert any(
            p["ptype"] == "p"
            and p["v0"] == "standard"
            and p["v1"] == "categories"
            and p["v2"] == "create"
            for p in list_resp.json()
        )

        delete1 = await admin_client.request(
            "DELETE", "/api/v1/authz/policies", json=payload
        )
        assert delete1.status_code == 200
        assert delete1.json()["deleted"] is True

        delete2 = await admin_client.request(
            "DELETE", "/api/v1/authz/policies", json=payload
        )
        assert delete2.status_code == 200
        assert delete2.json()["deleted"] is False
    finally:
        settings.AUTHZ_BACKEND = old_backend
        settings.AUTHZ_POLICY_DATABASE_URL = old_policy_url
        try:
            await reload_enforcer()
        except Exception:
            pass
        finally:
            engine.dispose()
            try:
                os.remove(path)
            except (FileNotFoundError, PermissionError):
                pass


@pytest.mark.asyncio
async def test_authz_policy_api_non_super_admin_forbidden(auth_client: AsyncClient):
    payload = {
        "ptype": "p",
        "v0": "standard",
        "v1": "categories",
        "v2": "create",
    }
    resp = await auth_client.post("/api/v1/authz/policies", json=payload)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_authz_policy_api_mutation_persists_after_reload(
    admin_client: AsyncClient,
):
    fd, path = tempfile.mkstemp(prefix="authz_api_persist_", suffix=".db")
    os.close(fd)
    sqlite_url = f"sqlite:///{path}"
    old_backend = settings.AUTHZ_BACKEND
    old_policy_url = settings.AUTHZ_POLICY_DATABASE_URL

    engine = create_engine(sqlite_url, future=True)
    try:
        CasbinRule.__table__.create(bind=engine)
        settings.AUTHZ_BACKEND = "sql"
        settings.AUTHZ_POLICY_DATABASE_URL = sqlite_url
        await reload_enforcer()

        payload = {
            "ptype": "p",
            "v0": "standard",
            "v1": "categories",
            "v2": "create",
        }

        create_resp = await admin_client.post("/api/v1/authz/policies", json=payload)
        assert create_resp.status_code == 201
        assert create_resp.json()["created"] is True

        await reload_enforcer()

        list_after_create = await admin_client.get("/api/v1/authz/policies")
        assert list_after_create.status_code == 200
        assert any(
            p["ptype"] == "p"
            and p["v0"] == "standard"
            and p["v1"] == "categories"
            and p["v2"] == "create"
            for p in list_after_create.json()
        )

        delete_resp = await admin_client.request(
            "DELETE", "/api/v1/authz/policies", json=payload
        )
        assert delete_resp.status_code == 200
        assert delete_resp.json()["deleted"] is True

        await reload_enforcer()

        list_after_delete = await admin_client.get("/api/v1/authz/policies")
        assert list_after_delete.status_code == 200
        assert not any(
            p["ptype"] == "p"
            and p["v0"] == "standard"
            and p["v1"] == "categories"
            and p["v2"] == "create"
            for p in list_after_delete.json()
        )
    finally:
        settings.AUTHZ_BACKEND = old_backend
        settings.AUTHZ_POLICY_DATABASE_URL = old_policy_url
        try:
            await reload_enforcer()
        except Exception:
            pass
        finally:
            engine.dispose()
            try:
                os.remove(path)
            except (FileNotFoundError, PermissionError):
                pass


@pytest.mark.asyncio
async def test_authz_policy_api_rejects_invalid_resource_or_action(
    admin_client: AsyncClient,
):
    fd, path = tempfile.mkstemp(prefix="authz_api_invalid_", suffix=".db")
    os.close(fd)
    sqlite_url = f"sqlite:///{path}"
    old_backend = settings.AUTHZ_BACKEND
    old_policy_url = settings.AUTHZ_POLICY_DATABASE_URL

    engine = create_engine(sqlite_url, future=True)
    try:
        CasbinRule.__table__.create(bind=engine)
        settings.AUTHZ_BACKEND = "sql"
        settings.AUTHZ_POLICY_DATABASE_URL = sqlite_url
        await reload_enforcer()

        invalid_resource = {
            "ptype": "p",
            "v0": "standard",
            "v1": "resource.inconnue",
            "v2": "create",
        }
        r1 = await admin_client.post("/api/v1/authz/policies", json=invalid_resource)
        assert r1.status_code == 422

        invalid_action = {
            "ptype": "p",
            "v0": "standard",
            "v1": "categories",
            "v2": "approve_everything",
        }
        r2 = await admin_client.post("/api/v1/authz/policies", json=invalid_action)
        assert r2.status_code == 422
    finally:
        settings.AUTHZ_BACKEND = old_backend
        settings.AUTHZ_POLICY_DATABASE_URL = old_policy_url
        try:
            await reload_enforcer()
        except Exception:
            pass
        finally:
            engine.dispose()
            try:
                os.remove(path)
            except (FileNotFoundError, PermissionError):
                pass


@pytest.mark.asyncio
async def test_authz_policy_api_unavailable_in_csv_mode(admin_client: AsyncClient):
    old_backend = settings.AUTHZ_BACKEND
    old_policy_url = settings.AUTHZ_POLICY_DATABASE_URL
    try:
        settings.AUTHZ_BACKEND = "csv"
        settings.AUTHZ_POLICY_DATABASE_URL = ""
        await reload_enforcer()

        resp = await admin_client.get("/api/v1/authz/policies")
        assert resp.status_code == 409
    finally:
        settings.AUTHZ_BACKEND = old_backend
        settings.AUTHZ_POLICY_DATABASE_URL = old_policy_url
        try:
            await reload_enforcer()
        except Exception:
            pass


@pytest.mark.asyncio
async def test_authz_policy_api_rejects_internal_holes(admin_client: AsyncClient):
    fd, path = tempfile.mkstemp(prefix="authz_api_holes_", suffix=".db")
    os.close(fd)
    sqlite_url = f"sqlite:///{path}"
    old_backend = settings.AUTHZ_BACKEND
    old_policy_url = settings.AUTHZ_POLICY_DATABASE_URL

    engine = create_engine(sqlite_url, future=True)
    try:
        CasbinRule.__table__.create(bind=engine)
        settings.AUTHZ_BACKEND = "sql"
        settings.AUTHZ_POLICY_DATABASE_URL = sqlite_url
        await reload_enforcer()

        payload = {
            "ptype": "p",
            "v0": "standard",
            "v1": "categories",
            "v2": "create",
            "v3": None,
            "v4": "oops",
        }
        resp = await admin_client.post("/api/v1/authz/policies", json=payload)
        assert resp.status_code == 422
    finally:
        settings.AUTHZ_BACKEND = old_backend
        settings.AUTHZ_POLICY_DATABASE_URL = old_policy_url
        try:
            await reload_enforcer()
        except Exception:
            pass
        finally:
            engine.dispose()
            try:
                os.remove(path)
            except (FileNotFoundError, PermissionError):
                pass


@pytest.mark.asyncio
async def test_authz_policy_api_blocks_bulk_payload_over_5(admin_client: AsyncClient):
    fd, path = tempfile.mkstemp(prefix="authz_api_bulk_block_", suffix=".db")
    os.close(fd)
    sqlite_url = f"sqlite:///{path}"
    old_backend = settings.AUTHZ_BACKEND
    old_policy_url = settings.AUTHZ_POLICY_DATABASE_URL

    engine = create_engine(sqlite_url, future=True)
    limiter = getattr(app.state, "limiter", None)
    old_limiter_enabled = getattr(limiter, "_enabled", None)
    try:
        limiter = getattr(app.state, "limiter", None)
        core_limiter = getattr(limiter, "limiter", None)
        storage = getattr(core_limiter, "storage", None)
        reset_storage = getattr(storage, "reset", None) or getattr(
            storage, "clear", None
        )
        if callable(reset_storage):
            reset_storage()
        if hasattr(limiter, "_enabled"):
            limiter._enabled = False

        CasbinRule.__table__.create(bind=engine)
        settings.AUTHZ_BACKEND = "sql"
        settings.AUTHZ_POLICY_DATABASE_URL = sqlite_url
        await reload_enforcer()

        payload = [
            {"ptype": "p", "v0": "standard", "v1": "categories", "v2": "create"}
            for _ in range(6)
        ]
        # Use an isolated client IP to avoid cross-test interference with slowapi counters.
        isolated_transport = ASGITransport(app=app, client=("10.10.10.10", 51000))
        async with AsyncClient(
            transport=isolated_transport, base_url="http://test"
        ) as isolated_client:
            post_resp = await isolated_client.post(
                "/api/v1/authz/policies", json=payload
            )
            assert post_resp.status_code == 400

            delete_resp = await isolated_client.request(
                "DELETE", "/api/v1/authz/policies", json=payload
            )
            assert delete_resp.status_code == 400
    finally:
        if hasattr(limiter, "_enabled") and old_limiter_enabled is not None:
            limiter._enabled = old_limiter_enabled
        settings.AUTHZ_BACKEND = old_backend
        settings.AUTHZ_POLICY_DATABASE_URL = old_policy_url
        try:
            await reload_enforcer()
        except Exception:
            pass
        finally:
            engine.dispose()
            try:
                os.remove(path)
            except (FileNotFoundError, PermissionError):
                pass


@pytest.mark.asyncio
async def test_authz_policy_rate_limit_is_user_scoped_same_ip(test_engine, db_seed):
    """
    Policy mutation rate limit must be scoped by authenticated user (fallback IP only when user unavailable).
    Two different super_admin users on the same IP should not share the same limit bucket.
    """
    from fastapi import Request

    fd, path = tempfile.mkstemp(prefix="authz_api_rate_user_", suffix=".db")
    os.close(fd)
    sqlite_url = f"sqlite:///{path}"
    old_backend = settings.AUTHZ_BACKEND
    old_policy_url = settings.AUTHZ_POLICY_DATABASE_URL

    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    engine = create_engine(sqlite_url, future=True)
    limiter = getattr(app.state, "limiter", None)
    core_limiter = getattr(limiter, "limiter", None)
    storage = getattr(core_limiter, "storage", None)
    reset_storage = getattr(storage, "reset", None) or getattr(storage, "clear", None)
    try:
        if callable(reset_storage):
            reset_storage()

        CasbinRule.__table__.create(bind=engine)
        settings.AUTHZ_BACKEND = "sql"
        settings.AUTHZ_POLICY_DATABASE_URL = sqlite_url
        await reload_enforcer()

        async def override_get_db():
            async with session_factory() as session:
                yield session

        async def _run_for_user(user_id: uuid.UUID, n_calls: int) -> list[int]:
            fake_user = _fake_user(
                "super_admin",
                tenant_id=db_seed["tenant_id"],
                user_id=user_id,
                org_unit_id=db_seed["org_unit_id"],
            )

            async def override_get_current_user(request: Request):
                request.state.auth_user_id = str(user_id)
                return fake_user

            app.dependency_overrides[get_db] = override_get_db
            app.dependency_overrides[get_current_user] = override_get_current_user
            transport = ASGITransport(app=app, client=("10.10.10.10", 55000))
            statuses: list[int] = []
            payload = {
                "ptype": "p",
                "v0": "standard",
                "v1": "categories",
                "v2": "create",
            }
            async with AsyncClient(
                transport=transport, base_url="http://test"
            ) as client:
                for _ in range(n_calls):
                    resp = await client.post("/api/v1/authz/policies", json=payload)
                    statuses.append(resp.status_code)
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(get_db, None)
            return statuses

        statuses_a = await _run_for_user(uuid.uuid4(), 11)
        assert all(code in (200, 201) for code in statuses_a[:10])
        assert statuses_a[10] == 429

        statuses_b = await _run_for_user(uuid.uuid4(), 1)
        assert statuses_b[0] in (200, 201)
    finally:
        settings.AUTHZ_BACKEND = old_backend
        settings.AUTHZ_POLICY_DATABASE_URL = old_policy_url
        if callable(reset_storage):
            reset_storage()
        try:
            await reload_enforcer()
        except Exception:
            pass
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(get_db, None)
            engine.dispose()
            try:
                os.remove(path)
            except (FileNotFoundError, PermissionError):
                pass


@pytest.mark.asyncio
async def test_authz_metrics_api_super_admin_can_read(admin_client: AsyncClient):
    reset_authz_metrics()
    allow_user = _fake_user("manager")
    deny_user = _fake_user("standard")

    await authorize_or_403(allow_user, "documents", "read")
    from fastapi import HTTPException

    with pytest.raises(HTTPException):
        await authorize_or_403(deny_user, "categories", "create")

    resp = await admin_client.get("/api/v1/authz/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert any(
        item["decision"] == "allow"
        and item["role"] == "manager"
        and item["resource"] == "documents"
        and item["action"] == "read"
        and item["count"] >= 1
        for item in data
    )
    assert any(
        item["decision"] == "deny"
        and item["role"] == "standard"
        and item["resource"] == "categories"
        and item["action"] == "create"
        and item["count"] >= 1
        for item in data
    )


@pytest.mark.asyncio
async def test_authz_metrics_api_non_super_admin_forbidden(auth_client: AsyncClient):
    resp = await auth_client.get("/api/v1/authz/metrics")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_authz_metrics_api_filters_and_top_n(admin_client: AsyncClient):
    reset_authz_metrics()
    allow_user = _fake_user("manager")
    deny_user_a = _fake_user("standard", tenant_id=uuid.uuid4())
    deny_user_b = _fake_user("standard", tenant_id=uuid.uuid4())

    await authorize_or_403(allow_user, "documents", "read")
    from fastapi import HTTPException

    for _ in range(2):
        with pytest.raises(HTTPException):
            await authorize_or_403(deny_user_a, "categories", "create")
    with pytest.raises(HTTPException):
        await authorize_or_403(deny_user_b, "users", "delete")

    deny_only = await admin_client.get(
        "/api/v1/authz/metrics", params={"decision": "deny"}
    )
    assert deny_only.status_code == 200
    assert all(item["decision"] == "deny" for item in deny_only.json())

    deny_top_1 = await admin_client.get(
        "/api/v1/authz/metrics", params={"decision": "deny", "top_n": 1}
    )
    assert deny_top_1.status_code == 200
    data = deny_top_1.json()
    assert len(data) == 1
    assert data[0]["resource"] == "categories"
    assert data[0]["count"] >= 2


@pytest.mark.asyncio
async def test_authz_metrics_top_denies_endpoint(admin_client: AsyncClient):
    reset_authz_metrics()
    deny_user = _fake_user("standard")
    from fastapi import HTTPException

    for _ in range(3):
        with pytest.raises(HTTPException):
            await authorize_or_403(deny_user, "categories", "create")

    resp = await admin_client.get(
        "/api/v1/authz/metrics/top-denies", params={"top_n": 1}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["decision"] == "deny"
    assert data[0]["resource"] == "categories"
    assert data[0]["count"] >= 3


@pytest.mark.asyncio
async def test_authz_metrics_top_denies_non_super_admin_forbidden(
    auth_client: AsyncClient,
):
    resp = await auth_client.get("/api/v1/authz/metrics/top-denies")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_authz_metrics_top_n_validation_bounds(admin_client: AsyncClient):
    too_low = await admin_client.get("/api/v1/authz/metrics", params={"top_n": 0})
    assert too_low.status_code == 422

    too_high = await admin_client.get("/api/v1/authz/metrics", params={"top_n": 1001})
    assert too_high.status_code == 422

    ok_low = await admin_client.get("/api/v1/authz/metrics", params={"top_n": 1})
    assert ok_low.status_code == 200

    ok_high = await admin_client.get("/api/v1/authz/metrics", params={"top_n": 1000})
    assert ok_high.status_code == 200


@pytest.mark.asyncio
async def test_authz_metrics_redis_backend_snapshot_and_reset(monkeypatch):
    old_backend = settings.AUTHZ_METRICS_BACKEND
    old_prefix = settings.AUTHZ_METRICS_REDIS_PREFIX

    class _FakeRedis:
        def __init__(self):
            self.hashes = {}

        def hincrby(self, key, field, amount):
            bucket = self.hashes.setdefault(key, {})
            bucket[field] = int(bucket.get(field, 0)) + int(amount)
            return bucket[field]

        def hgetall(self, key):
            return dict(self.hashes.get(key, {}))

        def delete(self, key):
            self.hashes.pop(key, None)
            return 1

    fake_redis = _FakeRedis()

    try:
        settings.AUTHZ_METRICS_BACKEND = "redis"
        settings.AUTHZ_METRICS_REDIS_PREFIX = "test:authz"
        monkeypatch.setattr(authz_metrics_module, "_redis_client", fake_redis)

        authz_metrics_module.record_authz_decision(
            allowed=False,
            role="standard",
            resource="categories",
            action="create",
            tenant_id="tenant-a",
            reason="rbac_denied",
        )
        authz_metrics_module.record_authz_decision(
            allowed=False,
            role="standard",
            resource="categories",
            action="create",
            tenant_id="tenant-a",
            reason="rbac_denied",
        )

        rows = authz_metrics_module.get_authz_metrics_snapshot()
        assert len(rows) == 1
        assert rows[0]["decision"] == "deny"
        assert rows[0]["count"] == 2
        assert authz_metrics_module.get_authz_metrics_dropped_count() == 0

        authz_metrics_module.reset_authz_metrics()
        assert authz_metrics_module.get_authz_metrics_snapshot() == []
        assert authz_metrics_module.get_authz_metrics_dropped_count() == 0
    finally:
        settings.AUTHZ_METRICS_BACKEND = old_backend
        settings.AUTHZ_METRICS_REDIS_PREFIX = old_prefix
        monkeypatch.setattr(authz_metrics_module, "_redis_client", None)


@pytest.mark.asyncio
async def test_authz_metrics_redis_client_uses_dedicated_url_then_falls_back(
    monkeypatch,
):
    old_backend = settings.AUTHZ_METRICS_BACKEND
    old_prefix = settings.AUTHZ_METRICS_REDIS_PREFIX
    old_redis_url = settings.REDIS_URL
    old_metrics_redis_url = settings.AUTHZ_METRICS_REDIS_URL

    class _FakeRedisClient:
        def __init__(self):
            self.hashes = {}

        def hincrby(self, key, field, amount):
            bucket = self.hashes.setdefault(key, {})
            bucket[field] = int(bucket.get(field, 0)) + int(amount)
            return bucket[field]

        def hgetall(self, key):
            return dict(self.hashes.get(key, {}))

        def delete(self, key):
            self.hashes.pop(key, None)
            return 1

    captured_urls = []

    class _FakeRedisFactory:
        @staticmethod
        def from_url(url, decode_responses):
            captured_urls.append((url, decode_responses))
            return _FakeRedisClient()

    import sys
    from types import SimpleNamespace

    try:
        settings.AUTHZ_METRICS_BACKEND = "redis"
        settings.AUTHZ_METRICS_REDIS_PREFIX = "test:authz"
        settings.REDIS_URL = "redis://default-redis:6379/0"
        settings.AUTHZ_METRICS_REDIS_URL = "redis://metrics-redis:6379/9"
        monkeypatch.setattr(authz_metrics_module, "_redis_client", None)
        monkeypatch.setitem(
            sys.modules, "redis", SimpleNamespace(Redis=_FakeRedisFactory)
        )

        authz_metrics_module.record_authz_decision(
            allowed=True,
            role="manager",
            resource="documents",
            action="read",
            tenant_id="tenant-a",
            reason="authorized",
        )
        assert captured_urls[-1] == ("redis://metrics-redis:6379/9", True)

        # Force new client creation and verify fallback when dedicated URL is empty.
        monkeypatch.setattr(authz_metrics_module, "_redis_client", None)
        settings.AUTHZ_METRICS_REDIS_URL = ""
        authz_metrics_module.record_authz_decision(
            allowed=False,
            role="standard",
            resource="categories",
            action="create",
            tenant_id="tenant-a",
            reason="rbac_denied",
        )
        assert captured_urls[-1] == ("redis://default-redis:6379/0", True)
    finally:
        settings.AUTHZ_METRICS_BACKEND = old_backend
        settings.AUTHZ_METRICS_REDIS_PREFIX = old_prefix
        settings.REDIS_URL = old_redis_url
        settings.AUTHZ_METRICS_REDIS_URL = old_metrics_redis_url
        monkeypatch.setattr(authz_metrics_module, "_redis_client", None)


@pytest.mark.asyncio
async def test_authz_metrics_redis_unavailable_drops_instead_of_memory_fallback(
    monkeypatch,
):
    old_backend = settings.AUTHZ_METRICS_BACKEND
    old_prefix = settings.AUTHZ_METRICS_REDIS_PREFIX

    class _BrokenRedis:
        def hincrby(self, *_args, **_kwargs):
            raise RuntimeError("redis down")

        def hgetall(self, *_args, **_kwargs):
            raise RuntimeError("redis down")

        def delete(self, *_args, **_kwargs):
            raise RuntimeError("redis down")

    try:
        settings.AUTHZ_METRICS_BACKEND = "redis"
        settings.AUTHZ_METRICS_REDIS_PREFIX = "test:authz"
        monkeypatch.setattr(authz_metrics_module, "_redis_client", _BrokenRedis())
        monkeypatch.setattr(authz_metrics_module, "_redis_error_logged", False)

        authz_metrics_module.record_authz_decision(
            allowed=False,
            role="standard",
            resource="categories",
            action="create",
            tenant_id="tenant-a",
            reason="rbac_denied",
        )
        authz_metrics_module.record_authz_decision(
            allowed=True,
            role="manager",
            resource="documents",
            action="read",
            tenant_id="tenant-a",
            reason="authorized",
        )

        # No fallback to memory: when redis is down, snapshot stays empty.
        assert authz_metrics_module.get_authz_metrics_snapshot() == []
        assert authz_metrics_module.get_authz_metrics_dropped_count() == 2

        # Reset must clear dropped counter even if redis is still unavailable.
        authz_metrics_module.reset_authz_metrics()
        assert authz_metrics_module.get_authz_metrics_dropped_count() == 0
    finally:
        settings.AUTHZ_METRICS_BACKEND = old_backend
        settings.AUTHZ_METRICS_REDIS_PREFIX = old_prefix
        monkeypatch.setattr(authz_metrics_module, "_redis_client", None)


@pytest.mark.asyncio
async def test_authz_metrics_redis_recovers_then_relogs_on_new_outage(
    monkeypatch, caplog
):
    old_backend = settings.AUTHZ_METRICS_BACKEND
    old_prefix = settings.AUTHZ_METRICS_REDIS_PREFIX

    class _FlakyRedis:
        def __init__(self):
            self.fail = True
            self.hashes = {}

        def hincrby(self, key, field, amount):
            if self.fail:
                raise RuntimeError("redis down")
            bucket = self.hashes.setdefault(key, {})
            bucket[field] = int(bucket.get(field, 0)) + int(amount)
            return bucket[field]

        def hgetall(self, key):
            if self.fail:
                raise RuntimeError("redis down")
            return dict(self.hashes.get(key, {}))

        def delete(self, key):
            if self.fail:
                raise RuntimeError("redis down")
            self.hashes.pop(key, None)
            return 1

    flaky = _FlakyRedis()

    try:
        settings.AUTHZ_METRICS_BACKEND = "redis"
        settings.AUTHZ_METRICS_REDIS_PREFIX = "test:authz"
        monkeypatch.setattr(authz_metrics_module, "_redis_client", flaky)
        monkeypatch.setattr(authz_metrics_module, "_redis_error_logged", False)
        authz_metrics_module.reset_authz_metrics()

        with caplog.at_level(logging.WARNING):
            authz_metrics_module.record_authz_decision(
                allowed=False,
                role="standard",
                resource="categories",
                action="create",
                tenant_id="tenant-a",
                reason="rbac_denied",
            )

            # Recovery path should reset internal one-shot flag.
            flaky.fail = False
            authz_metrics_module.record_authz_decision(
                allowed=True,
                role="manager",
                resource="documents",
                action="read",
                tenant_id="tenant-a",
                reason="authorized",
            )

            # New outage must be logged again (not silently swallowed forever).
            flaky.fail = True
            authz_metrics_module.record_authz_decision(
                allowed=False,
                role="standard",
                resource="users",
                action="delete",
                tenant_id="tenant-a",
                reason="rbac_denied",
            )

        errors = [
            r for r in caplog.records if "[AUTHZ_METRICS_REDIS_ERROR]" in r.message
        ]
        assert len(errors) >= 2
    finally:
        settings.AUTHZ_METRICS_BACKEND = old_backend
        settings.AUTHZ_METRICS_REDIS_PREFIX = old_prefix
        monkeypatch.setattr(authz_metrics_module, "_redis_client", None)


@pytest.mark.asyncio
async def test_authz_metrics_redis_recovery_keeps_single_source_of_truth(monkeypatch):
    old_backend = settings.AUTHZ_METRICS_BACKEND
    old_prefix = settings.AUTHZ_METRICS_REDIS_PREFIX

    class _FlakyRedis:
        def __init__(self):
            self.fail = True
            self.hashes = {}

        def hincrby(self, key, field, amount):
            if self.fail:
                raise RuntimeError("redis down")
            bucket = self.hashes.setdefault(key, {})
            bucket[field] = int(bucket.get(field, 0)) + int(amount)
            return bucket[field]

        def hgetall(self, key):
            if self.fail:
                raise RuntimeError("redis down")
            return dict(self.hashes.get(key, {}))

        def delete(self, key):
            if self.fail:
                raise RuntimeError("redis down")
            self.hashes.pop(key, None)
            return 1

    flaky = _FlakyRedis()

    try:
        settings.AUTHZ_METRICS_BACKEND = "redis"
        settings.AUTHZ_METRICS_REDIS_PREFIX = "test:authz"
        monkeypatch.setattr(authz_metrics_module, "_redis_client", flaky)
        monkeypatch.setattr(authz_metrics_module, "_redis_error_logged", False)
        authz_metrics_module.reset_authz_metrics()

        # Outage: writes are dropped (never stored in memory fallback).
        authz_metrics_module.record_authz_decision(
            allowed=False,
            role="standard",
            resource="categories",
            action="create",
            tenant_id="tenant-a",
            reason="rbac_denied",
        )
        assert authz_metrics_module.get_authz_metrics_dropped_count() == 1

        # Recovery: new writes persist in Redis and are visible.
        flaky.fail = False
        authz_metrics_module.record_authz_decision(
            allowed=True,
            role="manager",
            resource="documents",
            action="read",
            tenant_id="tenant-a",
            reason="authorized",
        )

        rows = authz_metrics_module.get_authz_metrics_snapshot()
        assert len(rows) == 1
        assert rows[0]["decision"] == "allow"
        assert rows[0]["resource"] == "documents"
        assert rows[0]["count"] == 1

        # No ghost from outage write must appear after recovery.
        assert not any(
            item["decision"] == "deny" and item["resource"] == "categories"
            for item in rows
        )
    finally:
        settings.AUTHZ_METRICS_BACKEND = old_backend
        settings.AUTHZ_METRICS_REDIS_PREFIX = old_prefix
        monkeypatch.setattr(authz_metrics_module, "_redis_client", None)


@pytest.mark.asyncio
async def test_authz_metrics_reset_endpoint(admin_client: AsyncClient):
    reset_authz_metrics()
    deny_user = _fake_user("standard")
    from fastapi import HTTPException

    with pytest.raises(HTTPException):
        await authorize_or_403(deny_user, "categories", "create")

    before = await admin_client.get("/api/v1/authz/metrics")
    assert before.status_code == 200
    assert len(before.json()) > 0

    reset_resp = await admin_client.post("/api/v1/authz/metrics/reset")
    assert reset_resp.status_code == 200
    assert reset_resp.json()["reset"] is True

    after = await admin_client.get("/api/v1/authz/metrics")
    assert after.status_code == 200
    assert after.json() == []


@pytest.mark.asyncio
async def test_authz_metrics_reset_non_super_admin_forbidden(auth_client: AsyncClient):
    resp = await auth_client.post("/api/v1/authz/metrics/reset")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_authz_metrics_health_api_super_admin_can_read(admin_client: AsyncClient):
    reset_authz_metrics()
    resp = await admin_client.get("/api/v1/authz/metrics/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["backend"] in ("memory", "redis")
    assert isinstance(body["dropped_count"], int)
    assert isinstance(body["degraded"], bool)


@pytest.mark.asyncio
async def test_authz_metrics_health_api_non_super_admin_forbidden(
    auth_client: AsyncClient,
):
    resp = await auth_client.get("/api/v1/authz/metrics/health")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_authz_metrics_health_reports_dropped_and_degraded_in_redis_outage(
    admin_client: AsyncClient, monkeypatch
):
    old_backend = settings.AUTHZ_METRICS_BACKEND
    old_prefix = settings.AUTHZ_METRICS_REDIS_PREFIX

    class _BrokenRedis:
        def hincrby(self, *_args, **_kwargs):
            raise RuntimeError("redis down")

        def hgetall(self, *_args, **_kwargs):
            raise RuntimeError("redis down")

        def delete(self, *_args, **_kwargs):
            raise RuntimeError("redis down")

    try:
        settings.AUTHZ_METRICS_BACKEND = "redis"
        settings.AUTHZ_METRICS_REDIS_PREFIX = "test:authz"
        monkeypatch.setattr(authz_metrics_module, "_redis_client", _BrokenRedis())
        monkeypatch.setattr(authz_metrics_module, "_redis_error_logged", False)
        reset_authz_metrics()

        deny_user = _fake_user("standard")
        from fastapi import HTTPException

        with pytest.raises(HTTPException):
            await authorize_or_403(deny_user, "categories", "create")

        health = await admin_client.get("/api/v1/authz/metrics/health")
        assert health.status_code == 200
        payload = health.json()
        assert payload["backend"] == "redis"
        assert payload["degraded"] is True
        assert payload["dropped_count"] >= 1
    finally:
        settings.AUTHZ_METRICS_BACKEND = old_backend
        settings.AUTHZ_METRICS_REDIS_PREFIX = old_prefix
        monkeypatch.setattr(authz_metrics_module, "_redis_client", None)
        reset_authz_metrics()


@pytest.mark.asyncio
async def test_backup_restore_scripts_restore_sql_policies_under_one_minute():
    """
    Runs real backup/restore scripts against temp sqlite policy DB and enforces timing SLA (<1 min).
    """
    fd, db_path = tempfile.mkstemp(prefix="authz_backup_restore_", suffix=".db")
    os.close(fd)
    sqlite_url = f"sqlite:///{db_path}"
    backend_root = Path(__file__).resolve().parents[2]

    engine = create_engine(sqlite_url, future=True)
    try:
        CasbinRule.__table__.create(bind=engine)
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS authz_policy_version ("
                    "id INTEGER PRIMARY KEY, "
                    "version BIGINT NOT NULL)"
                )
            )
            conn.execute(text("DELETE FROM authz_policy_version"))
            conn.execute(
                text("INSERT INTO authz_policy_version (id, version) VALUES (1, 1)")
            )
            conn.execute(text("DELETE FROM casbin_rule"))
            conn.execute(
                text(
                    "INSERT INTO casbin_rule (ptype, v0, v1, v2) VALUES ('p', 'standard', 'categories', 'create')"
                )
            )

        env = os.environ.copy()
        env["AUTHZ_BACKEND"] = "sql"
        env["AUTHZ_POLICY_DATABASE_URL"] = sqlite_url
        env["DATABASE_URL"] = sqlite_url
        env["PYTHONPATH"] = str(backend_root)

        with tempfile.TemporaryDirectory(prefix="authz_bk_dir_") as tmp_out:
            backup_cmd = [
                sys.executable,
                str(backend_root / "scripts" / "backup_policies.py"),
                "--output-dir",
                tmp_out,
            ]
            backup = subprocess.run(
                backup_cmd,
                cwd=str(backend_root),
                env=env,
                capture_output=True,
                text=True,
                check=True,
            )
            backup_dir = Path(backup.stdout.strip().splitlines()[-1].strip())
            assert backup_dir.exists()

            # Drift after backup.
            with engine.begin() as conn:
                conn.execute(text("DELETE FROM casbin_rule"))
                conn.execute(
                    text(
                        "INSERT INTO casbin_rule (ptype, v0, v1, v2) VALUES ('p', 'standard', 'users', 'delete')"
                    )
                )
                conn.execute(
                    text(
                        "UPDATE authz_policy_version SET version = version + 1 WHERE id = 1"
                    )
                )

            restore_cmd = [
                sys.executable,
                str(backend_root / "scripts" / "restore_policies.py"),
                "--backup-dir",
                str(backup_dir),
            ]
            start = time.perf_counter()
            restored = subprocess.run(
                restore_cmd,
                cwd=str(backend_root),
                env=env,
                capture_output=True,
                text=True,
                check=True,
            )
            elapsed = time.perf_counter() - start
            assert "restore_ok" in restored.stdout
            assert elapsed < 60.0

            with engine.begin() as conn:
                restored_rows = conn.execute(
                    text("SELECT ptype, v0, v1, v2 FROM casbin_rule ORDER BY v1, v2")
                ).all()
            assert ("p", "standard", "categories", "create") in restored_rows
            assert ("p", "standard", "users", "delete") not in restored_rows
    finally:
        engine.dispose()
        try:
            os.remove(db_path)
        except (FileNotFoundError, PermissionError):
            pass


# ─── 3. Tests HTTP cross-tenant sur endpoints ─────────────────────────────────


@pytest.mark.asyncio
async def test_standard_cannot_create_category(test_engine, db_seed):
    """Un user standard ne peut pas créer de catégorie (tenant_admin minimum)."""
    _, transport = _make_client(
        test_engine,
        "standard",
        tenant_id=db_seed["tenant_id"],
        user_id=db_seed["user_id"],
    )
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/categories/",
            json={"code": "TEST_RBAC", "name": "Test RBAC"},
        )
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_tenant_admin_can_create_category(test_engine, db_seed):
    """Un tenant_admin peut créer une catégorie."""
    _, transport = _make_client(
        test_engine,
        "tenant_admin",
        tenant_id=db_seed["tenant_id"],
        user_id=db_seed["user_id"],
    )
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/categories/",
            json={"code": "ADMIN_CAT_TEST", "name": "Admin Category"},
        )
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_standard_cannot_read_gedrules(test_engine, db_seed):
    """Un user standard ne peut pas lire les templates GEDRules."""
    _, transport = _make_client(
        test_engine,
        "standard",
        tenant_id=db_seed["tenant_id"],
        user_id=db_seed["user_id"],
    )
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/gedrules/templates")
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_standard_cannot_access_platform_analytics(test_engine, db_seed):
    """Un user standard ne peut pas accéder aux analytics plateforme."""
    _, transport = _make_client(test_engine, "standard", tenant_id=db_seed["tenant_id"])
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/analytics/platform")
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_standard_cannot_list_users(test_engine, db_seed):
    _, transport = _make_client(
        test_engine,
        "standard",
        tenant_id=db_seed["tenant_id"],
        user_id=db_seed["user_id"],
        org_unit_id=db_seed["org_unit_id"],
    )
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/users/")
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_unit_admin_can_list_users(test_engine, db_seed):
    _, transport = _make_client(
        test_engine,
        "unit_admin",
        tenant_id=db_seed["tenant_id"],
        user_id=db_seed["user_id"],
        org_unit_id=db_seed["org_unit_id"],
    )
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/users/")
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_standard_cannot_list_org_units(test_engine, db_seed):
    _, transport = _make_client(
        test_engine,
        "standard",
        tenant_id=db_seed["tenant_id"],
        user_id=db_seed["user_id"],
        org_unit_id=db_seed["org_unit_id"],
    )
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/org-units/")
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_unit_admin_can_list_org_units(test_engine, db_seed):
    _, transport = _make_client(
        test_engine,
        "unit_admin",
        tenant_id=db_seed["tenant_id"],
        user_id=db_seed["user_id"],
        org_unit_id=db_seed["org_unit_id"],
    )
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/org-units/")
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_cross_tenant_document_access_blocked(test_engine, db_seed):
    """
    Un user du tenant B ne peut pas accéder à un document du tenant A.
    Test : standard user d'un AUTRE tenant tente de lire la liste des docs du tenant A.
    Le résultat est 200 mais la liste est vide (filtrage SQL tenant_id).
    """
    other_tenant_id = uuid.uuid4()  # tenant complètement différent
    _, transport = _make_client(
        test_engine,
        "tenant_admin",
        tenant_id=other_tenant_id,
        user_id=uuid.uuid4(),
    )
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/documents/")
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 200
    # Le tenant B ne voit aucun document du tenant A (isolation SQL)
    assert resp.json() == []


@pytest.mark.asyncio
async def test_standard_can_read_own_document_after_upload(test_engine, db_seed):
    """read_own : le propriétaire peut lire son document, un étranger ne peut pas."""
    uid = db_seed["user_id"]
    tid = db_seed["tenant_id"]
    oid = db_seed["org_unit_id"]

    # 1. Upload en tant que propriétaire
    _, transport_owner = _make_client(
        test_engine, "standard", tenant_id=tid, user_id=uid, org_unit_id=oid
    )
    async with AsyncClient(transport=transport_owner, base_url="http://test") as client:
        up = await client.post(
            "/api/v1/documents/upload",
            files={
                "file": ("rbac_test.txt", io.BytesIO(b"rbac content"), "text/plain")
            },
            data={"title": "RBAC Test Doc"},
        )
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert up.status_code == 201
    doc_id = up.json()["id"]

    # 2. Le propriétaire peut lire son document
    _, transport_same = _make_client(
        test_engine, "standard", tenant_id=tid, user_id=uid, org_unit_id=oid
    )
    async with AsyncClient(transport=transport_same, base_url="http://test") as client:
        r = await client.get(f"/api/v1/documents/{doc_id}")
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert r.status_code == 200

    # 3. Un autre user standard du même tenant ne peut pas lire ce document
    _, transport_other = _make_client(
        test_engine, "standard", tenant_id=tid, user_id=uuid.uuid4(), org_unit_id=oid
    )
    async with AsyncClient(transport=transport_other, base_url="http://test") as client:
        r2 = await client.get(f"/api/v1/documents/{doc_id}")
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert r2.status_code == 403


@pytest.mark.asyncio
async def test_reader_cannot_upload_document(test_engine, db_seed):
    """A reader role must not be allowed to create/upload documents."""
    tid = db_seed["tenant_id"]
    oid = db_seed["org_unit_id"]

    _, transport_reader = _make_client(
        test_engine,
        "reader",
        tenant_id=tid,
        user_id=uuid.uuid4(),
        org_unit_id=oid,
    )
    async with AsyncClient(
        transport=transport_reader, base_url="http://test"
    ) as client:
        resp = await client.post(
            "/api/v1/documents/upload",
            files={
                "file": ("reader_blocked.txt", io.BytesIO(b"blocked"), "text/plain")
            },
            data={"title": "Reader Blocked Upload"},
        )
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_standard_cannot_read_other_user_workflow_steps(test_engine, db_seed):
    """A standard user cannot read workflow steps of another user's document in same tenant."""
    owner_id = db_seed["user_id"]
    tenant_id = db_seed["tenant_id"]
    org_unit_id = db_seed["org_unit_id"]

    # 1. Owner uploads document and creates workflow steps.
    _, transport_owner = _make_client(
        test_engine,
        "standard",
        tenant_id=tenant_id,
        user_id=owner_id,
        org_unit_id=org_unit_id,
    )
    async with AsyncClient(transport=transport_owner, base_url="http://test") as client:
        up = await client.post(
            "/api/v1/documents/upload",
            files={"file": ("wf_authz.txt", io.BytesIO(b"wf authz"), "text/plain")},
            data={"title": "WF Authz Doc"},
        )
        assert up.status_code == 201
        doc_id = up.json()["id"]

        create_steps = await client.post(
            f"/api/v1/workflows/document/{doc_id}/steps",
            json=[
                {
                    "document_id": doc_id,
                    "step_order": 1,
                    "label": "Owner Step",
                    "assigned_to": str(owner_id),
                    "expected_action_type": "visa",
                }
            ],
        )
        assert create_steps.status_code == 201
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)

    # 2. Another standard user from same tenant must be denied.
    _, transport_other = _make_client(
        test_engine,
        "standard",
        tenant_id=tenant_id,
        user_id=uuid.uuid4(),
        org_unit_id=org_unit_id,
    )
    async with AsyncClient(transport=transport_other, base_url="http://test") as client:
        resp = await client.get(f"/api/v1/workflows/document/{doc_id}/steps")
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_manager_cannot_read_workflow_steps_outside_org_unit(
    test_engine, db_seed
):
    """A manager can read workflows only inside their own org-unit perimeter."""
    owner_id = db_seed["user_id"]
    tenant_id = db_seed["tenant_id"]
    manager_org_unit_id = db_seed["org_unit_id"]

    # Create another org unit in same tenant for the target document.
    from app.models.org_unit import OrgUnit

    other_org_unit_id = uuid.uuid4()
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        session.add(
            OrgUnit(
                id=other_org_unit_id,
                tenant_id=tenant_id,
                code=f"OU-{str(other_org_unit_id)[:8]}",
                name="Other Unit",
                level=1,
                is_active=True,
            )
        )
        await session.commit()

    # Owner uploads and creates workflow in other org unit.
    _, transport_owner = _make_client(
        test_engine,
        "standard",
        tenant_id=tenant_id,
        user_id=owner_id,
        org_unit_id=other_org_unit_id,
    )
    async with AsyncClient(transport=transport_owner, base_url="http://test") as client:
        up = await client.post(
            "/api/v1/documents/upload",
            files={"file": ("wf_mgr_scope.txt", io.BytesIO(b"wf mgr"), "text/plain")},
            data={"title": "WF Manager Scope"},
        )
        assert up.status_code == 201
        doc_id = up.json()["id"]

        create_steps = await client.post(
            f"/api/v1/workflows/document/{doc_id}/steps",
            json=[
                {
                    "document_id": doc_id,
                    "step_order": 1,
                    "label": "Scoped Step",
                    "assigned_to": str(owner_id),
                    "expected_action_type": "visa",
                }
            ],
        )
        assert create_steps.status_code == 201
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)

    # Manager from another org unit in same tenant must be denied.
    _, transport_manager = _make_client(
        test_engine,
        "manager",
        tenant_id=tenant_id,
        user_id=uuid.uuid4(),
        org_unit_id=manager_org_unit_id,
    )
    async with AsyncClient(
        transport=transport_manager, base_url="http://test"
    ) as client:
        resp = await client.get(f"/api/v1/workflows/document/{doc_id}/steps")
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_manager_cannot_read_workflow_actions_outside_org_unit(
    test_engine, db_seed
):
    """A manager cannot read workflow action history outside their org-unit."""
    owner_id = db_seed["user_id"]
    tenant_id = db_seed["tenant_id"]
    manager_org_unit_id = db_seed["org_unit_id"]

    # Create another org unit in same tenant for the target document.
    from app.models.org_unit import OrgUnit

    other_org_unit_id = uuid.uuid4()
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        session.add(
            OrgUnit(
                id=other_org_unit_id,
                tenant_id=tenant_id,
                code=f"OUA-{str(other_org_unit_id)[:8]}",
                name="Other Unit Actions",
                level=1,
                is_active=True,
            )
        )
        await session.commit()

    # Owner uploads, creates workflow, performs one action.
    _, transport_owner = _make_client(
        test_engine,
        "standard",
        tenant_id=tenant_id,
        user_id=owner_id,
        org_unit_id=other_org_unit_id,
    )
    async with AsyncClient(transport=transport_owner, base_url="http://test") as client:
        up = await client.post(
            "/api/v1/documents/upload",
            files={
                "file": ("wf_mgr_actions.txt", io.BytesIO(b"wf actions"), "text/plain")
            },
            data={"title": "WF Manager Actions Scope"},
        )
        assert up.status_code == 201
        doc = up.json()
        doc_id = doc["id"]
        version_id = doc["current_version_id"]

        create_steps = await client.post(
            f"/api/v1/workflows/document/{doc_id}/steps",
            json=[
                {
                    "document_id": doc_id,
                    "step_order": 1,
                    "label": "Action Step",
                    "assigned_to": str(owner_id),
                    "expected_action_type": "visa",
                }
            ],
        )
        assert create_steps.status_code == 201
        step_id = create_steps.json()[0]["id"]

        action_resp = await client.post(
            f"/api/v1/workflows/step/{step_id}/actions",
            json={
                "action_type": "visa",
                "outcome": "accepted",
                "document_version_id": version_id,
            },
        )
        assert action_resp.status_code == 200
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)

    # Manager from another org unit in same tenant must be denied.
    _, transport_manager = _make_client(
        test_engine,
        "manager",
        tenant_id=tenant_id,
        user_id=uuid.uuid4(),
        org_unit_id=manager_org_unit_id,
    )
    async with AsyncClient(
        transport=transport_manager, base_url="http://test"
    ) as client:
        resp = await client.get(f"/api/v1/workflows/document/{doc_id}/actions")
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_rbac_vs_business_rule_separation(test_engine, db_seed):
    """
    read_own RBAC accordé mais document en statut 'validated' → update_own refusé métier.
    Prouve que les responsabilités sont séparées.
    """
    uid = db_seed["user_id"]
    tid = db_seed["tenant_id"]
    oid = db_seed["org_unit_id"]

    # 1. Upload (crée en draft)
    _, transport = _make_client(
        test_engine, "standard", tenant_id=tid, user_id=uid, org_unit_id=oid
    )
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        up = await client.post(
            "/api/v1/documents/upload",
            files={"file": ("rbac_meta.txt", io.BytesIO(b"meta"), "text/plain")},
            data={"title": "RBAC Meta Test"},
        )
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert up.status_code == 201
    doc_id = up.json()["id"]

    # 2. PATCH en draft : doit passer (RBAC ok + statut ok)
    _, transport2 = _make_client(
        test_engine, "standard", tenant_id=tid, user_id=uid, org_unit_id=oid
    )
    async with AsyncClient(transport=transport2, base_url="http://test") as client:
        patch1 = await client.patch(
            f"/api/v1/documents/{doc_id}",
            json={"title": "RBAC Meta Updated"},
        )
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    assert patch1.status_code == 200

    # 3. Forcer le statut à 'validated' via admin (contournement pour le test)
    from sqlalchemy import update as sql_update
    from app.models.document import Document

    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        await session.execute(
            sql_update(Document)
            .where(Document.id == uuid.UUID(doc_id))
            .values(status="validated")
        )
        await session.commit()

    # 4. PATCH en validated : RBAC ok (standard a update_own) MAIS statut invalide → 403 métier
    _, transport3 = _make_client(
        test_engine, "standard", tenant_id=tid, user_id=uid, org_unit_id=oid
    )
    async with AsyncClient(transport=transport3, base_url="http://test") as client:
        patch2 = await client.patch(
            f"/api/v1/documents/{doc_id}",
            json={"title": "Should Be Blocked"},
        )
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    # La règle métier bloque (statut non éditable), pas Casbin
    assert patch2.status_code == 403
