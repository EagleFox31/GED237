"""Second-factor code: delivery channel, hashed storage and POST /auth/resend-otp."""

import logging
import re
import time
from types import SimpleNamespace

import pytest
import pytest_asyncio
from httpx import AsyncClient
from pydantic import ValidationError
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import (
    OTP_CHANNEL_NAMES,
    OTP_SILENT_CHANNELS,
    Settings,
    refuse_unsafe_production,
    settings,
)
from app.core.rate_limit import limiter
from app.core.redis import get_redis
from app.models.user import User
from app.services import auth_service as auth_module
from app.services import email_service, otp_delivery

LOGIN = "/api/v1/auth/login"
VERIFY = "/api/v1/auth/verify-otp"
RESEND = "/api/v1/auth/resend-otp"
AUDIT = "/api/v1/audit/logs"
CREDENTIALS = {
    "institution": "TESTMIN",
    "matricule": "TEST001",
    "password": "testpassword123",
}
SEEDED_EMAIL = "test@testministry.gov.cm"


async def _clear_keys() -> None:
    redis = await get_redis()
    for pattern in ("lock:*", "otp_fail:*", "otp_resend:*", "otp_resend_count:*"):
        async for key in redis.scan_iter(match=pattern):
            await redis.delete(key)


@pytest_asyncio.fixture(autouse=True)
async def otp_env(monkeypatch):
    """Default channel settings, IP limits out of the way, no key left by another test."""
    monkeypatch.setattr(settings, "AUTH_LOGIN_RATE_LIMIT", "1000/minute")
    monkeypatch.setattr(settings, "AUTH_OTP_RATE_LIMIT", "1000/minute")
    monkeypatch.setattr(settings, "AUTH_OTP_MAX_FAILURES", 3)
    monkeypatch.setattr(settings, "AUTH_LOCKOUT_SECONDS", 900)
    monkeypatch.setattr(settings, "AUTH_OTP_CHANNEL", "dev_response")
    monkeypatch.setattr(settings, "AUTH_OTP_RESEND_COOLDOWN_SECONDS", 30)
    monkeypatch.setattr(settings, "AUTH_OTP_RESEND_MAX_PER_WINDOW", 3)
    monkeypatch.setattr(settings, "AUTH_OTP_RESEND_WINDOW_SECONDS", 900)
    limiter.reset()
    await _clear_keys()
    yield
    await _clear_keys()
    limiter.reset()


@pytest.fixture
def outbox(monkeypatch):
    """Email channel on, provider replaced: records what would leave the server."""
    box = SimpleNamespace(messages=[], succeed=True)

    def fake_send_email(to: str, subject: str, html: str) -> bool:
        if box.succeed:
            box.messages.append(SimpleNamespace(to=to, subject=subject, html=html))
        return box.succeed

    monkeypatch.setattr(settings, "AUTH_OTP_CHANNEL", "email")
    monkeypatch.setattr(otp_delivery.email_service, "send_email", fake_send_email)
    return box


def _code_in(message) -> str:
    codes = re.findall(r">(\d{6})<", message.html)
    assert len(codes) == 1, message.html
    return codes[0]


async def _login(client: AsyncClient) -> dict:
    response = await client.post(LOGIN, json=CREDENTIALS)
    assert response.status_code == 200, response.text
    return response.json()


async def _verify(client: AsyncClient, token: str, code: str):
    return await client.post(VERIFY, json={"session_token": token, "otp": code})


async def _audit(client: AsyncClient, action: str) -> list[dict]:
    response = await client.get(AUDIT, params={"action": action})
    assert response.status_code == 200, response.text
    return response.json()


async def _login_keys(redis) -> list[str]:
    return sorted(
        [
            key
            for pattern in ("otp:*", "session:*", "otp_resend:*")
            async for key in redis.scan_iter(match=pattern)
        ]
    )


async def _set_email(test_engine, user_id, email) -> None:
    factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with factory() as session:
        await session.execute(
            update(User).where(User.id == user_id).values(email=email)
        )
        await session.commit()


