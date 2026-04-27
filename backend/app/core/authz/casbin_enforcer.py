# backend/app/core/authz/casbin_enforcer.py
import os
import asyncio
import logging
import inspect
from typing import Optional
import csv

from casbin import Enforcer
from sqlalchemy import create_engine, text

from app.core.config import settings

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()
_csv_enforcer: Optional[Enforcer] = None
_sql_enforcer: Optional[Enforcer] = None
_policy_version_local: int = -1

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.conf")
_POLICY_PATH = os.path.join(os.path.dirname(__file__), "policy.csv")

_ALLOWED_ACTIONS = frozenset(
    {
        "read",
        "read_own",
        "create",
        "update",
        "update_own",
        "delete",
        "delete_own",
        "trash_own",
        "manage",
        "assign",
        "resolve_review",
        "simulate",
    }
)


def _normalize_backend(value: str) -> str:
    backend = (value or "csv").strip().lower()
    if backend not in {"csv", "sql", "shadow"}:
        raise RuntimeError(
            f"Unsupported AUTHZ_BACKEND='{value}'. Expected one of: csv, sql, shadow."
        )
    return backend


def _to_sync_sqlalchemy_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if url.startswith("sqlite+aiosqlite://"):
        return url.replace("sqlite+aiosqlite://", "sqlite://", 1)
    return url


def _get_sql_policy_url() -> str:
    source = settings.AUTHZ_EFFECTIVE_POLICY_DATABASE_URL
    return _to_sync_sqlalchemy_url(source)


async def _build_csv_enforcer() -> Enforcer:
    e = Enforcer(_MODEL_PATH, _POLICY_PATH)
    e.load_policy()
    logger.info("[Casbin] CSV enforcer ready — %d policies.", len(e.get_policy()))
    return e


async def _build_sql_enforcer() -> Enforcer:
    try:
        from casbin_sqlalchemy_adapter import Adapter
    except Exception as exc:
        raise RuntimeError(
            "casbin_sqlalchemy_adapter is required for AUTHZ_BACKEND=sql|shadow. "
            "Install backend requirements first."
        ) from exc

    policy_url = _get_sql_policy_url()
    adapter = Adapter(policy_url)
    e = Enforcer(_MODEL_PATH, adapter)
    e.load_policy()
    logger.info(
        "[Casbin] SQL enforcer ready (%s) — %d policies.",
        policy_url,
        len(e.get_policy()),
    )
    return e


def _get_sql_engine(enforcer: Optional[Enforcer] = None):
    if enforcer is not None:
        adapter = getattr(enforcer, "adapter", None)
        engine = getattr(adapter, "_engine", None)
        if engine is not None:
            return engine, False
    # Fallback engine used only when enforcer not yet initialized.
    return create_engine(_get_sql_policy_url(), future=True), True


def _ensure_policy_version_table(conn) -> None:
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


def _read_policy_version(enforcer: Optional[Enforcer] = None) -> int:
    engine, must_dispose = _get_sql_engine(enforcer)
    try:
        with engine.begin() as conn:
            _ensure_policy_version_table(conn)
            version = conn.execute(
                text("SELECT version FROM authz_policy_version WHERE id = 1")
            ).scalar_one()
        return int(version)
    finally:
        if must_dispose:
            engine.dispose()


def _bump_policy_version(enforcer: Optional[Enforcer] = None) -> int:
    engine, must_dispose = _get_sql_engine(enforcer)
    try:
        with engine.begin() as conn:
            _ensure_policy_version_table(conn)
            conn.execute(
                text(
                    "UPDATE authz_policy_version SET version = version + 1 WHERE id = 1"
                )
            )
            version = conn.execute(
                text("SELECT version FROM authz_policy_version WHERE id = 1")
            ).scalar_one()
        return int(version)
    finally:
        if must_dispose:
            engine.dispose()


async def _ensure_sql_enforcer_fresh() -> None:
    """
    Lazy invalidation by persisted policy version.
    Reload enforcer only when db version changed.
    """
    global _policy_version_local
    sql_e = await _get_sql_enforcer()
    db_version = _read_policy_version(sql_e)
    if db_version != _policy_version_local:
        logger.info(
            "[Casbin] Detected policy version change local=%s db=%s. Reloading enforcer.",
            _policy_version_local,
            db_version,
        )
        await reload_enforcer()


