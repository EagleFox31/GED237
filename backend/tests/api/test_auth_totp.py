"""Authenticator app (TOTP) as the second factor, DEC-2026-004 (d) (L4).

Optional for ordinary accounts (e-mail code otherwise), required for
tenant_admin and super_admin, no e-mail fallback once enrolled, reset by a
superior only, never by the holder."""

import asyncio
import base64
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
import pytest_asyncio
from cryptography.fernet import Fernet
from httpx import AsyncClient
from pydantic import ValidationError
from sqlalchemy import func, select, update

from app.api.v1.endpoints import auth as auth_endpoints
from app.api.v1.endpoints import notifications
from app.cli import admins_without_email, reset_totp
from app.core import dependencies
from app.core.config import Settings, get_settings, settings
from app.core.rate_limit import limiter
from app.core.redis import get_redis
from app.core.security import create_access_token, create_refresh_token
from app.models.audit import AuditLog
from app.models.role import Role
from app.models.user import User
from app.models.user_totp import UserTotp
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
HOLDER = "test@testministry.gov.cm"
# The fake clients' users are built in memory: their password check is stubbed.
PASSWORD = {"current_password": "right"}
T0 = 1_800_000_000  # a fixed instant: steps are counted from here
S0 = T0 // totp.STEP_SECONDS


async def _clear_keys() -> None:
    redis = await get_redis()
    for pattern in (
        "lock:*",
        "otp_fail:*",
        "otp_resend:*",
        "totp_enrol:*",
        "sessions_revoked:*",
    ):
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
    monkeypatch.setattr(
        settings, "AUTH_TOTP_REQUIRED_ROLES", "tenant_admin,super_admin"
    )
    monkeypatch.setattr(settings, "TOTP_ENCRYPTION_KEYS", "")
    monkeypatch.setattr(
        auth_endpoints,
        "verify_password",
        lambda plain, hashed: plain == PASSWORD["current_password"],
    )
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


@pytest.fixture
def required(monkeypatch):
    """The seeded user (collaborator in the database) must use the app."""
    monkeypatch.setattr(settings, "AUTH_TOTP_REQUIRED_ROLES", "collaborator")


def _emailed_code(message) -> str:
    return re.findall(r">(\d{6})<", message.html)[0]


def _other_code(code: str) -> str:
    return str((int(code) + 1) % 1_000_000).zfill(6)


async def _enrol(client: AsyncClient, clock) -> str:
    """Enrol and confirm the seeded user's app at step S0; returns the secret."""
    response = await client.post(f"{TOTP}/enroll", json=PASSWORD)
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


async def _app_count(db) -> int:
    return await db.scalar(select(func.count()).select_from(UserTotp))


async def _audit(db, action: str) -> list:
    found = await db.execute(select(AuditLog).where(AuditLog.action == action))
    return list(found.scalars().all())


async def _seed_app(db, db_seed) -> None:
    """A pending app for the seeded user, written directly."""
    await totp.begin_enrolment(db, await db.get(User, db_seed["user_id"]))


async def _real_user(db, db_seed, matricule: str) -> User:
    """A second account in the database: an audit row needs a real actor."""
    seeded = await db.get(User, db_seed["user_id"])
    user = User(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=seeded.org_unit_id,
        role_id=seeded.role_id,
        matricule=matricule,
        email=f"{uuid.uuid4().hex[:8]}@example.test",
        first_name="Chef",
        last_name="Service",
        password_hash="unused",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    return user


# --- arithmetic and keys --------------------------------------------------------


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


def test_a_bad_encryption_key_is_refused_without_being_echoed():
    with pytest.raises(ValidationError) as caught:
        Settings(TOTP_ENCRYPTION_KEYS="not-a-fernet-key")
    assert "key #1" in str(caught.value)
    assert "not-a-fernet-key" not in str(caught.value)


def test_production_refuses_the_app_without_its_own_key(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "a-production-secret-for-this-test-only")
    monkeypatch.setenv("AUTH_TOTP_ENABLED", "true")
    monkeypatch.setenv("TOTP_ENCRYPTION_KEYS", "")
    get_settings.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="TOTP_ENCRYPTION_KEYS"):
            get_settings()
        monkeypatch.setenv("TOTP_ENCRYPTION_KEYS", Fernet.generate_key().decode())
        get_settings.cache_clear()
        assert len(get_settings().totp_encryption_keys) == 1
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_secret_under_the_old_key_is_read_and_moved_to_the_new_one(
    auth_client: AsyncClient, clock, db_session, db_seed, monkeypatch
):
    old, new = Fernet.generate_key().decode(), Fernet.generate_key().decode()

    async def stored() -> str:
        return await db_session.scalar(
            select(UserTotp.secret_encrypted).where(
                UserTotp.user_id == db_seed["user_id"]
            )
        )

    monkeypatch.setattr(settings, "TOTP_ENCRYPTION_KEYS", old)
    secret = await _enrol(auth_client, clock)
    assert Fernet(old).decrypt(await stored()).decode() == secret

    monkeypatch.setattr(settings, "TOTP_ENCRYPTION_KEYS", f"{new},{old}")
    clock.step = 1
    session = (await _login(auth_client))["session_token"]
    verified = await _verify(auth_client, session, totp.code_at(secret, S0 + 1))
    assert verified.status_code == 200, verified.text
    assert Fernet(new).decrypt(await stored()).decode() == secret


