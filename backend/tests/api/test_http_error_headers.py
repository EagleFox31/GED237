"""Problem Details keep the headers an HTTPException carries (WWW-Authenticate, Allow)."""

import pytest
from fastapi import HTTPException
from httpx import AsyncClient
from starlette.requests import Request

from app.core.errors.handlers import PROBLEM_JSON_MEDIA_TYPE, http_exception_handler


@pytest.mark.asyncio
async def test_handler_keeps_the_exception_headers():
    request = Request({"type": "http", "method": "GET", "path": "/x", "headers": []})
    response = await http_exception_handler(
        request,
        HTTPException(
            status_code=429, detail="Slow down", headers={"Retry-After": "30"}
        ),
    )
    assert response.status_code == 429
    assert response.headers["retry-after"] == "30"
    assert response.media_type == PROBLEM_JSON_MEDIA_TYPE

    plain = await http_exception_handler(request, HTTPException(status_code=404))
    assert "retry-after" not in plain.headers


@pytest.mark.asyncio
async def test_401_tells_the_client_to_send_a_bearer_token(async_client: AsyncClient):
    response = await async_client.get(
        "/api/v1/users/me", headers={"Authorization": "Bearer not-a-token"}
    )
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.headers["content-type"].startswith(PROBLEM_JSON_MEDIA_TYPE)


@pytest.mark.asyncio
async def test_405_lists_the_allowed_methods(async_client: AsyncClient):
    response = await async_client.delete("/health")
    assert response.status_code == 405
    assert "GET" in response.headers["allow"]
