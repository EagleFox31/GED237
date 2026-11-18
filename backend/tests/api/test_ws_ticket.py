"""Notifications WebSocket: single-use ticket instead of the JWT in the URL (#316)."""

import pytest
from fastapi import WebSocketDisconnect
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.api.v1.endpoints import notifications
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


@pytest.mark.asyncio
async def test_endpoint_issues_a_ticket_for_the_caller(
    admin_client: AsyncClient, redis_for_app, db_seed
):
    response = await admin_client.post(TICKET_URL)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["expires_in"] == WS_TICKET_TTL_SECONDS
    owner = await redeem_ws_ticket(redis_for_app, body["ticket"])
    assert owner.user_id == str(db_seed["user_id"])
    assert owner.tenant_id == str(db_seed["tenant_id"])


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
