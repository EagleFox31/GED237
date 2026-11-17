"""Real-time push of in-app notifications (issue #148): modes, instances, token rules."""

import asyncio
import json

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core import dependencies
from app.core.config import Settings, settings
from app.core.redis import get_redis
from app.core.security import create_access_token, create_refresh_token
from app.models.notification import Notification
from app.services.notifications import realtime
from app.services.notifications.in_app import InAppNotifier

MESSAGE = {"id": "n-1", "event_type": "WORKFLOW_ASSIGNED", "message": "À valider"}


class FakeSocket:
    def __init__(self, *, broken: bool = False) -> None:
        self.broken = broken
        self.accepted = False
        self.messages: list[dict] = []

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, message: dict) -> None:
        if self.broken:
            raise RuntimeError("socket closed")
        self.messages.append(message)


class BrokenRedis:
    async def publish(self, channel: str, data: str) -> int:
        raise ConnectionError("redis down")


async def _connected(connections: realtime.ConnectionManager, user_id: str):
    socket = FakeSocket()
    await connections.connect(socket, user_id)
    return socket


def _factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


def _token_data(db_seed) -> dict:
    return {
        "sub": str(db_seed["user_id"]),
        "tenant_id": str(db_seed["tenant_id"]),
        "role": "collaborator",
        "matricule": "TEST001",
    }


# --- Settings -----------------------------------------------------------------


def test_push_is_off_by_default_and_unknown_modes_are_refused():
    assert Settings.model_fields["NOTIFICATIONS_BROADCAST_MODE"].default == "off"
    with pytest.raises(ValidationError):
        Settings(NOTIFICATIONS_BROADCAST_MODE="carrier-pigeon")


# --- Local connections ----------------------------------------------------------


@pytest.mark.asyncio
async def test_a_message_reaches_every_socket_of_its_recipient_and_nobody_else():
    connections = realtime.ConnectionManager()
    first = await _connected(connections, "awa")
    second = await _connected(connections, "awa")
    other = await _connected(connections, "bob")

    delivered = await connections.send_personal_message(MESSAGE, "awa")

    assert first.accepted and delivered == 2
    assert first.messages == [MESSAGE] and second.messages == [MESSAGE]
    assert other.messages == []
    assert await connections.send_personal_message(MESSAGE, "nobody") == 0


@pytest.mark.asyncio
async def test_a_dead_socket_is_dropped_without_blocking_the_others():
    connections = realtime.ConnectionManager()
    dead = FakeSocket(broken=True)
    await connections.connect(dead, "awa")
    alive = await _connected(connections, "awa")

    delivered = await connections.send_personal_message(MESSAGE, "awa")

    assert delivered == 1 and alive.messages == [MESSAGE]
    assert connections.active_connections["awa"] == [alive]
    connections.disconnect(alive, "awa")
    connections.disconnect(alive, "awa")  # twice: no error
    assert connections.active_connections == {}


# --- Modes ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_off_pushes_nothing_and_local_pushes_to_this_process(fake_redis):
    connections = realtime.ConnectionManager()
    socket = await _connected(connections, "awa")

    await realtime.push("awa", MESSAGE, mode="off", connections=connections)
    assert socket.messages == []

    await realtime.push(
        "awa", MESSAGE, mode="local", connections=connections, redis_client=fake_redis
    )
    assert socket.messages == [MESSAGE]


@pytest.mark.asyncio
async def test_redis_mode_reaches_a_socket_held_by_another_instance(fake_redis):
    instance_a = realtime.ConnectionManager()
    instance_b = realtime.ConnectionManager()
    recipient = await _connected(instance_b, "awa")
    bystander = await _connected(instance_b, "bob")
    listener = asyncio.create_task(
        realtime.listen(fake_redis, instance_b, retry_seconds=0.01)
    )
    try:
        # Published again until the listener of instance B has subscribed.
        for _ in range(100):
            await realtime.push(
                "awa",
                MESSAGE,
                mode="redis",
                connections=instance_a,
                redis_client=fake_redis,
            )
            await asyncio.sleep(0.02)
            if recipient.messages:
                break
    finally:
        listener.cancel()
        with pytest.raises(asyncio.CancelledError):
            await listener

    assert recipient.messages and recipient.messages[0] == MESSAGE
    assert bystander.messages == []


@pytest.mark.asyncio
async def test_redis_down_still_serves_the_sockets_of_this_instance():
    connections = realtime.ConnectionManager()
    socket = await _connected(connections, "awa")

    await realtime.push(
        "awa",
        MESSAGE,
        mode="redis",
        connections=connections,
        redis_client=BrokenRedis(),
    )

    assert socket.messages == [MESSAGE]