# --- login ---------------------------------------------------------------------


@pytest.mark.asyncio
async def test_valid_app_code_logs_in_and_nothing_is_sent(
    admin_client: AsyncClient, clock, outbox
):
    secret = await _enrol(admin_client, clock)
    outbox.messages.clear()  # the "app added" notice sent at enrolment
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
async def test_ordinary_account_without_app_keeps_the_emailed_code(
    auth_client: AsyncClient, outbox
):
    step1 = await _login(auth_client)
    assert step1["method"] == "email"
    assert len(outbox.messages) == 1
    verified = await _verify(
        auth_client, step1["session_token"], _emailed_code(outbox.messages[0])
    )
    assert verified.status_code == 200, verified.text
    assert verified.json()["access_token"]


@pytest.mark.asyncio
async def test_resend_on_an_app_session_is_refused_and_nothing_is_sent(
    auth_client: AsyncClient, clock, outbox
):
    secret = await _enrol(auth_client, clock)
    outbox.messages.clear()
    clock.step = 1
    step1 = await _login(auth_client)
    assert step1["method"] == "totp"
    resent = await auth_client.post(
        RESEND, json={"session_token": step1["session_token"]}
    )
    assert resent.status_code == 409, resent.text
    assert "OTP_RESEND_UNAVAILABLE" in resent.text
    assert outbox.messages == []
    # The session is untouched: the app code still works.
    verified = await _verify(
        auth_client, step1["session_token"], totp.code_at(secret, S0 + 1)
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
async def test_wrong_app_codes_lock_the_account_and_tell_the_holder(
    auth_client: AsyncClient, clock, outbox
):
    secret = await _enrol(auth_client, clock)
    outbox.messages.clear()
    clock.step = 1
    wrong = _other_code(totp.code_at(secret, S0 + 1))
    statuses = []
    for _ in range(3):
        session = (await _login(auth_client))["session_token"]
        statuses.append((await _verify(auth_client, session, wrong)).status_code)
    assert statuses == [401, 401, 423]
    assert [m.to for m in outbox.messages] == [HOLDER]
    assert "verrouillé" in outbox.messages[0].html


@pytest.mark.asyncio
async def test_lock_on_emailed_codes_sends_no_app_notice(
    auth_client: AsyncClient, outbox
):
    statuses = []
    for _ in range(3):
        session = (await _login(auth_client))["session_token"]
        wrong = _other_code(_emailed_code(outbox.messages[-1]))
        statuses.append((await _verify(auth_client, session, wrong)).status_code)
    assert statuses == [401, 401, 423]
    assert not any("verrouillé" in m.html for m in outbox.messages)


# --- forced enrolment (tenant_admin, super_admin) ---------------------------------


async def _enrolment_token(client: AsyncClient, outbox) -> str:
    step1 = await _login(client)
    assert step1["method"] == "email"
    verified = await _verify(
        client, step1["session_token"], _emailed_code(outbox.messages[-1])
    )
    assert verified.status_code == 200, verified.text
    body = verified.json()
    assert body["status"] == "totp_enrolment_required"
    assert body["expires_in"] == 600
    assert "access_token" not in body and "refresh_token" not in body
    return body["enrolment_token"]


@pytest.mark.asyncio
async def test_required_role_without_app_enrols_before_any_token(
    async_client: AsyncClient, db_seed, db_session, clock, outbox, required
):
    token = await _enrolment_token(async_client, outbox)
    # Not an access token: nothing else opens with it.
    bearer = await async_client.get(TOTP, headers={"Authorization": f"Bearer {token}"})
    assert bearer.status_code == 401

    started = await async_client.post(
        f"{TOTP}/enrolment/start", json={"enrolment_token": token}
    )
    assert started.status_code == 200, started.text
    secret = started.json()["secret"]
    clock.step = 0
    wrong = {"enrolment_token": token, "code": _other_code(totp.code_at(secret, S0))}
    # A typo is not a dead end: the token stays valid, no lock.
    for _ in range(3):
        retry = await async_client.post(f"{TOTP}/enrolment/confirm", json=wrong)
        assert retry.status_code == 400
    outbox.messages.clear()
    done = await async_client.post(
        f"{TOTP}/enrolment/confirm",
        json={"enrolment_token": token, "code": totp.code_at(secret, S0)},
    )
    assert done.status_code == 200, done.text
    assert done.json()["access_token"] and done.json()["refresh_token"]
    assert done.json()["security_notices"] == []  # its own enrolment is no news
    assert [m.to for m in outbox.messages] == [HOLDER]
    assert "ajoutée" in outbox.messages[0].html
    for action in ("totp_enrolment_required", "totp_enrolled", "login"):
        assert len(await _audit(db_session, action)) == 1, action

    spent = await async_client.post(
        f"{TOTP}/enrolment/confirm",
        json={"enrolment_token": token, "code": totp.code_at(secret, S0)},
    )
    assert spent.status_code == 401

    # From now on: the normal login with the app code.
    clock.step = 1
    step1 = await _login(async_client)
    assert step1["method"] == "totp"
    verified = await _verify(
        async_client, step1["session_token"], totp.code_at(secret, S0 + 1)
    )
    assert verified.status_code == 200
    assert verified.json()["access_token"]


@pytest.mark.asyncio
async def test_expired_enrolment_needs_a_new_login_not_an_administrator(
    async_client: AsyncClient, db_seed, outbox, required
):
    token = await _enrolment_token(async_client, outbox)
    first = await async_client.post(
        f"{TOTP}/enrolment/start", json={"enrolment_token": token}
    )
    assert first.status_code == 200
    redis = await get_redis()
    await redis.delete(f"totp_enrol:{token}")  # what the 600 s expiry does
    late = await async_client.post(
        f"{TOTP}/enrolment/start", json={"enrolment_token": token}
    )
    assert late.status_code == 401
    # The unconfirmed app does not block: a new login starts over.
    again = await _enrolment_token(async_client, outbox)
    restarted = await async_client.post(
        f"{TOTP}/enrolment/start", json={"enrolment_token": again}
    )
    assert restarted.status_code == 200
    assert restarted.json()["secret"] != first.json()["secret"]


@pytest.mark.asyncio
async def test_required_role_logs_in_as_before_when_the_app_is_off(
    async_client: AsyncClient, db_seed, required, monkeypatch
):
    monkeypatch.setattr(settings, "AUTH_TOTP_ENABLED", False)
    step1 = await _login(async_client)
    verified = await _verify(async_client, step1["session_token"], step1["otp"])
    assert verified.status_code == 200
    assert verified.json()["access_token"]
    off = await async_client.post(
        f"{TOTP}/enrolment/start", json={"enrolment_token": "x" * 43}
    )
    assert off.status_code == 404


# --- enrolment and removal from the profile --------------------------------------


@pytest.mark.asyncio
async def test_enrolment_rules(admin_client: AsyncClient, clock, monkeypatch):
    status = (await admin_client.get(TOTP)).json()
    assert status == {
        "available": True,
        "enrolled": False,
        "required": True,
        "super_admins_with_app": 0,
    }

    response = await admin_client.post(f"{TOTP}/enroll", json=PASSWORD)
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
    assert (await admin_client.post(f"{TOTP}/enroll", json=PASSWORD)).status_code == 409
    logs = await admin_client.get(
        "/api/v1/audit/logs", params={"action": "totp_enrolled"}
    )
    assert len(logs.json()) == 1

    monkeypatch.setattr(settings, "AUTH_TOTP_ENABLED", False)
    assert (await admin_client.post(f"{TOTP}/enroll", json=PASSWORD)).status_code == 404


@pytest.mark.asyncio
async def test_status_of_an_ordinary_account(auth_client: AsyncClient):
    assert (await auth_client.get(TOTP)).json() == {
        "available": True,
        "enrolled": False,
        "required": False,
        "super_admins_with_app": None,
    }


@pytest.mark.asyncio
async def test_super_admin_sees_how_many_super_admins_have_an_app(
    admin_client: AsyncClient, db_session, db_seed
):
    """Fewer than two: nobody but the ops script can reset the last one."""
    db_session.add(
        Role(id=1, code="super_admin", label="Super administrateur", hierarchy_level=0)
    )
    await db_session.commit()
    holder = await _real_user(db_session, db_seed, "SA001")
    holder.role_id = 1
    db_session.add(
        UserTotp(
            user_id=holder.id,
            tenant_id=holder.tenant_id,
            secret_encrypted=totp.encrypt_secret(totp.generate_secret()),
            confirmed_at=datetime.now(timezone.utc),
        )
    )
    await db_session.commit()
    assert (await admin_client.get(TOTP)).json()["super_admins_with_app"] == 1


@pytest.mark.asyncio
async def test_required_role_cannot_remove_its_own_app(
    admin_client: AsyncClient, clock
):
    secret = await _enrol(admin_client, clock)
    clock.step = 1
    refused = await admin_client.post(
        f"{TOTP}/disable", json={**PASSWORD, "code": totp.code_at(secret, S0 + 1)}
    )
    assert refused.status_code == 403
    assert (await admin_client.get(TOTP)).json()["enrolled"] is True


@pytest.mark.asyncio
async def test_password_alone_does_not_remove_the_app(
    auth_client: AsyncClient, clock, monkeypatch
):
    secret = await _enrol(auth_client, clock)
    clock.step = 1
    monkeypatch.setattr(auth_endpoints, "verify_password", lambda plain, h: True)
    alone = await auth_client.post(
        f"{TOTP}/disable", json={"current_password": "right"}
    )
    assert alone.status_code == 422
    wrong_code = await auth_client.post(
        f"{TOTP}/disable", json={"current_password": "right", "code": "000000"}
    )
    assert wrong_code.status_code == 400
    monkeypatch.setattr(auth_endpoints, "verify_password", lambda plain, h: False)
    wrong_password = await auth_client.post(
        f"{TOTP}/disable",
        json={"current_password": "wrong", "code": totp.code_at(secret, S0 + 1)},
    )
    assert wrong_password.status_code == 400
    assert (await auth_client.get(TOTP)).json()["enrolled"] is True


@pytest.mark.asyncio
async def test_app_code_and_password_remove_the_app(
    auth_client: AsyncClient, clock, db_session, monkeypatch
):
    secret = await _enrol(auth_client, clock)
    clock.step = 1
    monkeypatch.setattr(auth_endpoints, "verify_password", lambda plain, h: True)
    removed = await auth_client.post(
        f"{TOTP}/disable",
        json={"current_password": "right", "code": totp.code_at(secret, S0 + 1)},
    )
    assert removed.status_code == 204
    assert (await auth_client.get(TOTP)).json()["enrolled"] is False
    assert (await _login(auth_client))["method"] == "dev_response"
    # A collaborator cannot read the audit screen: read the table.
    assert len(await _audit(db_session, "totp_disabled")) == 1


@pytest.mark.asyncio
async def test_no_emailed_code_removes_the_app(auth_client: AsyncClient, clock):
    """DEC-2026-004: no e-mail fallback, so no code by e-mail to remove it."""
    await _enrol(auth_client, clock)
    gone = await auth_client.post(f"{TOTP}/disable-code")
    assert gone.status_code in (404, 405)
    assert (await auth_client.get(TOTP)).json()["enrolled"] is True


# --- reset by a superior (lost phone) ---------------------------------------------

T1, T2 = uuid.uuid4(), uuid.uuid4()


@pytest.mark.parametrize(
    "actor_role, actor_tenant, target_role, target_tenant, expected",
    [
        ("super_admin", T2, "super_admin", T1, True),  # another super_admin
        ("super_admin", T2, "tenant_admin", T1, True),
        ("tenant_admin", T1, "collaborator", T1, True),
        ("tenant_admin", T1, "unit_admin", T1, True),  # an agent of the institution
        ("tenant_admin", T1, "collaborator", T2, False),  # another institution
        ("tenant_admin", T1, "tenant_admin", T1, False),  # a peer
        ("tenant_admin", T1, "super_admin", T1, False),
        ("unit_admin", T1, "collaborator", T1, False),
        ("collaborator", T1, "collaborator", T1, False),
        (None, T1, "collaborator", T1, False),
    ],
)
def test_who_may_reset_whom(
    actor_role, actor_tenant, target_role, target_tenant, expected
):
    assert (
        totp.reset_allowed(
            actor_id=uuid.uuid4(),
            actor_role=actor_role,
            actor_tenant=actor_tenant,
            target_id=uuid.uuid4(),
            target_role=target_role,
            target_tenant=target_tenant,
        )
        is expected
    )


@pytest.mark.parametrize("role", ["super_admin", "tenant_admin", "collaborator"])
def test_nobody_resets_their_own_app(role):
    me = uuid.uuid4()
    assert not totp.reset_allowed(
        actor_id=me,
        actor_role=role,
        actor_tenant=T1,
        target_id=me,
        target_role=role,
        target_tenant=T1,
    )


def _reset_url(db_seed) -> str:
    return f"/api/v1/users/{db_seed['user_id']}/totp/reset"


@pytest.mark.asyncio
async def test_tenant_admin_resets_an_agent_audited_and_holder_told(
    client_as, db_session, db_seed, outbox
):
    await _seed_app(db_session, db_seed)
    chief = await _real_user(db_session, db_seed, "TA001")
    async with client_as(
        "tenant_admin", id=chief.id, tenant_id=db_seed["tenant_id"], matricule="TA001"
    ) as client:
        done = await client.post(_reset_url(db_seed))
        assert done.status_code == 204, done.text
        assert await _app_count(db_session) == 0
        rows = await _audit(db_session, "totp_reset")
        assert len(rows) == 1
        assert rows[0].user_id == chief.id
        assert rows[0].record_id == db_seed["user_id"]
        assert rows[0].new_data["by"] == "TA001"
        assert [m.to for m in outbox.messages] == [HOLDER]
        assert "réinitialisé" in outbox.messages[0].html

        # Nothing left: no second audit row, no second e-mail.
        again = await client.post(_reset_url(db_seed))
        assert again.status_code == 204
        assert len(await _audit(db_session, "totp_reset")) == 1
        assert len(outbox.messages) == 1


async def _seeded_role_is(db, db_seed, code: str) -> None:
    await db.execute(
        update(Role).where(Role.id == db_seed["role_id"]).values(code=code)
    )
    await db.commit()


@pytest.mark.asyncio
async def test_super_admin_resets_a_tenant_admin_of_another_institution(
    client_as, db_session, db_seed, outbox
):
    await _seed_app(db_session, db_seed)
    await _seeded_role_is(db_session, db_seed, "tenant_admin")
    chief = await _real_user(db_session, db_seed, "SA002")
    async with client_as("super_admin", id=chief.id, tenant_id=uuid.uuid4()) as client:
        assert (await client.post(_reset_url(db_seed))).status_code == 204
    assert await _app_count(db_session) == 0
    assert (await _audit(db_session, "totp_reset"))[0].new_data["via"] == "app"


@pytest.mark.parametrize(
    "actor, target, same_tenant, allowed",
    [
        ("super_admin", "super_admin", False, True),
        ("super_admin", "tenant_admin", False, True),
        ("super_admin", "collaborator", True, False),  # an agent: never
        ("super_admin", "unit_admin", False, False),
        ("tenant_admin", "collaborator", True, True),
        ("tenant_admin", "unit_admin", True, True),
        ("tenant_admin", "collaborator", False, False),
        ("tenant_admin", "tenant_admin", True, False),
        ("tenant_admin", "super_admin", True, False),
        ("unit_admin", "collaborator", True, False),
    ],
)
def test_who_resets_whom(actor, target, same_tenant, allowed):
    tenant = uuid.uuid4()
    assert (
        totp.reset_allowed(
            actor_id=uuid.uuid4(),
            actor_role=actor,
            actor_tenant=tenant,
            target_id=uuid.uuid4(),
            target_role=target,
            target_tenant=tenant if same_tenant else uuid.uuid4(),
        )
        is allowed
    )


@pytest.mark.asyncio
async def test_reset_is_refused_when_the_server_runs_without_the_app(
    client_as, db_session, db_seed, monkeypatch
):
    await _seed_app(db_session, db_seed)
    monkeypatch.setattr(settings, "AUTH_TOTP_ENABLED", False)
    async with client_as("tenant_admin", tenant_id=db_seed["tenant_id"]) as client:
        refused = await client.post(_reset_url(db_seed))
    assert refused.status_code == 409
    assert refused.json()["detail"] == totp.DISABLED_MESSAGE
    assert await _app_count(db_session) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "role, same_tenant, self_reset, expected",
    [
        ("tenant_admin", False, False, 404),  # another institution: not even seen
        ("super_admin", False, False, 403),  # an agent: its own tenant_admin only
        ("super_admin", True, False, 403),
        ("collaborator", True, False, 403),
        ("unit_admin", True, False, 403),
        ("super_admin", True, True, 403),  # the holder, whatever the role
        ("tenant_admin", True, True, 403),
    ],
)
async def test_reset_refused(
    client_as, db_session, db_seed, outbox, role, same_tenant, self_reset, expected
):
    await _seed_app(db_session, db_seed)
    fields = {
        "id": db_seed["user_id"] if self_reset else uuid.uuid4(),
        "tenant_id": db_seed["tenant_id"] if same_tenant else uuid.uuid4(),
    }
    async with client_as(role, **fields) as client:
        assert (await client.post(_reset_url(db_seed))).status_code == expected
    assert await _app_count(db_session) == 1
    assert await _audit(db_session, "totp_reset") == []
    assert outbox.messages == []


