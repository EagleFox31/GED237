"""Readiness probes behind ``GET /health/ready``.

``GET /health`` stays a static liveness answer (the compose healthcheck and the
ops scripts read it). Readiness tells whether the API can actually serve: the
database answers, its schema is at the Alembic head, Redis answers, and a Celery
worker replies.

The public answer only carries ``ok`` / ``error`` / ``skipped`` per dependency:
exception texts can hold hosts or connection strings and go to the log only.
"""

import asyncio
import logging
import threading
from typing import Awaitable, Callable, Mapping

from sqlalchemy import text
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.database import engine
from app.core.redis import get_redis
from app.core.schema_check import get_schema_status

logger = logging.getLogger(__name__)

OK = "ok"
ERROR = "error"
SKIPPED = "skipped"

Probe = Callable[[], Awaitable[None]]


class ProbeFailure(RuntimeError):
    """A probe failed for a reason that is safe to write to the log as is."""


class ProbeSkipped(Exception):
    """The probe does not apply to the current configuration."""


async def probe_database() -> None:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))


async def probe_schema() -> None:
    if settings.SCHEMA_CHECK_MODE == "off":
        raise ProbeSkipped
    status = await get_schema_status(engine)
    if not status.at_head:
        raise ProbeFailure(status.describe())


async def probe_redis() -> None:
    client = await get_redis()
    await client.ping()


# A worker thread cannot be cancelled: if the broker hangs, the ping outlives the
# request timeout. One ping at a time keeps a dead broker from piling up threads.
_celery_ping_slot = threading.Lock()


def _ping_celery_workers(timeout: float) -> bool:
    from app.workers.celery_app import celery_app

    try:
        return bool(celery_app.control.ping(timeout=timeout))
    finally:
        _celery_ping_slot.release()


async def probe_celery() -> None:
    if not _celery_ping_slot.acquire(blocking=False):
        raise ProbeFailure("previous Celery ping still pending")
    replied = await run_in_threadpool(
        _ping_celery_workers, settings.HEALTH_CHECK_TIMEOUT_SECONDS / 2
    )
    if not replied:
        raise ProbeFailure("no Celery worker replied")


# Name -> probe. ``OPTIONAL_PROBES`` only degrade readiness unless configured otherwise.
PROBES: dict[str, Probe] = {
    "database": probe_database,
    "schema": probe_schema,
    "redis": probe_redis,
    "celery": probe_celery,
}
OPTIONAL_PROBES = frozenset({"celery"})


async def _run_probe(name: str, probe: Probe, timeout: float) -> str:
    try:
        await asyncio.wait_for(probe(), timeout=timeout)
    except ProbeSkipped:
        return SKIPPED
    except ProbeFailure as exc:
        logger.warning("Readiness probe %s failed: %s", name, exc)
        return ERROR
    except asyncio.TimeoutError:
        logger.warning("Readiness probe %s timed out after %ss", name, timeout)
        return ERROR
    except Exception as exc:  # noqa: BLE001 - any dependency failure means "not ready"
        logger.warning("Readiness probe %s failed: %s", name, type(exc).__name__)
        return ERROR
    return OK


async def check_readiness(
    probes: Mapping[str, Probe] | None = None,
    *,
    timeout: float | None = None,
    require_celery: bool | None = None,
) -> tuple[bool, dict]:
    """Run every probe concurrently. Returns ``(can_serve, public_body)``."""
    probes = PROBES if probes is None else probes
    timeout = settings.HEALTH_CHECK_TIMEOUT_SECONDS if timeout is None else timeout
    if require_celery is None:
        require_celery = settings.HEALTH_READY_REQUIRE_CELERY
    optional = frozenset() if require_celery else OPTIONAL_PROBES

    names = list(probes)
    results = await asyncio.gather(
        *(_run_probe(name, probes[name], timeout) for name in names)
    )
    checks = dict(zip(names, results))

    failed = {name for name, result in checks.items() if result == ERROR}
    if failed - optional:
        status = "not_ready"
    elif failed:
        status = "degraded"
    else:
        status = "ready"
    return status != "not_ready", {"status": status, "checks": checks}