# --- Settings and port --------------------------------------------------------


def test_default_channel_sends_nothing_and_unknown_channels_are_refused():
    assert Settings.model_fields["AUTH_OTP_CHANNEL"].default == "dev_response"
    assert Settings.model_fields["AUTH_OTP_RESEND_COOLDOWN_SECONDS"].default == 30
    assert set(otp_delivery.CHANNELS) == set(OTP_CHANNEL_NAMES)
    assert otp_delivery.get_channel("dev_response").sends is False
    assert otp_delivery.get_channel("email").echoes_code is False
    with pytest.raises(ValidationError):
        Settings(AUTH_OTP_CHANNEL="pigeon")


@pytest.mark.parametrize("channel", OTP_CHANNEL_NAMES)
def test_production_refuses_to_start_on_a_channel_that_sends_no_code(channel):
    # Checked against each channel's own ``sends``: a channel added later that
    # sends nothing must be refused in production too.
    production = Settings(
        ENVIRONMENT="production", SECRET_KEY="k" * 40, AUTH_OTP_CHANNEL=channel
    )
    assert (channel in OTP_SILENT_CHANNELS) is not otp_delivery.get_channel(
        channel
    ).sends
    if otp_delivery.get_channel(channel).sends:
        refuse_unsafe_production(production)
    else:
        with pytest.raises(RuntimeError, match="nobody could sign in"):
            refuse_unsafe_production(production)
    refuse_unsafe_production(
        Settings(ENVIRONMENT="development", AUTH_OTP_CHANNEL=channel)
    )


def test_stored_value_is_bound_to_the_session_and_old_plain_values_still_match():
    stored = otp_delivery.hash_code("session-a", "123456")

    assert stored.startswith(otp_delivery.HASH_PREFIX) and "123456" not in stored
    assert otp_delivery.code_matches(stored, "session-a", "123456")
    assert not otp_delivery.code_matches(stored, "session-a", "654321")
    assert not otp_delivery.code_matches(stored, "session-b", "123456")
    # A login started before the upgrade left the code itself in Redis.
    assert otp_delivery.code_matches("123456", "session-a", "123456")
    assert not otp_delivery.code_matches("123456", "session-a", "654321")


def test_mask_email_keeps_the_domain_only():
    assert otp_delivery.mask_email("awa.ndi@minfi.cm") == "a***@minfi.cm"
    assert otp_delivery.mask_email("not-an-address") == "***"


# --- Default channel: behaviour of today ---------------------------------------


@pytest.mark.asyncio
async def test_default_channel_echoes_the_code_stores_a_hash_and_audits_no_sending(
    admin_client: AsyncClient, db_seed
):
    step1 = await _login(admin_client)
    redis = await get_redis()
    stored = await redis.get(f"otp:{step1['session_token']}")

    assert len(step1["otp"]) == 6
    assert stored.startswith(otp_delivery.HASH_PREFIX) and step1["otp"] not in stored
    assert await redis.exists(f"otp_resend:{step1['session_token']}") == 0
    verified = await _verify(admin_client, step1["session_token"], step1["otp"])
    assert verified.status_code == 200, verified.text
    assert await _audit(admin_client, "otp_sent") == []
    assert await _audit(admin_client, "otp_send_failed") == []


@pytest.mark.asyncio
async def test_a_login_started_before_the_upgrade_can_still_be_finished(
    async_client: AsyncClient, db_seed
):
    step1 = await _login(async_client)
    redis = await get_redis()
    await redis.set(f"otp:{step1['session_token']}", "424242", keepttl=True)

    verified = await _verify(async_client, step1["session_token"], "424242")

    assert verified.status_code == 200, verified.text


# --- POST /auth/resend-otp ------------------------------------------------------


