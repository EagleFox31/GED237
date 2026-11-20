"""Response headers the frontend reads when the API is on another origin."""

import pytest
from httpx import AsyncClient

from app.core.config import settings


@pytest.mark.asyncio
async def test_cross_origin_response_exposes_total_and_file_name(
    async_client: AsyncClient,
):
    origin = settings.ALLOWED_ORIGINS[0]
    response = await async_client.get("/health", headers={"Origin": origin})
    assert response.headers["access-control-allow-origin"] == origin
    exposed = {
        name.strip().lower()
        for name in response.headers["access-control-expose-headers"].split(",")
    }
    assert {"x-total-count", "content-disposition"} <= exposed
