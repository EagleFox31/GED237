"""Le dispatcher isole chaque listener : une erreur de notification ne casse pas l'appelant.

Les routes appellent `dispatch` après leur `commit()` (import, workflow) : si une
exception remontait, la réponse serait une erreur alors que l'opération est enregistrée.
"""

import logging


from app.core.events.dispatcher import EventDispatcher


async def test_a_failing_listener_neither_raises_nor_stops_the_others(caplog):
    events = EventDispatcher()
    received: list[dict] = []

    async def broken(payload):
        raise RuntimeError("notification store down")

    async def healthy(payload):
        received.append(payload)

    events.subscribe("CLASSIFICATION_REVIEWS_PENDING", broken)
    events.subscribe("CLASSIFICATION_REVIEWS_PENDING", healthy)

    with caplog.at_level(logging.ERROR):
        await events.dispatch("CLASSIFICATION_REVIEWS_PENDING", {"count": 3})

    assert received == [{"count": 3}]
    assert "broken" in caplog.text


async def test_an_event_without_listener_is_a_no_op():
    await EventDispatcher().dispatch("UNKNOWN_EVENT", {})
