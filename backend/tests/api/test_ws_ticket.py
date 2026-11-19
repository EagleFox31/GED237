"""Notifications WebSocket: single-use ticket instead of the JWT in the URL (#316)."""

import asyncio
import logging

import pytest
from fastapi import WebSocketDisconnect
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api.v1.endpoints import notifications
from app.core.config import Settings, settings
from app.core.observability.log_redaction import (
    UVICORN_LOGGERS,
    QuerySecretFilter,
    install_query_secret_filter,
    redact_query_secrets,
)
from app.core.rate_limit import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    revoked_session_key,
)
from app.services.ws_ticket import (
    WS_TICKET_TTL_SECONDS,
    issue_ws_ticket,
    redeem_ws_ticket,
)

TICKET_URL = "/api/v1/auth/ws-ticket"


class FakeSocket:
    def __init__(self):
        self.closed_with = None
        self.accepted = False

    async def accept(self):
        self.accepted = True

    async def close(self, code=1000):
        self.closed_with = code

    async def receive_text(self):
        raise WebSocketDisconnect()


@pytest.fixture
def redis_for_app(monkeypatch, fake_redis, test_engine):
    async def _get():
        return fake_redis

    # The module-level engine is bound to the first test's event loop: use this
    # test's engine for the user lookup done by the WebSocket authentication.
    monkeypatch.setattr(
        "app.core.dependencies.AsyncSessionLocal",
        async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False),
    )

    monkeypatch.setattr("app.api.v1.endpoints.auth.get_redis", _get)
    monkeypatch.setattr("app.core.dependencies.get_redis", _get)
    return fake_redis


@pytest.mark.asyncio
async def test_ticket_is_single_use_and_short_lived(fake_redis):
    ticket = await issue_ws_ticket(fake_redis, user_id="u1", tenant_id="t1")
    assert 0 < await fake_redis.ttl(f"ws_ticket:{ticket}") <= WS_TICKET_TTL_SECONDS

    owner = await redeem_ws_ticket(fake_redis, ticket)
    assert (owner.user_id, owner.tenant_id) == ("u1", "t1")
    assert await redeem_ws_ticket(fake_redis, ticket) is None


@pytest.mark.asyncio
async def test_unknown_or_empty_ticket_is_refused(fake_redis):
    assert await redeem_ws_ticket(fake_redis, "nope") is None
    assert await redeem_ws_ticket(fake_redis, "") is None


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _token_data(db_seed) -> dict:
    return {
        "sub": str(db_seed["user_id"]),
        "tenant_id": str(db_seed["tenant_id"]),
        "role": "collaborator",
        "matricule": "TEST001",
    }


@pytest.mark.asyncio
async def test_endpoint_issues_a_ticket_for_the_caller(
    async_client: AsyncClient, redis_for_app, db_seed
):
    access = create_access_token(_token_data(db_seed))
    response = await async_client.post(TICKET_URL, headers=_bearer(access))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["expires_in"] == WS_TICKET_TTL_SECONDS
    owner = await redeem_ws_ticket(redis_for_app, body["ticket"])
    assert owner.user_id == str(db_seed["user_id"])
    assert owner.tenant_id == str(db_seed["tenant_id"])


@pytest.mark.asyncio
async def test_refresh_or_revoked_token_gets_no_ticket(
    async_client: AsyncClient, redis_for_app, db_seed
):
    """The rule the socket applied before tickets (#155) now applies here."""
    refresh = create_refresh_token(_token_data(db_seed))
    revoked = create_access_token({**_token_data(db_seed), "jti": "revoked"})
    await redis_for_app.set(f"blacklist:{revoked}", "1", ex=60)

    for token in (refresh, revoked, "not-a-token"):
        response = await async_client.post(TICKET_URL, headers=_bearer(token))
        assert response.status_code == 401, (token[:12], response.text)
    assert await redis_for_app.keys("ws_ticket:*") == []


@pytest.mark.asyncio
async def test_endpoint_requires_authentication(async_client: AsyncClient):
    response = await async_client.post(TICKET_URL)
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_socket_opens_once_with_a_valid_ticket(redis_for_app, db_seed):
    ticket = await issue_ws_ticket(
        redis_for_app,
        user_id=str(db_seed["user_id"]),
        tenant_id=str(db_seed["tenant_id"]),
    )
    first = FakeSocket()
    await notifications.websocket_endpoint(first, ticket=ticket)
    assert first.accepted and first.closed_with is None

    replay = FakeSocket()
    await notifications.websocket_endpoint(replay, ticket=ticket)
    assert not replay.accepted and replay.closed_with == 1008


@pytest.mark.asyncio
async def test_socket_refuses_a_ticket_of_another_tenant(redis_for_app, db_seed):
    ticket = await issue_ws_ticket(
        redis_for_app,
        user_id=str(db_seed["user_id"]),
        tenant_id="00000000-0000-0000-0000-000000000000",
    )
    socket = FakeSocket()
    await notifications.websocket_endpoint(socket, ticket=ticket)
    assert not socket.accepted and socket.closed_with == 1008


@pytest.mark.asyncio
async def test_a_jwt_is_no_longer_accepted_as_credential(redis_for_app):
    socket = FakeSocket()
    await notifications.websocket_endpoint(socket, ticket="eyJhbGciOi.fake.jwt")
    assert not socket.accepted and socket.closed_with == 1008


