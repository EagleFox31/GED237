"""Auth rate limits come from settings only, keyed by the real client IP.

Background: DEBUG used to switch login/OTP to 1000/minute, and every stack
built from docker-compose.yml ran with DEBUG=true, i.e. without a real limit.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.rate_limit import limiter
from app.main import app

LOGIN = "/api/v1/auth/login"
BAD_CREDENTIALS = {
    "institution": "TESTMIN",
    "matricule": "nobody",
    "password": "wrongpassword",
}


@pytest.fixture
def tight_login_limit(monkeypatch):
    """Two login attempts per minute, fresh counters, DEBUG and proxy flag off."""
    monkeypatch.setattr(settings, "AUTH_LOGIN_RATE_LIMIT", "2/minute")
    monkeypatch.setattr(settings, "DEBUG", False)
    monkeypatch.setattr(settings, "TRUSTED_PROXY", False)
    limiter.reset()
    yield
    limiter.reset()


async def _attempts(client: AsyncClient, n: int, headers: dict | None = None):
    codes = []
    for _ in range(n):
        response = await client.post(LOGIN, json=BAD_CREDENTIALS, headers=headers)
        codes.append(response.status_code)
    return codes


@pytest.mark.asyncio
async def test_login_limit_applies_without_proxy(async_client, tight_login_limit):
    codes = await _attempts(async_client, 3)
    assert codes[:2] == [401, 401]
    assert codes[2] == 429


@pytest.mark.asyncio
async def test_debug_true_does_not_relax_login_limit(
    async_client, tight_login_limit, monkeypatch
):
    monkeypatch.setattr(settings, "DEBUG", True)
    codes = await _attempts(async_client, 3)
    assert codes[2] == 429


@pytest.mark.asyncio
async def test_forged_forwarded_for_is_ignored_without_trusted_proxy(
    async_client, tight_login_limit
):
    """Rotating X-Forwarded-For must not give the client a fresh counter."""
    codes = []
    for i in range(3):
        codes += await _attempts(
            async_client, 1, headers={"X-Forwarded-For": f"203.0.113.{i}"}
        )
    assert codes == [401, 401, 429]


@pytest.mark.asyncio
async def test_trusted_proxy_keys_on_forwarded_client(
    async_client, tight_login_limit, monkeypatch
):
    """Behind a trusted proxy each forwarded client has its own counter."""
    monkeypatch.setattr(settings, "TRUSTED_PROXY", True)
    first = await _attempts(
        async_client, 3, headers={"X-Forwarded-For": "198.51.100.1"}
    )
    assert first == [401, 401, 429]
    # Another forwarded client gets its own counter.
    other = await _attempts(
        async_client, 1, headers={"X-Forwarded-For": "198.51.100.2"}
    )
    assert other == [401]


@pytest.mark.asyncio
async def test_trusted_proxy_uses_last_forwarded_hop_not_client_supplied_one(
    async_client, tight_login_limit, monkeypatch
):
    """nginx appends the real peer: "forged, real". The key must be the last
    element, otherwise a client rotating the forged part escapes the limit."""
    monkeypatch.setattr(settings, "TRUSTED_PROXY", True)
    codes = []
    for i in range(3):
        codes += await _attempts(
            async_client, 1, headers={"X-Forwarded-For": f"1.2.3.{i}, 10.0.0.9"}
        )
    assert codes == [401, 401, 429]
    # Same real peer without a forged prefix: still the exhausted counter.
    again = await _attempts(async_client, 1, headers={"X-Forwarded-For": "10.0.0.9"})
    assert again == [429]


def test_client_ip_key_function_directly():
    from unittest.mock import patch

    from fastapi import Request

    from app.core.rate_limit import client_ip

    scope = {
        "type": "http",
        "client": ("127.0.0.1", 5000),
        "headers": [(b"x-forwarded-for", b"1.2.3.4, 10.0.0.9")],
    }
    request = Request(scope)
    with patch.object(settings, "TRUSTED_PROXY", True):
        assert client_ip(request) == "10.0.0.9"
    with patch.object(settings, "TRUSTED_PROXY", False):
        assert client_ip(request) == "127.0.0.1"


@pytest.mark.asyncio
async def test_limit_is_read_from_settings_at_request_time(
    async_client, tight_login_limit, monkeypatch
):
    monkeypatch.setattr(settings, "AUTH_LOGIN_RATE_LIMIT", "4/minute")
    codes = await _attempts(async_client, 5)
    assert codes == [401, 401, 401, 401, 429]


def test_defaults_are_strict():
    """Defaults a fresh deployment gets when nothing is configured."""
    from app.core.config import Settings

    fields = Settings.model_fields
    assert fields["DEBUG"].default is False
    assert fields["AUTH_LOGIN_RATE_LIMIT"].default == "5/minute"
    assert fields["AUTH_OTP_RATE_LIMIT"].default == "5/minute"
    assert fields["AUTH_REFRESH_RATE_LIMIT"].default == "10/minute"
    assert fields["TRUSTED_PROXY"].default is False


def test_shared_limiter_is_installed_on_app():
    assert app.state.limiter is limiter


@pytest.mark.asyncio
async def test_each_client_ip_has_its_own_counter(async_client, tight_login_limit):
    assert await _attempts(async_client, 3) == [401, 401, 429]
    transport = ASGITransport(app=app, client=("127.0.0.9", 1))
    async with AsyncClient(transport=transport, base_url="http://test") as other:
        assert await _attempts(other, 1) == [401]