@pytest.mark.asyncio
async def test_reset_of_an_unknown_account_is_404(client_as, db_seed):
    async with client_as("super_admin") as client:
        missing = await client.post(f"/api/v1/users/{uuid.uuid4()}/totp/reset")
    assert missing.status_code == 404


async def _super_admin(db, db_seed, matricule: str, *, active: bool = True) -> User:
    if await db.get(Role, 1) is None:
        db.add(
            Role(
                id=1,
                code="super_admin",
                label="Super administrateur",
                hierarchy_level=0,
            )
        )
    user = await _real_user(db, db_seed, matricule)
    user.role_id = 1
    user.is_active = active
    await db.commit()
    return user


def _ops_args(operator: str, *extra: str):
    return reset_totp.parse_args(
        ["--institution", "TESTMIN", "--matricule", "TEST001", "--operator", operator]
        + list(extra)
    )


@pytest.mark.asyncio
async def test_ops_script_shows_first_then_resets(db_session, db_seed, outbox):
    """The last super_admin: reset from the server, after an in-person check."""
    await _seed_app(db_session, db_seed)
    operator = await _super_admin(db_session, db_seed, "SA002")
    args = _ops_args("SA002")
    lines: list[str] = []
    assert await reset_totp.run(db_session, args, out=lines.append) == 0
    assert lines[-1].startswith("Dry run")
    assert await _app_count(db_session) == 1
    assert outbox.messages == []

    args.apply = True
    assert await reset_totp.run(db_session, args, out=lines.append) == 0
    assert await _app_count(db_session) == 0
    rows = await _audit(db_session, "totp_reset")
    assert len(rows) == 1
    assert rows[0].user_id == operator.id
    assert (rows[0].new_data["by"], rows[0].new_data["via"]) == ("SA002", "ops-script")
    assert rows[0].new_data["self"] is False
    assert [m.to for m in outbox.messages] == [HOLDER]

    assert await reset_totp.run(db_session, args, out=lines.append) == 0
    assert lines[-1] == "Nothing to reset."
    assert len(await _audit(db_session, "totp_reset")) == 1

    unknown = reset_totp.parse_args(
        ["--institution", "TESTMIN", "--matricule", "NOPE", "--operator", "SA002"]
    )
    assert await reset_totp.run(db_session, unknown, out=lines.append) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "operator, extra",
    [
        ("TEST001", []),  # an agent, the holder here
        ("SA404", []),  # nobody
        ("SA003", []),  # a super_admin no longer active
        ("SA002", ["--operator-institution", "NOWHERE"]),
    ],
)
async def test_ops_script_needs_an_active_super_admin_operator(
    db_session, db_seed, outbox, operator, extra
):
    await _seed_app(db_session, db_seed)
    await _super_admin(db_session, db_seed, "SA002")
    await _super_admin(db_session, db_seed, "SA003", active=False)
    args = _ops_args(operator, "--apply", *extra)
    lines: list[str] = []
    assert await reset_totp.run(db_session, args, out=lines.append) == 2
    assert lines[-1].startswith("Operator refused")
    assert await _app_count(db_session) == 1
    assert await _audit(db_session, "totp_reset") == []
    assert outbox.messages == []


