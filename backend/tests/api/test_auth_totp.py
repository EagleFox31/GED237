"""Authenticator app (TOTP) as the main second factor, e-mail as fallback (L4)."""

import base64
import re
from types import SimpleNamespace

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.api.v1.endpoints import auth as auth_endpoints
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.redis import get_redis
from app.services import otp_delivery, totp

LOGIN = "/api/v1/auth/login"
VERIFY = "/api/v1/auth/verify-otp"
RESEND = "/api/v1/auth/resend-otp"
TOTP = "/api/v1/auth/totp"
CREDENTIALS = {
    "institution": "TESTMIN",
    "matricule": "TEST001",
    "password": "testpassword123",
}
T0 = 1_800_000_000  # a fixed instant: steps are counted from here
S0 = T0 // totp.STEP_SECONDS


async def _clear_keys() -> None:
    redis = await get_redis()
    for pattern in ("lock:*", "otp_fail:*", "otp_resend:*"):
        async for key in redis.scan_iter(match=pattern):
            await redis.delete(key)


@pytest_asyncio.fixture(autouse=True)
async def totp_env(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_LOGIN_RATE_LIMIT", "1000/minute")
    monkeypatch.setattr(settings, "AUTH_OTP_RATE_LIMIT", "1000/minute")
    monkeypatch.setattr(settings, "AUTH_OTP_MAX_FAILURES", 3)
    monkeypatch.setattr(settings, "AUTH_LOCKOUT_SECONDS", 900)
    monkeypatch.setattr(settings, "AUTH_OTP_CHANNEL", "dev_response")
    monkeypatch.setattr(settings, "AUTH_OTP_RESEND_COOLDOWN_SECONDS", 30)
    monkeypatch.setattr(settings, "AUTH_TOTP_ENABLED", True)
    limiter.reset()
    await _clear_keys()
    yield
    await _clear_keys()
    limiter.reset()


@pytest.fixture
def clock(monkeypatch):
    """Server clock, in steps from S0."""
    state = SimpleNamespace(step=0)
    monkeypatch.setattr(totp, "_now", lambda: T0 + state.step * totp.STEP_SECONDS + 1)
    return state


@pytest.fixture
def outbox(monkeypatch):
    box = SimpleNamespace(messages=[])

    def fake_send_email(to: str, subject: str, html: str) -> bool:
        box.messages.append(SimpleNamespace(to=to, html=html))
        return True

    monkeypatch.setattr(settings, "AUTH_OTP_CHANNEL", "email")
    monkeypatch.setattr(otp_delivery.email_service, "send_email", fake_send_email)
    return box


def _emailed_code(message) -> str:
    return re.findall(r">(\d{6})<", message.html)[0]


async def _enrol(client: AsyncClient, clock) -> str:
    """Enrol and confirm the seeded user's app at step S0; returns the secret."""
    response = await client.post(f"{TOTP}/enroll")
    assert response.status_code == 200, response.text
    secret = response.json()["secret"]
    assert response.json()["otpauth_uri"].startswith("otpauth://totp/")
    clock.step = 0
    confirmed = await client.post(
        f"{TOTP}/confirm", json={"code": totp.code_at(secret, S0)}
    )
    assert confirmed.status_code == 204, confirmed.text
    return secret


async def _login(client: AsyncClient) -> dict:
    response = await client.post(LOGIN, json=CREDENTIALS)
    assert response.status_code == 200, response.text
    return response.json()


async def _verify(client: AsyncClient, token: str, code: str):
    return await client.post(VERIFY, json={"session_token": token, "otp": code})


# --- arithmetic ----------------------------------------------------------------


def test_rfc6238_sha1_vectors():
    # RFC 6238 appendix B key, base32-encoded as an authenticator app reads it.
    secret = base64.b32encode(b"1234567890" * 2).decode()
    for t, expected in [
        (59, "94287082"),
        (1111111109, "07081804"),
        (1111111111, "14050471"),
        (1234567890, "89005924"),
        (2000000000, "69279037"),
    ]:
        assert totp.code_at(secret, t // 30, digits=8) == expected


def test_secret_is_stored_encrypted_and_read_back():
    secret = totp.generate_secret()
    stored = totp.encrypt_secret(secret)
    assert secret not in stored
    assert totp.decrypt_secret(stored) == secret


# --- login ---------------------------------------------------------------------


@pytest.mark.asyncio
async def test_valid_app_code_logs_in_and_nothing_is_sent(
    admin_client: AsyncClient, clock, outbox
):
    secret = await _enrol(admin_client, clock)
    clock.step = 1
    step1 = await _login(admin_client)
    assert step1["method"] == "totp"
    assert "otp" not in step1 or step1["otp"] is None
    assert outbox.messages == []
    verified = await _verify(
        admin_client, step1["session_token"], totp.code_at(secret, S0 + 1)
    )
    assert verified.status_code == 200, verified.text
    assert verified.json()["access_token"]


@pytest.mark.asyncio
async def test_replayed_app_code_is_refused(admin_client: AsyncClient, clock):
    secret = await _enrol(admin_client, clock)
    clock.step = 1
    code = totp.code_at(secret, S0 + 1)
    first = await _login(admin_client)
    assert (
        await _verify(admin_client, first["session_token"], code)
    ).status_code == 200
    second = await _login(admin_client)
    replay = await _verify(admin_client, second["session_token"], code)
    assert replay.status_code == 401
    # The code used to confirm the app is spent too.
    third = await _login(admin_client)
    spent = await _verify(
        admin_client, third["session_token"], totp.code_at(secret, S0)
    )
    assert spent.status_code == 401


@pytest.mark.asyncio
async def test_clock_drift_of_one_step_is_accepted_two_is_not(
    admin_client: AsyncClient, clock
):
    secret = await _enrol(admin_client, clock)

    async def attempt(server_step: int, code_step: int) -> int:
        clock.step = server_step
        session = (await _login(admin_client))["session_token"]
        code = totp.code_at(secret, S0 + code_step)
        return (await _verify(admin_client, session, code)).status_code

    assert await attempt(5, 4) == 200  # phone one step late
    assert await attempt(5, 6) == 200  # phone one step early
    assert await attempt(6, 8) == 401  # two steps early
    assert await attempt(10, 8) == 401  # two steps late


@pytest.mark.asyncio
async def test_account_without_app_falls_back_to_the_code_channel(
    admin_client: AsyncClient, outbox
):
    step1 = await _login(admin_client)
    assert step1["method"] == "email"
    assert len(outbox.messages) == 1
    verified = await _verify(
        admin_client, step1["session_token"], _emailed_code(outbox.messages[0])
    )
    assert verified.status_code == 200, verified.text


@pytest.mark.asyncio
async def test_new_code_on_an_app_session_goes_by_the_fallback_channel(
    admin_client: AsyncClient, clock, outbox
):
    await _enrol(admin_client, clock)
    step1 = await _login(admin_client)
    assert step1["method"] == "totp"
    resent = await admin_client.post(
        RESEND, json={"session_token": step1["session_token"]}
    )
    assert resent.status_code == 200, resent.text
    assert resent.json()["method"] == "email"
    verified = await _verify(
        admin_client, step1["session_token"], _emailed_code(outbox.messages[-1])
    )
    assert verified.status_code == 200, verified.text


@pytest.mark.asyncio
async def test_setting_off_ignores_an_enrolled_app(
    admin_client: AsyncClient, clock, monkeypatch
):
    await _enrol(admin_client, clock)
    monkeypatch.setattr(settings, "AUTH_TOTP_ENABLED", False)
    step1 = await _login(admin_client)
    assert step1["method"] == "dev_response"
    assert step1["otp"]  # the development echo the login e2e relies on
    verified = await _verify(admin_client, step1["session_token"], step1["otp"])
    assert verified.status_code == 200


@pytest.mark.asyncio
async def test_wrong_app_codes_lock_the_account_like_wrong_codes(
    admin_client: AsyncClient, clock
):
    secret = await _enrol(admin_client, clock)
    clock.step = 1
    wrong = str((int(totp.code_at(secret, S0 + 1)) + 1) % 1_000_000).zfill(6)
    statuses = []
    for _ in range(3):
        session = (await _login(admin_client))["session_token"]
        statuses.append((await _verify(admin_client, session, wrong)).status_code)
    assert statuses == [401, 401, 423]


# --- enrolment -----------------------------------------------------------------


@pytest.mark.asyncio
async def test_enrolment_rules(admin_client: AsyncClient, clock, monkeypatch):
    status = (await admin_client.get(TOTP)).json()
    assert status == {"available": True, "enrolled": False}

    response = await admin_client.post(f"{TOTP}/enroll")
    secret = response.json()["secret"]
    clock.step = 0
    wrong = await admin_client.post(
        f"{TOTP}/confirm", json={"code": totp.code_at(secret, S0 + 5)}
    )
    assert wrong.status_code == 400
    # Not confirmed: the login still uses the code channel.
    assert (await _login(admin_client))["method"] == "dev_response"

    ok = await admin_client.post(
        f"{TOTP}/confirm", json={"code": totp.code_at(secret, S0)}
    )
    assert ok.status_code == 204
    assert (await admin_client.get(TOTP)).json()["enrolled"] is True
    assert (await admin_client.post(f"{TOTP}/enroll")).status_code == 409
    logs = await admin_client.get(
        "/api/v1/audit/logs", params={"action": "totp_enrolled"}
    )
    assert len(logs.json()) == 1

    monkeypatch.setattr(settings, "AUTH_TOTP_ENABLED", False)
    assert (await admin_client.post(f"{TOTP}/enroll")).status_code == 404


@pytest.mark.asyncio
async def test_removing_the_app_needs_the_password(
    admin_client: AsyncClient, clock, monkeypatch
):
    await _enrol(admin_client, clock)
    monkeypatch.setattr(auth_endpoints, "verify_password", lambda plain, h: False)
    refused = await admin_client.post(
        f"{TOTP}/disable", json={"current_password": "wrong"}
    )
    assert refused.status_code == 400
    monkeypatch.setattr(auth_endpoints, "verify_password", lambda plain, h: True)
    removed = await admin_client.post(
        f"{TOTP}/disable", json={"current_password": "right"}
    )
    assert removed.status_code == 204
    assert (await admin_client.get(TOTP)).json()["enrolled"] is False
    assert (await _login(admin_client))["method"] == "dev_response"
