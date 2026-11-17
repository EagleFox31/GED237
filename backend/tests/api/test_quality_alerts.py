"""Quality alerts: one notification per breach and per return below the threshold,
refusals, and the /analytics/quality/alerts routes."""

import logging
import uuid

import pytest
from sqlalchemy import func, select, update

from app.core.config import settings
from app.models.document import Document
from app.models.notification import Notification
from app.models.quality_alert import QualityAlertEvent, QualityAlertRule
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User
from app.services.quality_alerts import EVENT_TYPE, _stop_refused, evaluate_rules
from app.workers.celery_app import celery_app
from app.workers.tasks import evaluate_quality_alerts

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


async def _owner_role(db_session, db_seed, role: str = "tenant_admin") -> None:
    """The seeded user is a collaborator, who gets no report (#188): the owner
    of a rule is an administrator unless a test says otherwise."""
    await db_session.execute(
        update(Role).where(Role.id == db_seed["role_id"]).values(code=role)
    )
    await db_session.commit()


async def _rule(
    db_session, db_seed, *, role="tenant_admin", **overrides
) -> QualityAlertRule:
    await _owner_role(db_session, db_seed, role)
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
    rule_id = str((await _rule(db_session, db_seed)).id)  # read before the rollback
    await db_session.execute(
        update(User).where(User.id == db_seed["user_id"]).values(is_active=False)
    )
    await db_session.commit()

    result = await evaluate_rules(db_session)
    assert (result.opened, result.refused) == ([], [rule_id])
    assert (
        await db_session.scalar(select(func.count()).select_from(QualityAlertEvent))
        == 0
    )
    assert await _alert_messages(db_session) == []


@pytest.mark.asyncio
async def test_a_refused_rule_stops_and_closes_its_open_event(db_session, db_seed):
    await _document(db_session, db_seed, classification_year=None)
    rule_id = (await _rule(db_session, db_seed)).id
    assert (await evaluate_rules(db_session)).opened == [str(rule_id)]
    await db_session.execute(
        update(User).where(User.id == db_seed["user_id"]).values(is_active=False)
    )
    await db_session.commit()

    assert (await evaluate_rules(db_session)).refused == [str(rule_id)]
    assert await _open_events(db_session, rule_id) == 0
    assert (await db_session.get(QualityAlertRule, rule_id)).is_active is False
    assert len(await _alert_messages(db_session)) == 1  # no end-of-alert message
    assert (await evaluate_rules(db_session)).refused == []  # stopped for good


@pytest.mark.asyncio
async def test_a_rule_deleted_before_its_stop_is_left_alone(db_session, caplog):
    with caplog.at_level(logging.ERROR):
        await _stop_refused(db_session, uuid.uuid4())
    assert "could not be stopped" not in caplog.text


async def _open_events(db_session, rule_id) -> int:
    return await db_session.scalar(
        select(func.count(QualityAlertEvent.id)).where(
            QualityAlertEvent.rule_id == rule_id,
            QualityAlertEvent.cleared_at.is_(None),
        )
    )


@pytest.mark.asyncio
async def test_a_stopped_rule_is_ignored(db_session, db_seed):
    await _document(db_session, db_seed, classification_year=None)
    await _rule(db_session, db_seed, is_active=False)
    result = await evaluate_rules(db_session)
    assert (result.opened, result.unchanged, result.refused) == ([], 0, [])


@pytest.mark.asyncio
async def test_create_list_and_stop_an_alert(
    admin_client, db_session, db_seed, monkeypatch
):
    monkeypatch.setattr(settings, "QUALITY_ALERTS_ENABLED", True)
    await _owner_role(db_session, db_seed)  # admin_client acts as the seeded user
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
    db_session.expire_all()
    assert await _open_events(db_session, uuid.UUID(body["id"])) == 0
    assert (await admin_client.get(ALERTS)).json() == []
    again = await admin_client.delete(f"{ALERTS}/{body['id']}")
    assert again.status_code == 204  # already stopped: no-op


@pytest.mark.asyncio
async def test_disabled_server_refuses_alerts_and_evaluates_nothing(
    admin_client, db_session, db_seed
):
    assert settings.QUALITY_ALERTS_ENABLED is False  # default
    assert "evaluate-quality-alerts" not in (celery_app.conf.beat_schedule or {})

    refused = await admin_client.post(
        ALERTS,
        json={"name": "x", "indicator": "no_text", "measure": "count", "threshold": 1},
    )
    assert refused.status_code == 409
    assert refused.json()["detail"] == (
        "Les alertes qualité sont désactivées sur ce serveur."
    )
    assert await db_session.scalar(select(func.count(QualityAlertRule.id))) == 0

    await _document(db_session, db_seed, classification_year=None)
    await _rule(db_session, db_seed)  # left from a time it was on
    assert evaluate_quality_alerts() is None
    assert await db_session.scalar(select(func.count(QualityAlertEvent.id))) == 0
    assert await db_session.scalar(select(func.count(Notification.id))) == 0


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"indicator": "no_text", "measure": "rate", "threshold": 120},
        {"indicator": "unknown", "measure": "count", "threshold": 1},
        {"indicator": "no_text", "measure": "count", "threshold": -1},
        {"indicator": "no_text", "measure": "count", "threshold": 0},
        {"indicator": "no_text", "measure": "rate", "threshold": 0},
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


async def _other_tenant(db_session) -> uuid.UUID:
    tenant_id = uuid.uuid4()
    db_session.add(
        Tenant(
            id=tenant_id,
            name="Autre institution",
            short_name="AUTRE",
            domain=f"autre-{tenant_id}.gov.cm",
            is_active=True,
        )
    )
    await db_session.commit()
    return tenant_id


@pytest.mark.asyncio
async def test_another_institution_neither_sees_nor_stops_it(
    client_as, db_session, db_seed
):
    rule_id = (await _rule(db_session, db_seed)).id
    other = await _other_tenant(db_session)
    async with client_as("tenant_admin", tenant_id=other) as client:
        listed = await client.get(ALERTS)
        stopped = await client.delete(f"{ALERTS}/{rule_id}")
    assert listed.status_code == 200 and listed.json() == []
    assert stopped.status_code == 404
    assert await db_session.scalar(
        select(QualityAlertRule.is_active).where(QualityAlertRule.id == rule_id)
    )


@pytest.mark.asyncio
async def test_a_rule_for_another_institution_is_refused(db_session, db_seed, caplog):
    await _document(db_session, db_seed, classification_year=None)
    other = await _other_tenant(db_session)
    rule_id = str((await _rule(db_session, db_seed, tenant_id=other)).id)
    caplog.set_level(logging.WARNING, logger="app.services.quality_alerts")

    result = await evaluate_rules(db_session)
    assert (result.opened, result.refused) == ([], [rule_id])
    assert "Institution de l'alerte invalide." in caplog.text
    assert await db_session.scalar(select(func.count(QualityAlertEvent.id))) == 0
    assert await _alert_messages(db_session) == []