@pytest.mark.asyncio
async def test_resend_replaces_the_code_then_waits_for_the_cooldown(
    async_client: AsyncClient, db_seed, monkeypatch
):
    codes = iter(["111111", "222222", "333333"])
    monkeypatch.setattr(auth_module, "generate_otp", lambda _length: next(codes))
    step1 = await _login(async_client)
    token = step1["session_token"]

    resent = await async_client.post(RESEND, json={"session_token": token})
    too_soon = await async_client.post(RESEND, json={"session_token": token})

    assert resent.status_code == 200, resent.text
    assert resent.json()["session_token"] == token
    assert resent.json()["otp"] == "222222"
    assert 0 < resent.json()["expires_in"] <= 300
    assert too_soon.status_code == 429, too_soon.text
    assert too_soon.json()["error_code"] == "OTP_RESEND_TOO_SOON"
    assert 0 < too_soon.json()["retry_after"] <= 30
    # The refused request sent nothing: the second code is still the valid one.
    assert (await _verify(async_client, token, "111111")).status_code == 401
    assert (await _verify(async_client, token, "222222")).status_code == 200


@pytest.mark.asyncio
async def test_resend_without_cooldown_is_allowed_each_time(
    async_client: AsyncClient, db_seed, monkeypatch
):
    monkeypatch.setattr(settings, "AUTH_OTP_RESEND_COOLDOWN_SECONDS", 0)
    token = (await _login(async_client))["session_token"]

    statuses = [
        (await async_client.post(RESEND, json={"session_token": token})).status_code
        for _ in range(2)
    ]

    assert statuses == [200, 200]


@pytest.mark.asyncio
async def test_resend_needs_an_open_session(async_client: AsyncClient, db_seed):
    unknown = await async_client.post(RESEND, json={"session_token": "nope"})
    missing = await async_client.post(RESEND, json={})
    step1 = await _login(async_client)
    await _verify(async_client, step1["session_token"], step1["otp"])
    used = await async_client.post(
        RESEND, json={"session_token": step1["session_token"]}
    )

    assert unknown.status_code == 401
    assert missing.status_code == 422
    assert used.status_code == 401


@pytest.mark.asyncio
async def test_resend_is_refused_while_the_account_is_locked(
    async_client: AsyncClient, db_seed
):
    first = await _login(async_client)
    second = await _login(async_client)
    wrong = "000000" if first["otp"] != "000000" else "111111"
    for _ in range(3):
        await _verify(async_client, first["session_token"], wrong)

    locked = await async_client.post(
        RESEND, json={"session_token": second["session_token"]}
    )

    assert locked.status_code == 423, locked.text
    assert locked.json()["error_code"] == "ACCOUNT_LOCKED"


# --- Email channel ---------------------------------------------------------------


@pytest.mark.asyncio
async def test_email_channel_sends_the_code_never_echoes_it_and_audits_a_masked_target(
    admin_client: AsyncClient, db_seed, outbox
):
    response = await admin_client.post(LOGIN, json=CREDENTIALS)
    assert response.status_code == 200, response.text
    step1 = response.json()
    too_soon = await admin_client.post(
        RESEND, json={"session_token": step1["session_token"]}
    )

    assert step1.get("otp") is None
    assert [message.to for message in outbox.messages] == [SEEDED_EMAIL]
    code = _code_in(outbox.messages[0])
    assert code not in outbox.messages[0].subject
    # The delay before a new sending starts at login when a message really left.
    assert too_soon.status_code == 429
    assert (
        await _verify(admin_client, step1["session_token"], code)
    ).status_code == 200
    sent = await _audit(admin_client, "otp_sent")
    assert len(sent) == 1
    assert sent[0]["new_data"] == {
        "channel": "email",
        "target": "t***@testministry.gov.cm",
    }


