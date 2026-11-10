"""Lot 3b (V1.1): account locked for a while after 3 wrong OTP codes."""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.redis import get_redis
from app.core.security import hash_password
from app.models.user import User

LOGIN = "/api/v1/auth/login"
VERIFY = "/api/v1/auth/verify-otp"
CREDENTIALS = {
    "institution": "TESTMIN",
    "matricule": "TEST001",
    "password": "testpassword123",
}


async def _clear_lock_keys() -> None:
    redis = await get_redis()
    for pattern in ("lock:*", "otp_fail:*"):
        async for key in redis.scan_iter(match=pattern):
            await redis.delete(key)


@pytest_asyncio.fixture(autouse=True)
async def lockout_env(monkeypatch):
    """Default lock settings, IP limits out of the way, no lock left by another test."""
    monkeypatch.setattr(settings, "AUTH_LOGIN_RATE_LIMIT", "1000/minute")
    monkeypatch.setattr(settings, "AUTH_OTP_RATE_LIMIT", "1000/minute")
    monkeypatch.setattr(settings, "AUTH_OTP_MAX_FAILURES", 3)
    monkeypatch.setattr(settings, "AUTH_LOCKOUT_SECONDS", 900)
    limiter.reset()
    await _clear_lock_keys()
    yield
    await _clear_lock_keys()
    limiter.reset()


async def _login(client: AsyncClient, **overrides) -> dict:
    response = await client.post(LOGIN, json={**CREDENTIALS, **overrides})
    assert response.status_code == 200, response.text
    return response.json()


async def _wrong_otps(client: AsyncClient, step1: dict, n: int) -> list:
    wrong = "000000" if step1["otp"] != "000000" else "111111"
    return [
        await client.post(
            VERIFY, json={"session_token": step1["session_token"], "otp": wrong}
        )
        for _ in range(n)
    ]


def _assert_locked(response) -> None:
    assert response.status_code == 423, response.text
    body = response.json()
    assert body["error_code"] == "ACCOUNT_LOCKED"
    assert body["detail"] == "Compte verrouillé 15 min après 3 codes erronés"
    assert 0 < body["retry_after"] <= 900


@pytest.mark.asyncio
async def test_third_wrong_otp_locks_and_ends_the_session(
    async_client: AsyncClient, db_seed
):
    step1 = await _login(async_client)

    responses = await _wrong_otps(async_client, step1, 3)

    assert [r.status_code for r in responses[:2]] == [401, 401]
    _assert_locked(responses[2])
    redis = await get_redis()
    token = step1["session_token"]
    assert await redis.exists(f"otp:{token}", f"session:{token}") == 0
    # Even the right code is refused now.
    right = await async_client.post(
        VERIFY, json={"session_token": token, "otp": step1["otp"]}
    )
    assert right.status_code == 401


@pytest.mark.asyncio
async def test_login_of_a_locked_account_is_423_other_account_still_logs_in(
    async_client: AsyncClient, test_engine, db_seed
):
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        session.add(
            User(
                id=uuid.uuid4(),
                tenant_id=db_seed["tenant_id"],
                org_unit_id=db_seed["org_unit_id"],
                role_id=db_seed["role_id"],
                matricule="TEST002",
                email="test2@testministry.gov.cm",
                first_name="Autre",
                last_name="Agent",
                password_hash=hash_password("autrepassword123"),
                is_active=True,
            )
        )
        await session.commit()
    await _wrong_otps(async_client, await _login(async_client), 3)
    redis = await get_redis()
    otp_keys_before = [key async for key in redis.scan_iter(match="otp:*")]

    locked = await async_client.post(LOGIN, json=CREDENTIALS)
    wrong_password = await async_client.post(
        LOGIN, json={**CREDENTIALS, "password": "pas-le-bon"}
    )

    _assert_locked(locked)
    # Same answer with a wrong password: the lock reveals nothing about the password.
    _assert_locked(wrong_password)
    assert [key async for key in redis.scan_iter(match="otp:*")] == otp_keys_before
    await _login(async_client, matricule="TEST002", password="autrepassword123")


@pytest.mark.asyncio
async def test_right_otp_resets_the_failure_count(async_client: AsyncClient, db_seed):
    step1 = await _login(async_client)
    await _wrong_otps(async_client, step1, 2)

    right = await async_client.post(
        VERIFY, json={"session_token": step1["session_token"], "otp": step1["otp"]}
    )

    assert right.status_code == 200, right.text
    redis = await get_redis()
    assert await redis.exists(f"otp_fail:{db_seed['user_id']}") == 0
    codes = [
        r.status_code
        for r in await _wrong_otps(async_client, await _login(async_client), 3)
    ]
    assert codes == [401, 401, 423]


@pytest.mark.asyncio
async def test_login_works_again_when_the_lock_expires(
    async_client: AsyncClient, db_seed
):
    await _wrong_otps(async_client, await _login(async_client), 3)
    redis = await get_redis()

    # Stands for the 15 minutes having passed.
    await redis.delete(f"lock:{db_seed['user_id']}")

    await _login(async_client)


@pytest.mark.asyncio
async def test_lock_is_audited_without_the_code(admin_client: AsyncClient, db_seed):
    step1 = await _login(admin_client)
    await _wrong_otps(admin_client, step1, 3)

    logs = (
        await admin_client.get(
            "/api/v1/audit/logs", params={"action": "account_locked"}
        )
    ).json()

    assert len(logs) == 1
    assert logs[0]["table_name"] == "users"
    assert logs[0]["new_data"] == {"failures": 3, "lock_seconds": 900}
