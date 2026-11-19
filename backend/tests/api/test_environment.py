"""ENVIRONMENT: what production changes, and why it refuses to start.

Production never shows the login code, so it needs a channel that really sends
it, and a JWT key that is not one of the public defaults of this repository.
"""

from pathlib import Path

import pytest
import pytest_asyncio
from httpx import AsyncClient
from pydantic import ValidationError

from app.core import config
from app.core.config import (
    KNOWN_DEFAULT_SECRET_KEYS,
    Settings,
    production_refusals,
    refuse_unsafe_production,
    settings,
)
from app.core.rate_limit import limiter
from app.core.redis import get_redis
from app.main import app, lifespan
from app.services import otp_delivery

ROOT = Path(__file__).resolve().parents[3]
STRONG_KEY = "c" * 64
READY = {
    "ENVIRONMENT": "production",
    "SECRET_KEY": STRONG_KEY,
    "AUTH_OTP_CHANNEL": "email",
    "EMAIL_ENABLED": True,
    "RESEND_API_KEY": "re_key",
}
CREDENTIALS = {
    "institution": "TESTMIN",
    "matricule": "TEST001",
    "password": "testpassword123",
}


def _settings(**overrides) -> Settings:
    # No .env file: only what the test states.
    return Settings(_env_file=None, **{**READY, **overrides})


def test_environment_is_one_of_two_values_whatever_the_case():
    assert Settings.model_fields["ENVIRONMENT"].default == "development"
    assert _settings(ENVIRONMENT=" Production ").is_production
    assert _settings(ENVIRONMENT="DEVELOPMENT").is_development
    for wrong in ("prod", "staging", ""):
        with pytest.raises(ValidationError, match="ENVIRONMENT must be one of"):
            _settings(ENVIRONMENT=wrong)


def test_a_production_with_a_real_channel_and_key_may_start():
    assert production_refusals(_settings()) == []
    refuse_unsafe_production(_settings())


@pytest.mark.parametrize("key", sorted(KNOWN_DEFAULT_SECRET_KEYS) + ["", "   "])
def test_production_refuses_a_public_or_empty_secret_key(key):
    with pytest.raises(RuntimeError, match="SECRET_KEY is empty or a public default"):
        refuse_unsafe_production(_settings(SECRET_KEY=key))


def test_every_default_key_shipped_in_the_repository_is_known():
    """The compose files once had a default the guard did not know (LESSON-2026-042)."""

    def lines(name):
        return (ROOT / name).read_text(encoding="utf-8").splitlines()

    shipped = {
        line.split("SECRET_KEY:-", 1)[1].split("}", 1)[0]
        for name in ("docker-compose.yml", "backend/docker-compose.yml")
        for line in lines(name)
        if "SECRET_KEY:-" in line
    }
    shipped |= {
        line.split("=", 1)[1].strip()
        for name in (".env.example", "backend/.env.example")
        for line in lines(name)
        if line.startswith("SECRET_KEY=")
    }
    shipped.add(Settings.model_fields["SECRET_KEY"].default)
    assert shipped <= KNOWN_DEFAULT_SECRET_KEYS, shipped - KNOWN_DEFAULT_SECRET_KEYS


def test_production_refuses_to_start_without_a_channel_that_sends_the_code():
    with pytest.raises(RuntimeError, match="AUTH_OTP_CHANNEL=dev_response"):
        refuse_unsafe_production(_settings(AUTH_OTP_CHANNEL="dev_response"))


@pytest.mark.parametrize("missing", [{"EMAIL_ENABLED": False}, {"RESEND_API_KEY": ""}])
def test_production_refuses_to_start_when_the_email_cannot_leave(missing):
    with pytest.raises(RuntimeError, match="nobody could sign in"):
        refuse_unsafe_production(_settings(**missing))


def test_every_reason_is_listed_at_once():
    reasons = production_refusals(
        _settings(SECRET_KEY="", AUTH_OTP_CHANNEL="dev_response")
    )
    assert len(reasons) == 2


def test_development_starts_as_before():
    assert (
        production_refusals(
            _settings(
                ENVIRONMENT="development",
                SECRET_KEY=sorted(KNOWN_DEFAULT_SECRET_KEYS)[0],
                AUTH_OTP_CHANNEL="dev_response",
                EMAIL_ENABLED=False,
            )
        )
        == []
    )


def test_get_settings_refuses_a_public_key_in_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "dev-secret-key-change-in-production")
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        config.get_settings.__wrapped__()


@pytest.mark.asyncio
async def test_the_api_does_not_start_in_production_without_a_channel(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "SECRET_KEY", STRONG_KEY)
    monkeypatch.setattr(settings, "AUTH_OTP_CHANNEL", "dev_response")
    with pytest.raises(RuntimeError, match="Refusing to start in production"):
        async with lifespan(app):
            pass


@pytest.mark.asyncio
async def test_health_says_demo_only_in_development(
    async_client: AsyncClient, monkeypatch
):
    assert (await async_client.get("/health")).json()["demo"] is True
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert (await async_client.get("/health")).json()["demo"] is False


@pytest_asyncio.fixture
async def login_env(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_LOGIN_RATE_LIMIT", "1000/minute")
    monkeypatch.setattr(settings, "AUTH_OTP_RATE_LIMIT", "1000/minute")
    limiter.reset()
    redis = await get_redis()
    for pattern in ("lock:*", "otp_fail:*", "otp_resend:*"):
        async for key in redis.scan_iter(match=pattern):
            await redis.delete(key)
    yield
    limiter.reset()


@pytest.mark.asyncio
@pytest.mark.parametrize("channel", ["dev_response", "email"])
async def test_production_never_returns_the_code(
    async_client: AsyncClient, db_seed, login_env, monkeypatch, channel
):
    sent = []

    def fake_send_email(to, subject, html):
        sent.append(to)
        return True

    monkeypatch.setattr(otp_delivery.email_service, "send_email", fake_send_email)
    monkeypatch.setattr(settings, "AUTH_OTP_CHANNEL", channel)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    response = await async_client.post("/api/v1/auth/login", json=CREDENTIALS)

    assert response.status_code == 200, response.text
    # The schema always carries the field; production leaves it empty.
    assert response.json().get("otp") is None
    assert bool(sent) == (channel == "email")