async def _holder_is_super_admin(db, db_seed) -> None:
    """After _super_admin, which creates the super_admin role (id 1)."""
    await db.execute(
        update(User).where(User.id == db_seed["user_id"]).values(role_id=1)
    )
    await db.commit()


@pytest.mark.asyncio
async def test_ops_script_refuses_the_holder_while_another_super_admin_is_active(
    db_session, db_seed, outbox
):
    """The holder of a super_admin account is reset by another one, in the app."""
    await _seed_app(db_session, db_seed)
    await _super_admin(db_session, db_seed, "SA002")
    await _holder_is_super_admin(db_session, db_seed)
    lines: list[str] = []
    args = _ops_args("TEST001", "--apply")
    assert await reset_totp.run(db_session, args, out=lines.append) == 2
    assert lines[-1].startswith("Operator refused: TEST001 is the holder and 1 other")
    assert await _app_count(db_session) == 1
    assert await _audit(db_session, "totp_reset") == []
    assert outbox.messages == []


@pytest.mark.asyncio
async def test_ops_script_lets_the_only_active_super_admin_reset_oneself(
    db_session, db_seed, outbox
):
    """Break-glass: nobody else could do it. Said in the output and the audit."""
    await _seed_app(db_session, db_seed)
    await _super_admin(db_session, db_seed, "SA003", active=False)  # does not count
    await _holder_is_super_admin(db_session, db_seed)
    lines: list[str] = []
    args = _ops_args("TEST001")
    assert await reset_totp.run(db_session, args, out=lines.append) == 0
    assert any(line.startswith("Break-glass") for line in lines)
    assert lines[-1].startswith("Dry run")
    assert await _app_count(db_session) == 1

    args.apply = True
    assert await reset_totp.run(db_session, args, out=lines.append) == 0
    assert await _app_count(db_session) == 0
    rows = await _audit(db_session, "totp_reset")
    assert len(rows) == 1
    assert rows[0].user_id == db_seed["user_id"]
    assert (rows[0].new_data["by"], rows[0].new_data["self"]) == ("TEST001", True)
    assert [m.to for m in outbox.messages] == [HOLDER]