@pytest.mark.asyncio
async def test_email_channel_refuses_the_login_when_the_sending_fails(
    admin_client: AsyncClient, db_seed, outbox
):
    outbox.succeed = False
    redis = await get_redis()
    keys_before = await _login_keys(redis)

    response = await admin_client.post(LOGIN, json=CREDENTIALS)

    assert response.status_code == 503, response.text
    assert response.json()["error_code"] == "OTP_DELIVERY_FAILED"
    assert response.json()["retryable"] is True
    # No session nor code is left behind.
    assert await _login_keys(redis) == keys_before
    failed = await _audit(admin_client, "otp_send_failed")
    assert [row["new_data"]["reason"] for row in failed] == ["send_failed"]
    assert await _audit(admin_client, "otp_sent") == []


@pytest.mark.asyncio
async def test_email_channel_tells_an_account_without_address_to_see_its_administrator(
    admin_client: AsyncClient, db_seed, test_engine, outbox
):
    await _set_email(test_engine, db_seed["user_id"], None)

    response = await admin_client.post(LOGIN, json=CREDENTIALS)

    assert response.status_code == 409, response.text
    assert response.json()["error_code"] == "OTP_CONTACT_MISSING"
    assert "administrateur" in response.json()["detail"]
    assert outbox.messages == []
    failed = await _audit(admin_client, "otp_send_failed")
    assert [row["new_data"] for row in failed] == [
        {"channel": "email", "reason": "no_contact"}
    ]


@pytest.mark.asyncio
async def test_a_failed_resend_keeps_the_previous_code_and_allows_a_retry(
    async_client: AsyncClient, db_seed, outbox
):
    token = (await _login(async_client))["session_token"]
    first_code = _code_in(outbox.messages[0])
    redis = await get_redis()
    await redis.delete(f"otp_resend:{token}")  # the delay since login is over

    outbox.succeed = False
    failed = await async_client.post(RESEND, json={"session_token": token})

    assert failed.status_code == 503, failed.text
    assert failed.json()["error_code"] == "OTP_DELIVERY_FAILED"
    # The refused sending does not start a new delay.
    assert await redis.exists(f"otp_resend:{token}") == 0
    assert (await _verify(async_client, token, first_code)).status_code == 200


@pytest.mark.asyncio
async def test_a_provider_that_does_not_answer_gives_503_not_a_hanging_login(
    admin_client: AsyncClient, db_seed, outbox, monkeypatch
):
    def stuck_send_email(to: str, subject: str, html: str) -> bool:
        time.sleep(1)
        return True

    monkeypatch.setattr(otp_delivery.email_service, "send_email", stuck_send_email)
    monkeypatch.setattr(settings, "EMAIL_SEND_TIMEOUT_SECONDS", 0.05)

    response = await admin_client.post(LOGIN, json=CREDENTIALS)

    assert response.status_code == 503, response.text
    assert response.json()["error_code"] == "OTP_DELIVERY_FAILED"


def test_email_logs_never_carry_the_address(monkeypatch, caplog):
    monkeypatch.setattr(settings, "EMAIL_ENABLED", False)
    caplog.set_level(logging.INFO, logger="app.services.email_service")

    assert email_service.send_email("awa.ndi@minfi.cm", "Objet", "<p>x</p>") is False

    assert "a***@minfi.cm" in caplog.text
    assert "awa.ndi" not in caplog.text


@pytest.mark.asyncio
async def test_resends_are_capped_per_account_whatever_the_session(
    async_client: AsyncClient, db_seed, monkeypatch
):
    monkeypatch.setattr(settings, "AUTH_OTP_RESEND_COOLDOWN_SECONDS", 0)
    token = (await _login(async_client))["session_token"]

    statuses = [
        (await async_client.post(RESEND, json={"session_token": token})).status_code
        for _ in range(3)
    ]
    refused = await async_client.post(RESEND, json={"session_token": token})
    # A new login session of the same account gets no extra code.
    other = (await _login(async_client))["session_token"]
    again = await async_client.post(RESEND, json={"session_token": other})

    assert statuses == [200, 200, 200]
    assert refused.status_code == 429, refused.text
    assert refused.json()["error_code"] == "OTP_RESEND_QUOTA"
    assert 0 < refused.json()["retry_after"] <= 900
    assert again.status_code == 429
