"""/health and the OpenAPI schema expose the configured APP_VERSION, never a
hard-coded number: releases set it from the git tag."""

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.main import app


@pytest.mark.asyncio
async def test_health_reports_configured_version(
    async_client: AsyncClient, monkeypatch
):
    monkeypatch.setattr(settings, "APP_VERSION", "9.9.9-test")
    resp = await async_client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"
    assert body["version"] == "9.9.9-test"


def test_openapi_version_follows_settings():
    assert app.version == settings.APP_VERSION