@pytest.mark.asyncio
async def test_the_next_login_tells_what_changed_on_the_app(
    auth_client: AsyncClient, db_session, db_seed, clock, outbox
):
    secret = await _enrol(auth_client, clock)
    clock.step = 1
    first = await _verify(
        auth_client,
        (await _login(auth_client))["session_token"],
        totp.code_at(secret, S0 + 1),
    )
    assert [(n["event"], n["by_self"]) for n in first.json()["security_notices"]] == [
        ("totp_enrolled", True)
    ]

    clock.step = 2
    second = await _verify(
        auth_client,
        (await _login(auth_client))["session_token"],
        totp.code_at(secret, S0 + 2),
    )
    assert second.json()["security_notices"] == []  # told once

    chief = await _real_user(db_session, db_seed, "TA001")
    await totp.reset(
        db_session, await db_session.get(User, db_seed["user_id"]), actor=chief
    )
    outbox.messages.clear()
    step1 = await _login(auth_client)
    third = await _verify(
        auth_client, step1["session_token"], _emailed_code(outbox.messages[-1])
    )
    assert third.status_code == 200, third.text
    notices = third.json()["security_notices"]
    assert [(n["event"], n["by_self"]) for n in notices] == [("totp_reset", False)]
    assert notices[0]["at"]