async def _get_csv_enforcer() -> Enforcer:
    global _csv_enforcer
    if _csv_enforcer is None:
        async with _lock:
            if _csv_enforcer is None:
                _csv_enforcer = await _build_csv_enforcer()
    return _csv_enforcer


async def _get_sql_enforcer() -> Enforcer:
    global _sql_enforcer, _policy_version_local
    if _sql_enforcer is None:
        async with _lock:
            if _sql_enforcer is None:
                _sql_enforcer = await _build_sql_enforcer()
                _policy_version_local = _read_policy_version(_sql_enforcer)
    return _sql_enforcer


async def get_enforcer() -> Enforcer:
    """
    Retourne l'enforcer ACTIF selon AUTHZ_BACKEND.
    - csv    -> enforcer CSV
    - sql    -> enforcer SQL
    - shadow -> enforcer CSV (décision active), SQL évalué via enforce_permission()
    """
    backend = _normalize_backend(settings.AUTHZ_BACKEND)
    if backend == "csv":
        return await _get_csv_enforcer()
    if backend == "sql":
        return await _get_sql_enforcer()
    # shadow
    return await _get_csv_enforcer()


async def enforce_permission(role: str, resource: str, action: str) -> bool:
    """
    Évalue une permission selon AUTHZ_BACKEND.
    En mode shadow: retourne la décision CSV et loggue toute divergence avec SQL.
    """
    backend = _normalize_backend(settings.AUTHZ_BACKEND)

    if backend == "csv":
        e = await _get_csv_enforcer()
        return e.enforce(role, resource, action)

    if backend == "sql":
        await _ensure_sql_enforcer_fresh()
        e = await _get_sql_enforcer()
        return e.enforce(role, resource, action)

    # shadow mode
    csv_e = await _get_csv_enforcer()
    csv_allowed = csv_e.enforce(role, resource, action)
    try:
        await _ensure_sql_enforcer_fresh()
    except Exception as exc:
        logger.error(
            "[AUTHZ_SHADOW_ERROR] role=%s resource=%s action=%s error=%s",
            role,
            resource,
            action,
            exc,
            exc_info=True,
        )
        return csv_allowed

    try:
        sql_e = await _get_sql_enforcer()
        sql_allowed = sql_e.enforce(role, resource, action)
    except Exception as exc:
        logger.error(
            "[AUTHZ_SHADOW_ERROR] role=%s resource=%s action=%s error=%s",
            role,
            resource,
            action,
            exc,
            exc_info=True,
        )
        return csv_allowed

    if csv_allowed != sql_allowed:
        logger.warning(
            "[AUTHZ_SHADOW_DIFF] role=%s resource=%s action=%s csv=%s sql=%s",
            role,
            resource,
            action,
            csv_allowed,
            sql_allowed,
        )
    return csv_allowed


async def reload_enforcer() -> None:
    """Force le rechargement des enforcers selon les backends utilisés."""
    global _csv_enforcer, _sql_enforcer, _policy_version_local
    old_sql_enforcer: Optional[Enforcer] = None
    async with _lock:
        old_sql_enforcer = _sql_enforcer
        _csv_enforcer = None
        _sql_enforcer = None
        _policy_version_local = -1

    # Release previous SQL adapter resources (important for Windows sqlite temp files).
    if old_sql_enforcer is not None:
        adapter = getattr(old_sql_enforcer, "adapter", None)
        engine = getattr(adapter, "_engine", None)
        if engine is not None:
            try:
                engine.dispose()
            except Exception:
                logger.warning(
                    "[Casbin] Failed to dispose previous SQL adapter engine.",
                    exc_info=True,
                )

    backend = _normalize_backend(settings.AUTHZ_BACKEND)
    if backend == "csv":
        await _get_csv_enforcer()
        return
    if backend == "sql":
        await _get_sql_enforcer()
        return
    # shadow: warm-up CSV and SQL to fail fast on split-brain config issues
    await _get_csv_enforcer()
    await _get_sql_enforcer()


async def _maybe_await(result):
    if inspect.isawaitable(result):
        return await result
    return result


