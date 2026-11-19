"""GET /health/ready probes the dependencies ; GET /health keeps its static contract."""

import asyncio
import logging

import pytest
from httpx import AsyncClient
from pydantic import ValidationError

from app.core import health
from app.core.config import Settings, settings

SECRET_DSN = "postgresql://ged:s3cret@db.internal:5432/edossier"


async def _ok() -> None:
    return None


async def _boom() -> None:
    raise ConnectionError(f"cannot connect to {SECRET_DSN}")


async def _slow() -> None:
    await asyncio.sleep(5)


async def _skipped() -> None:
    raise health.ProbeSkipped


def _probes(**overrides):
    probes = {"database": _ok, "schema": _ok, "redis": _ok, "celery": _ok}
    probes.update(overrides)
    return probes


@pytest.mark.asyncio
async def test_health_contract_is_unchanged(async_client: AsyncClient, monkeypatch):
    """Compose healthcheck, restore proof and probes read exactly these keys."""
    monkeypatch.setattr(health, "PROBES", _probes(database=_boom, redis=_boom))
    resp = await async_client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "service": "E-Dossier Cameroun API",
    }


@pytest.mark.asyncio
async def test_ready_when_every_probe_answers(async_client: AsyncClient, monkeypatch):
    monkeypatch.setattr(health, "PROBES", _probes())
    resp = await async_client.get("/health/ready")
    assert resp.status_code == 200
    assert resp.json() == {
        "status": "ready",
        "checks": {"database": "ok", "schema": "ok", "redis": "ok", "celery": "ok"},
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["database", "schema", "redis"])
async def test_required_dependency_down_is_503_without_detail(
    async_client: AsyncClient, monkeypatch, caplog, name
):
    monkeypatch.setattr(health, "PROBES", _probes(**{name: _boom}))
    with caplog.at_level(logging.WARNING, logger="app.core.health"):
        resp = await async_client.get("/health/ready")
    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == "not_ready"
    assert body["checks"][name] == "error"
    assert {v for k, v in body["checks"].items() if k != name} == {"ok"}
    # Neither the answer nor the log carries the exception text (hosts, credentials).
    assert "s3cret" not in resp.text and "db.internal" not in resp.text
    assert "s3cret" not in caplog.text and "db.internal" not in caplog.text
    assert f"Readiness probe {name} failed: ConnectionError" in caplog.text


@pytest.mark.asyncio
async def test_celery_down_only_degrades_by_default(
    async_client: AsyncClient, monkeypatch
):
    monkeypatch.setattr(settings, "HEALTH_READY_REQUIRE_CELERY", False)
    monkeypatch.setattr(health, "PROBES", _probes(celery=_boom))
    resp = await async_client.get("/health/ready")
    assert resp.status_code == 200
    assert resp.json()["status"] == "degraded"
    assert resp.json()["checks"]["celery"] == "error"


@pytest.mark.asyncio
async def test_celery_down_is_503_in_strict_mode(
    async_client: AsyncClient, monkeypatch
):
    monkeypatch.setattr(settings, "HEALTH_READY_REQUIRE_CELERY", True)
    monkeypatch.setattr(health, "PROBES", _probes(celery=_boom))
    resp = await async_client.get("/health/ready")
    assert resp.status_code == 503
    assert resp.json()["status"] == "not_ready"


@pytest.mark.asyncio
async def test_slow_probe_is_cut_at_the_timeout():
    can_serve, body = await asyncio.wait_for(
        health.check_readiness(_probes(redis=_slow), timeout=0.05), timeout=2
    )
    assert can_serve is False
    assert body["checks"]["redis"] == "error"


@pytest.mark.asyncio
async def test_skipped_probe_does_not_block_readiness():
    can_serve, body = await health.check_readiness(_probes(schema=_skipped))
    assert can_serve is True
    assert body == {
        "status": "ready",
        "checks": {
            "database": "ok",
            "schema": "skipped",
            "redis": "ok",
            "celery": "ok",
        },
    }


@pytest.mark.asyncio
async def test_schema_probe_follows_schema_check_mode(monkeypatch):
    monkeypatch.setattr(settings, "SCHEMA_CHECK_MODE", "off")
    with pytest.raises(health.ProbeSkipped):
        await health.probe_schema()


@pytest.mark.asyncio
async def test_schema_probe_fails_when_not_at_head(monkeypatch):
    class Behind:
        at_head = False

        def describe(self) -> str:
            return "Database schema is not at the Alembic head"

    async def fake_status(_engine):
        return Behind()

    monkeypatch.setattr(settings, "SCHEMA_CHECK_MODE", "fail")
    monkeypatch.setattr(health, "get_schema_status", fake_status)
    with pytest.raises(health.ProbeFailure, match="not at the Alembic head"):
        await health.probe_schema()


@pytest.mark.asyncio
async def test_celery_probe_fails_when_no_worker_replies(monkeypatch):
    monkeypatch.setattr(health, "_ping_celery_workers", _release_and(False))
    with pytest.raises(health.ProbeFailure, match="no Celery worker replied"):
        await health.probe_celery()
    assert not health._celery_ping_slot.locked()


@pytest.mark.asyncio
async def test_celery_probe_never_stacks_pings(monkeypatch):
    """A hung broker keeps one thread busy, not one per readiness call."""
    calls = []
    monkeypatch.setattr(health, "_ping_celery_workers", lambda t: calls.append(t))
    assert health._celery_ping_slot.acquire(blocking=False)
    try:
        with pytest.raises(health.ProbeFailure, match="still pending"):
            await health.probe_celery()
    finally:
        health._celery_ping_slot.release()
    assert calls == []


def _release_and(result):
    def fake_ping(_timeout):
        health._celery_ping_slot.release()
        return result

    return fake_ping


def test_timeout_setting_is_bounded():
    assert Settings().HEALTH_CHECK_TIMEOUT_SECONDS == 2.0
    assert Settings().HEALTH_READY_REQUIRE_CELERY is False
    with pytest.raises(ValidationError):
        Settings(HEALTH_CHECK_TIMEOUT_SECONDS=0)