# --- a reset closes every session (stolen phone) ------------------------------

REFRESH = "/api/v1/auth/refresh"
ME = "/api/v1/users/me"


def _tokens(db_seed) -> tuple[str, str]:
    """What a login issues to the seeded user."""
    claims = {
        "sub": str(db_seed["user_id"]),
        "tenant_id": str(db_seed["tenant_id"]),
        "role": "collaborator",
        "matricule": "TEST001",
    }
    return create_access_token(claims), create_refresh_token(claims)


@pytest.mark.asyncio
async def test_reset_revokes_every_session_refresh_tokens_included(
    async_client: AsyncClient, db_session, db_seed, outbox
):
    access, refresh = _tokens(db_seed)
    assert (await async_client.get(ME, headers=_bearer(access))).status_code == 200
    rotated = await async_client.post(REFRESH, json={"refresh_token": refresh})
    assert rotated.status_code == 200, rotated.text
    rotated_refresh = rotated.json()["refresh_token"]

    await _seed_app(db_session, db_seed)
    chief = await _real_user(db_session, db_seed, "TA001")
    assert await totp.reset(
        db_session, await db_session.get(User, db_seed["user_id"]), actor=chief
    )
    assert (await _audit(db_session, "totp_reset"))[0].new_data["sessions_revoked"]

    # Everything issued before the reset is refused, the rotated refresh too.
    assert (await async_client.get(ME, headers=_bearer(access))).status_code == 401
    for old in (refresh, rotated_refresh):
        refused = await async_client.post(REFRESH, json={"refresh_token": old})
        assert refused.status_code == 401, old

    # The holder signs in again: the new tokens work.
    await asyncio.sleep(0.005)
    access, refresh = _tokens(db_seed)
    assert (await async_client.get(ME, headers=_bearer(access))).status_code == 200
    again = await async_client.post(REFRESH, json={"refresh_token": refresh})
    assert again.status_code == 200, again.text