@pytest.mark.asyncio
async def test_a_malformed_published_payload_is_skipped():
    connections = realtime.ConnectionManager()
    socket = await _connected(connections, "awa")

    assert await realtime.forward("not json", connections) == 0
    assert await realtime.forward(json.dumps({"message": MESSAGE}), connections) == 0
    assert await realtime.forward(None, connections) == 0
    assert (
        await realtime.forward(
            json.dumps({"user_id": "awa", "message": MESSAGE}), connections
        )
        == 1
    )
    assert socket.messages == [MESSAGE]


@pytest.mark.asyncio
async def test_the_listener_starts_once_and_only_in_redis_mode(monkeypatch):
    started = []

    async def fake_listen() -> None:
        started.append(1)
        await asyncio.Event().wait()

    monkeypatch.setattr(realtime, "listen", fake_listen)
    monkeypatch.setattr(settings, "NOTIFICATIONS_BROADCAST_MODE", "local")
    assert await realtime.start_listener() is False

    monkeypatch.setattr(settings, "NOTIFICATIONS_BROADCAST_MODE", "redis")
    try:
        assert await realtime.start_listener() is True
        assert await realtime.start_listener() is False
        await asyncio.sleep(0)
        assert started == [1]
    finally:
        await realtime.stop_listener()
    await realtime.stop_listener()  # twice: no error
    assert realtime._listener_task is None


# --- Notifier -------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_saved_notification_is_pushed_with_the_shape_of_the_rest_list(
    db_seed, test_engine, monkeypatch
):
    user_id = str(db_seed["user_id"])
    socket = await _connected(realtime.manager, user_id)
    try:
        async with _factory(test_engine)() as session:
            monkeypatch.setattr(settings, "NOTIFICATIONS_BROADCAST_MODE", "off")
            silent = await InAppNotifier().send(
                user_id, str(db_seed["tenant_id"]), "INFO", "Sans push", {}, session
            )
            assert silent is True and socket.messages == []

            monkeypatch.setattr(settings, "NOTIFICATIONS_BROADCAST_MODE", "local")
            pushed = await InAppNotifier().send(
                user_id,
                str(db_seed["tenant_id"]),
                "WORKFLOW_ASSIGNED",
                "À valider",
                {"document_title": "Note"},
                session,
            )
            rows = (
                (
                    await session.execute(
                        select(Notification).where(
                            Notification.event_type == "WORKFLOW_ASSIGNED"
                        )
                    )
                )
                .scalars()
                .all()
            )
    finally:
        realtime.manager.disconnect(socket, user_id)

    assert pushed is True and len(rows) == 1
    assert socket.messages == [realtime.serialize_notification(rows[0])]
    assert set(socket.messages[0]) == {
        "id",
        "event_type",
        "message",
        "is_read",
        "meta_data",
        "created_at",
    }
    assert socket.messages[0]["is_read"] is False


@pytest.mark.asyncio
async def test_a_failing_push_does_not_fail_the_notification(
    db_seed, test_engine, monkeypatch
):
    async def exploding_push(_notification) -> None:
        raise RuntimeError("push broken")

    monkeypatch.setattr(settings, "NOTIFICATIONS_BROADCAST_MODE", "redis")
    monkeypatch.setattr(realtime, "push_notification", exploding_push)

    async with _factory(test_engine)() as session:
        saved = await InAppNotifier().send(
            str(db_seed["user_id"]),
            str(db_seed["tenant_id"]),
            "WORKFLOW_COMPLETED",
            "Terminé",
            {},
            session,
        )
        count = len(
            (
                await session.execute(
                    select(Notification.id).where(
                        Notification.event_type == "WORKFLOW_COMPLETED"
                    )
                )
            ).all()
        )

    assert saved is True and count == 1


# --- WebSocket token --------------------------------------------------------------


@pytest.mark.asyncio
async def test_the_websocket_accepts_an_access_token_only_and_not_a_revoked_one(
    db_seed, test_engine, monkeypatch
):
    monkeypatch.setattr(dependencies, "AsyncSessionLocal", _factory(test_engine))
    access = create_access_token(_token_data(db_seed))
    revoked = create_access_token({**_token_data(db_seed), "jti": "revoked"})
    refresh = create_refresh_token(_token_data(db_seed))
    redis = await get_redis()
    await redis.set(f"blacklist:{revoked}", "1", ex=60)
    try:
        accepted = await dependencies.get_current_user_ws(access)
        with_refresh = await dependencies.get_current_user_ws(refresh)
        with_revoked = await dependencies.get_current_user_ws(revoked)
        with_garbage = await dependencies.get_current_user_ws("not-a-token")
    finally:
        await redis.delete(f"blacklist:{revoked}")

    assert accepted is not None and accepted.id == db_seed["user_id"]
    assert with_refresh is None
    assert with_revoked is None
    assert with_garbage is None
