"""Quality alerts: one notification per breach and per return below the threshold,
refusals, and the /analytics/quality/alerts routes."""

import uuid

import pytest
from sqlalchemy import func, select, update

from app.models.document import Document
from app.models.notification import Notification
from app.models.quality_alert import QualityAlertEvent, QualityAlertRule
from app.models.user import User
from app.services.quality_alerts import EVENT_TYPE, evaluate_rules

ALERTS = "/api/v1/analytics/quality/alerts"


async def _document(db_session, db_seed, **overrides) -> Document:
    fields = dict(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        owner_id=db_seed["user_id"],
        title="doc",
        file_path=f"x/{uuid.uuid4()}.pdf",
        document_category_id=db_seed["category_id"],
        classification_year=2026,
        classification_status="classified",
        ocr_content="texte reconnu",
    )
    fields.update(overrides)
    document = Document(**fields)
    db_session.add(document)
    await db_session.commit()
    return document


async def _rule(db_session, db_seed, **overrides) -> QualityAlertRule:
    fields = dict(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        created_by=db_seed["user_id"],
        name="Années manquantes",
        indicator="missing_year",
        measure="count",
        threshold=1,
        scope={},
        is_active=True,
    )
    fields.update(overrides)
    rule = QualityAlertRule(**fields)
    db_session.add(rule)
    await db_session.commit()
    return rule


async def _alert_messages(db_session) -> list[str]:
    rows = await db_session.scalars(
        select(Notification.message)
        .where(Notification.event_type == EVENT_TYPE)
        .order_by(Notification.created_at)
    )
    return list(rows.all())


async def _set_year(db_session, document_id, year) -> None:
    await db_session.execute(
        update(Document)
        .where(Document.id == document_id)
        .values(classification_year=year)
    )
    await db_session.commit()


@pytest.mark.asyncio
async def test_one_notification_per_breach_and_per_return(db_session, db_seed):
    document = await _document(db_session, db_seed, classification_year=None)
    rule = await _rule(db_session, db_seed)

    first = await evaluate_rules(db_session)
    assert first.opened == [str(rule.id)]
    messages = await _alert_messages(db_session)
    assert len(messages) == 1 and "Sans année" in messages[0]

    second = await evaluate_rules(db_session)  # still breached: nothing new
    assert (second.opened, second.unchanged) == ([], 1)
    assert len(await _alert_messages(db_session)) == 1

    await _set_year(db_session, document.id, 2026)
    third = await evaluate_rules(db_session)
    assert third.cleared == [str(rule.id)]
    messages = await _alert_messages(db_session)
    assert len(messages) == 2 and messages[1].startswith("Fin d'alerte")

    fourth = await evaluate_rules(db_session)  # still below: nothing new
    assert (fourth.cleared, fourth.unchanged) == ([], 1)

    await _set_year(db_session, document.id, None)
    fifth = await evaluate_rules(db_session)
    assert fifth.opened == [str(rule.id)]
    events = (
        await db_session.scalars(
            select(QualityAlertEvent).where(QualityAlertEvent.rule_id == rule.id)
        )
    ).all()
    assert sorted(event.cleared_at is None for event in events) == [False, True]
    assert len(await _alert_messages(db_session)) == 3


@pytest.mark.asyncio
async def test_a_rate_rule_needs_documents_in_scope(db_session, db_seed):
    rule = await _rule(
        db_session, db_seed, indicator="no_text", measure="rate", threshold=50
    )
    empty = await evaluate_rules(db_session)  # no document: no rate, no alert
    assert (empty.opened, empty.unchanged) == ([], 1)

    await _document(db_session, db_seed)
    await _document(db_session, db_seed, ocr_content=None)
    result = await evaluate_rules(db_session)  # 1 of 2 documents: 50 %
    assert result.opened == [str(rule.id)]
    assert "50 %" in (await _alert_messages(db_session))[0]


@pytest.mark.asyncio
async def test_an_inactive_creator_is_refused_without_notification(db_session, db_seed):
    await _document(db_session, db_seed, classification_year=None)
    rule = await _rule(db_session, db_seed)
    await db_session.execute(
        update(User).where(User.id == db_seed["user_id"]).values(is_active=False)
    )
    await db_session.commit()

    result = await evaluate_rules(db_session)
    assert (result.opened, result.refused) == ([], [str(rule.id)])
    assert (
        await db_session.scalar(select(func.count()).select_from(QualityAlertEvent))
        == 0
    )
    assert await _alert_messages(db_session) == []


@pytest.mark.asyncio
async def test_a_stopped_rule_is_ignored(db_session, db_seed):
    await _document(db_session, db_seed, classification_year=None)
    await _rule(db_session, db_seed, is_active=False)
    result = await evaluate_rules(db_session)
    assert (result.opened, result.unchanged, result.refused) == ([], 0, [])


@pytest.mark.asyncio
async def test_create_list_and_stop_an_alert(admin_client, db_session, db_seed):
    await _document(db_session, db_seed, classification_year=None)
    created = await admin_client.post(
        ALERTS,
        json={
            "name": "Années manquantes",
            "indicator": "missing_year",
            "measure": "count",
            "threshold": 1,
            "scope": {"recursive": True},
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["alerting_since"] is None
    assert body["scope"]["recursive"] is True

    await evaluate_rules(db_session)
    listed = (await admin_client.get(ALERTS)).json()
    assert [item["id"] for item in listed] == [body["id"]]
    assert listed[0]["alerting_since"] is not None

    stopped = await admin_client.delete(f"{ALERTS}/{body['id']}")
    assert stopped.status_code == 204
    assert (await admin_client.get(ALERTS)).json() == []
    again = await admin_client.delete(f"{ALERTS}/{body['id']}")
    assert again.status_code == 204  # already stopped: no-op


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"indicator": "no_text", "measure": "rate", "threshold": 120},
        {"indicator": "unknown", "measure": "count", "threshold": 1},
        {"indicator": "no_text", "measure": "count", "threshold": -1},
    ],
)
async def test_invalid_alert_is_rejected(admin_client, payload):
    response = await admin_client.post(ALERTS, json={"name": "x", **payload})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_a_foreign_alert_is_not_found(client_as, db_session, db_seed):
    rule = await _rule(db_session, db_seed)
    async with client_as("tenant_admin", tenant_id=db_seed["tenant_id"]) as client:
        response = await client.delete(f"{ALERTS}/{rule.id}")
    assert response.status_code == 404