@pytest.mark.asyncio
async def test_nothing_to_reset_revokes_nothing(async_client, db_session, db_seed):
    access, _ = _tokens(db_seed)
    chief = await _real_user(db_session, db_seed, "TA001")
    assert not await totp.reset(
        db_session, await db_session.get(User, db_seed["user_id"]), actor=chief
    )
    assert (await async_client.get(ME, headers=_bearer(access))).status_code == 200


class _Socket:
    """The part of a WebSocket the notifications endpoint touches first."""

    def __init__(self):
        self.closed_with = None

    async def close(self, code=1000):
        self.closed_with = code

    async def accept(self):
        raise AssertionError("a revoked token must not open the socket")


@pytest.mark.asyncio
async def test_websocket_token_issued_before_the_reset_is_refused(
    db_session, db_seed, monkeypatch
):
    @asynccontextmanager
    async def same_session():
        yield db_session

    # get_current_user_ws opens its own session: read the test data instead.
    monkeypatch.setattr(dependencies, "AsyncSessionLocal", same_session)
    old, _ = _tokens(db_seed)
    assert (await dependencies.get_current_user_ws(old)).id == db_seed["user_id"]

    await _seed_app(db_session, db_seed)
    chief = await _real_user(db_session, db_seed, "TA001")
    assert await totp.reset(
        db_session, await db_session.get(User, db_seed["user_id"]), actor=chief
    )

    assert await dependencies.get_current_user_ws(old) is None
    socket = _Socket()
    await notifications.websocket_endpoint(socket, token=old)
    assert socket.closed_with == 1008
    assert str(db_seed["user_id"]) not in notifications.manager.active_connections

    # A token from a new login connects again.
    await asyncio.sleep(0.005)
    fresh, _ = _tokens(db_seed)
    assert (await dependencies.get_current_user_ws(fresh)).id == db_seed["user_id"]


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# --- a role that must use the app needs an e-mail address ----------------------


def _new_user(db_seed, **fields) -> dict:
    return {
        "matricule": "MAIL001",
        "first_name": "Sans",
        "last_name": "Adresse",
        "role_id": db_seed["role_id"],
        "tenant_id": str(db_seed["tenant_id"]),
        "org_unit_id": str(db_seed["org_unit_id"]),
        "password": "mail-test-123",
        **fields,
    }


@pytest.mark.asyncio
async def test_required_role_without_email_is_refused_on_create(
    admin_client: AsyncClient, db_session, db_seed, required
):
    refused = await admin_client.post("/api/v1/users/", json=_new_user(db_seed))
    assert refused.status_code == 422, refused.text
    assert "adresse e-mail" in refused.json()["detail"]
    assert (
        await db_session.scalar(
            select(func.count()).select_from(User).where(User.matricule == "MAIL001")
        )
        == 0
    )

    created = await admin_client.post(
        "/api/v1/users/", json=_new_user(db_seed, email="mail001@testministry.gov.cm")
    )
    assert created.status_code == 201, created.text


@pytest.mark.asyncio
async def test_required_role_cannot_lose_its_email(
    admin_client: AsyncClient, db_session, db_seed, required
):
    url = f"/api/v1/users/{db_seed['user_id']}"
    refused = await admin_client.patch(url, json={"email": None})
    assert refused.status_code == 422, refused.text
    seeded = await db_session.get(User, db_seed["user_id"])
    await db_session.refresh(seeded)
    assert seeded.email == HOLDER


@pytest.mark.asyncio
async def test_ordinary_role_or_app_off_may_have_no_email(
    admin_client: AsyncClient, db_seed, monkeypatch
):
    # The seeded role (collaborator) need not use the app.
    created = await admin_client.post("/api/v1/users/", json=_new_user(db_seed))
    assert created.status_code == 201, created.text
    # The app off: no role needs it, whatever the list says.
    monkeypatch.setattr(settings, "AUTH_TOTP_ENABLED", False)
    monkeypatch.setattr(settings, "AUTH_TOTP_REQUIRED_ROLES", "collaborator")
    other = await admin_client.post(
        "/api/v1/users/", json=_new_user(db_seed, matricule="MAIL002")
    )
    assert other.status_code == 201, other.text