@pytest.mark.asyncio
async def test_socket_refuses_a_user_disabled_after_the_ticket(
    redis_for_app, db_seed, test_engine
):
    """The ticket proves who asked, not that the account is still active at opening."""
    from sqlalchemy import update

    from app.models.user import User

    ticket = await issue_ws_ticket(
        redis_for_app,
        user_id=str(db_seed["user_id"]),
        tenant_id=str(db_seed["tenant_id"]),
    )
    async with test_engine.begin() as conn:
        await conn.execute(
            update(User).where(User.id == db_seed["user_id"]).values(is_active=False)
        )

    socket = FakeSocket()
    await notifications.websocket_endpoint(socket, ticket=ticket)
    assert not socket.accepted and socket.closed_with == 1008


# --- #471 review: logout closes the open socket, per-user limit, no ticket in logs ---


class OpenSocket(FakeSocket):
    """Stays open until the server closes it or the test hangs up."""

    def __init__(self):
        super().__init__()
        self._gone = asyncio.Event()

    async def close(self, code=1000):
        self.closed_with = code
        self._gone.set()

    def hang_up(self):
        self._gone.set()

    async def receive_text(self):
        await self._gone.wait()
        raise WebSocketDisconnect()


@pytest.fixture
def fast_session_check(monkeypatch, redis_for_app):
    async def _get():
        return redis_for_app

    monkeypatch.setattr(notifications, "get_redis", _get)
    monkeypatch.setattr(notifications, "WS_SESSION_CHECK_SECONDS", 0.01)
    return redis_for_app


async def _open_socket_of_session(redis_client, db_seed, session_id):
    ticket = await issue_ws_ticket(
        redis_client,
        user_id=str(db_seed["user_id"]),
        tenant_id=str(db_seed["tenant_id"]),
        session_id=session_id,
    )
    socket = OpenSocket()
    task = asyncio.create_task(notifications.websocket_endpoint(socket, ticket=ticket))
    for _ in range(200):
        if socket.accepted:
            break
        await asyncio.sleep(0.01)
    assert socket.accepted
    return socket, task


@pytest.mark.asyncio
async def test_ticket_carries_the_login_session_of_the_token(
    async_client: AsyncClient, redis_for_app, db_seed
):
    access = create_access_token({**_token_data(db_seed), "sid": "session-a"})
    response = await async_client.post(TICKET_URL, headers=_bearer(access))
    assert response.status_code == 200, response.text
    owner = await redeem_ws_ticket(redis_for_app, response.json()["ticket"])
    assert owner.session_id == "session-a"


@pytest.mark.asyncio
async def test_logout_closes_the_socket_of_that_session(fast_session_check, db_seed):
    user_id = str(db_seed["user_id"])
    socket, task = await _open_socket_of_session(fast_session_check, db_seed, "s-out")
    await fast_session_check.set(revoked_session_key("s-out"), "1", ex=60)

    await asyncio.wait_for(task, timeout=5)
    assert socket.closed_with == 1008
    assert socket not in notifications.manager.active_connections.get(user_id, [])


@pytest.mark.asyncio
async def test_socket_of_another_session_stays_open(fast_session_check, db_seed):
    socket, task = await _open_socket_of_session(fast_session_check, db_seed, "s-in")
    await fast_session_check.set(revoked_session_key("s-other"), "1", ex=60)
    await asyncio.sleep(0.1)  # several checks

    assert not task.done() and socket.closed_with is None
    socket.hang_up()
    await asyncio.wait_for(task, timeout=5)
    assert socket.closed_with is None


@pytest.mark.asyncio
async def test_ticket_requests_are_limited_per_user(
    async_client: AsyncClient, redis_for_app, db_seed, monkeypatch
):
    monkeypatch.setattr(settings, "AUTH_WS_TICKET_RATE_LIMIT", "2/minute")
    limiter.reset()
    try:
        access = create_access_token(_token_data(db_seed))
        codes = [
            (await async_client.post(TICKET_URL, headers=_bearer(access))).status_code
            for _ in range(3)
        ]
    finally:
        limiter.reset()
    assert codes == [200, 200, 429]


def test_ticket_limit_default():
    assert Settings.model_fields["AUTH_WS_TICKET_RATE_LIMIT"].default == "30/minute"


def test_ticket_in_a_query_string_is_masked_in_uvicorn_logs():
    install_query_secret_filter()
    install_query_secret_filter()  # idempotent
    for name in UVICORN_LOGGERS:
        filters = logging.getLogger(name).filters
        assert sum(isinstance(f, QuerySecretFilter) for f in filters) == 1

    record = logging.LogRecord(
        "uvicorn.error",
        logging.INFO,
        __file__,
        1,
        '%s - "WebSocket %s" [accepted]',
        ("10.0.0.1:5000", "/api/v1/notifications/ws?ticket=SECRET123&x=1"),
        None,
    )
    assert QuerySecretFilter().filter(record)
    message = record.getMessage()
    assert "SECRET123" not in message
    assert "/api/v1/notifications/ws?ticket=[masked]&x=1" in message
    assert redact_query_secrets("GET /api/v1/documents?page=2") == (
        "GET /api/v1/documents?page=2"
    )