async def bootstrap_sql_policies_from_csv(force: bool = False) -> int:
    """
    Bootstrap explicite des policies CSV vers SQL.
    - force=False: refuse d'écraser une table SQL non vide
    - force=True : remplace complètement les policies SQL
    Retourne le nombre de lignes importées.
    """
    sql_e = await _get_sql_enforcer()
    csv_e = await _get_csv_enforcer()

    existing_p = len(sql_e.get_policy())
    existing_g = len(sql_e.get_grouping_policy())
    if not force and (existing_p > 0 or existing_g > 0):
        logger.info(
            "[Casbin] Bootstrap skipped: SQL policy store not empty (p=%d g=%d).",
            existing_p,
            existing_g,
        )
        return 0

    if force:
        await _maybe_await(sql_e.clear_policy())

    imported = 0
    for rule in csv_e.get_policy():
        added = await _maybe_await(sql_e.add_policy(*rule))
        if added:
            imported += 1
    for rule in csv_e.get_grouping_policy():
        added = await _maybe_await(sql_e.add_grouping_policy(*rule))
        if added:
            imported += 1

    await _maybe_await(sql_e.save_policy())
    global _policy_version_local
    if force or imported > 0:
        _policy_version_local = _bump_policy_version(sql_e)
    logger.info("[Casbin] Bootstrap CSV -> SQL done (%d policies imported).", imported)
    return imported


def _load_csv_p_rows() -> list[list[str]]:
    rows: list[list[str]] = []
    with open(_POLICY_PATH, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for raw in reader:
            if not raw:
                continue
            if raw[0].strip().startswith("#"):
                continue
            row = [part.strip() for part in raw]
            if len(row) >= 4 and row[0] == "p":
                rows.append(row)
    return rows


def get_allowed_actions() -> set[str]:
    """Allowed action vocabulary for admin policy API."""
    return set(_ALLOWED_ACTIONS)


def get_allowed_resources() -> set[str]:
    """Allowed resources vocabulary derived from baseline policy CSV."""
    return {row[2] for row in _load_csv_p_rows()}


def get_known_roles_from_csv() -> set[str]:
    """Known role names derived from baseline policy CSV."""
    return {row[1] for row in _load_csv_p_rows()}


def _compact_rule_values(values: list[Optional[str]]) -> list[str]:
    compact = list(values)
    while compact and compact[-1] in (None, ""):
        compact.pop()
    for idx, value in enumerate(compact):
        if value in (None, ""):
            raise ValueError(f"Invalid policy rule: empty value at position v{idx}.")
    return [str(v) for v in compact]


def _to_policy_record(rule: list[str]) -> dict:
    cols: list[Optional[str]] = [None] * 6
    for i, value in enumerate(rule[:6]):
        cols[i] = value
    return {
        "ptype": "p",
        "v0": cols[0],
        "v1": cols[1],
        "v2": cols[2],
        "v3": cols[3],
        "v4": cols[4],
        "v5": cols[5],
    }


async def list_sql_policies() -> list[dict]:
    sql_e = await _get_sql_enforcer()
    policies = sql_e.get_policy()
    return [_to_policy_record(rule) for rule in policies]


async def list_known_roles() -> list[str]:
    sql_e = await _get_sql_enforcer()
    roles = set(get_known_roles_from_csv())
    roles.update(sql_e.get_all_subjects())
    return sorted(roles)


async def add_sql_policy(values: list[Optional[str]]) -> bool:
    """
    Add a p-rule in SQL policy store.
    Returns True when created, False when already present (idempotent).
    """
    sql_e = await _get_sql_enforcer()
    rule = _compact_rule_values(values)
    if not rule:
        return False
    if sql_e.has_policy(*rule):
        return False
    added = sql_e.add_policy(*rule)
    created = bool(await _maybe_await(added))
    if created:
        await _maybe_await(sql_e.save_policy())
        global _policy_version_local
        _policy_version_local = _bump_policy_version(sql_e)
    return created


async def remove_sql_policy(values: list[Optional[str]]) -> bool:
    """
    Remove a p-rule in SQL policy store.
    Returns True when removed, False when absent (idempotent).
    """
    sql_e = await _get_sql_enforcer()
    rule = _compact_rule_values(values)
    if not rule:
        return False
    if not sql_e.has_policy(*rule):
        return False
    removed = sql_e.remove_policy(*rule)
    deleted = bool(await _maybe_await(removed))
    if deleted:
        await _maybe_await(sql_e.save_policy())
        global _policy_version_local
        _policy_version_local = _bump_policy_version(sql_e)
    return deleted