@pytest.mark.asyncio
async def test_script_lists_required_accounts_without_email(
    db_session, db_seed, monkeypatch
):
    lines: list[str] = []
    assert await admins_without_email.run(db_session, out=lines.append) == 0

    seeded = await db_session.get(User, db_seed["user_id"])
    seeded.email = None
    await db_session.commit()
    # Listed even while the app is off: to fix before turning it on.
    monkeypatch.setattr(settings, "AUTH_TOTP_ENABLED", False)
    monkeypatch.setattr(settings, "AUTH_TOTP_REQUIRED_ROLES", "collaborator")
    lines.clear()
    assert await admins_without_email.run(db_session, out=lines.append) == 1
    assert any(line.startswith("- TEST001 (collaborator, TESTMIN)") for line in lines)


# --- security review of #193 ---------------------------------------------------

NON_ASCII_DIGITS = "١٢٣٤٥٦"  # Arabic-Indic: str.isdigit() is True for them


@pytest.mark.asyncio
async def test_a_session_token_alone_does_not_enrol(
    admin_client: AsyncClient, db_session
):
    without = await admin_client.post(f"{TOTP}/enroll")
    assert without.status_code == 422
    wrong = await admin_client.post(
        f"{TOTP}/enroll", json={"current_password": "wrong"}
    )
    assert wrong.status_code == 400
    assert await _app_count(db_session) == 0


@pytest.mark.asyncio
async def test_holder_is_told_when_the_app_is_added_and_removed(
    auth_client: AsyncClient, clock, outbox
):
    secret = await _enrol(auth_client, clock)
    # One notice, sent at confirmation: an unconfirmed secret changes nothing.
    assert [m.to for m in outbox.messages] == [HOLDER]
    assert "ajoutée" in outbox.messages[-1].html
    clock.step = 1
    removed = await auth_client.post(
        f"{TOTP}/disable", json={**PASSWORD, "code": totp.code_at(secret, S0 + 1)}
    )
    assert removed.status_code == 204
    assert len(outbox.messages) == 2
    assert "retirée" in outbox.messages[-1].html


@pytest.mark.asyncio
async def test_non_ascii_digits_are_refused_not_a_server_error(
    auth_client: AsyncClient, clock
):
    await _enrol(auth_client, clock)
    session = (await _login(auth_client))["session_token"]
    assert (await _verify(auth_client, session, NON_ASCII_DIGITS)).status_code == 422
    confirm = await auth_client.post(f"{TOTP}/confirm", json={"code": NON_ASCII_DIGITS})
    assert confirm.status_code == 422
    disable = await auth_client.post(
        f"{TOTP}/disable", json={**PASSWORD, "code": NON_ASCII_DIGITS}
    )
    assert disable.status_code == 422
    enrolment = await auth_client.post(
        f"{TOTP}/enrolment/confirm",
        json={"enrolment_token": "x" * 43, "code": NON_ASCII_DIGITS},
    )
    assert enrolment.status_code == 422
    assert totp.matching_step(totp.generate_secret(), NON_ASCII_DIGITS) is None


@pytest.mark.asyncio
async def test_same_app_code_checked_twice_at_once_passes_once(
    admin_client: AsyncClient, clock
):
    secret = await _enrol(admin_client, clock)
    clock.step = 1
    code = totp.code_at(secret, S0 + 1)
    sessions = [(await _login(admin_client))["session_token"] for _ in range(2)]
    results = await asyncio.gather(*[_verify(admin_client, s, code) for s in sessions])
    assert sorted(r.status_code for r in results) == [200, 401]


@pytest.mark.asyncio
async def test_code_spent_at_login_cannot_remove_the_app(
    auth_client: AsyncClient, clock
):
    secret = await _enrol(auth_client, clock)
    clock.step = 1
    code = totp.code_at(secret, S0 + 1)
    session = (await _login(auth_client))["session_token"]
    assert (await _verify(auth_client, session, code)).status_code == 200
    replay = await auth_client.post(f"{TOTP}/disable", json={**PASSWORD, "code": code})
    assert replay.status_code == 400
    assert (await auth_client.get(TOTP)).json()["enrolled"] is True


@pytest.mark.asyncio
async def test_guessing_on_confirm_and_disable_hits_the_rate_limit(
    auth_client: AsyncClient, clock, monkeypatch
):
    monkeypatch.setattr(settings, "AUTH_OTP_RATE_LIMIT", "3/minute")
    limiter.reset()
    enrolled = await auth_client.post(f"{TOTP}/enroll", json=PASSWORD)
    clock.step = 0
    wrong = {"code": _other_code(totp.code_at(enrolled.json()["secret"], S0))}
    confirms = [
        (await auth_client.post(f"{TOTP}/confirm", json=wrong)).status_code
        for _ in range(4)
    ]
    assert confirms == [400, 400, 400, 429]
    disables = [
        (
            await auth_client.post(f"{TOTP}/disable", json={**PASSWORD, **wrong})
        ).status_code
        for _ in range(4)
    ]
    assert disables == [400, 400, 400, 429]


@pytest.mark.asyncio
async def test_secret_is_not_shown_again_nor_logged(admin_client: AsyncClient, clock):
    secret = await _enrol(admin_client, clock)
    assert secret not in (await admin_client.get(TOTP)).text
    logs = await admin_client.get(
        "/api/v1/audit/logs", params={"action": "totp_enrolled"}
    )
    assert logs.status_code == 200 and len(logs.json()) == 1
    assert secret not in logs.text
