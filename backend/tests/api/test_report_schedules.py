"""Scheduled official reports: closed periods, one copy per period, failures
recorded once, and the /reports/official/schedules routes."""

import uuid
from datetime import date, datetime

import pytest
from sqlalchemy import func, select, update

from app.core.config import settings
from app.models.notification import Notification
from app.models.report_issue import ReportIssue
from app.models.report_schedule import ReportRun, ReportSchedule
from app.models.tenant import Tenant
from app.models.user import User
from app.services.official_report import LOCAL_TZ
from app.services.scheduled_reports import closed_period, run_due_schedules
from app.workers.celery_app import celery_app
from app.workers.tasks import run_scheduled_reports

SCHEDULES = "/api/v1/reports/official/schedules"
NOW = datetime(2026, 11, 17, 8, 0, tzinfo=LOCAL_TZ)


@pytest.mark.parametrize(
    ("frequency", "today", "key", "start", "end"),
    [
        (
            "weekly",
            date(2026, 11, 16),
            "2026-W46",
            date(2026, 11, 9),
            date(2026, 11, 15),
        ),
        (
            "weekly",
            date(2026, 11, 22),
            "2026-W46",
            date(2026, 11, 9),
            date(2026, 11, 15),
        ),
        ("weekly", date(2027, 1, 4), "2026-W53", date(2026, 12, 28), date(2027, 1, 3)),
        (
            "monthly",
            date(2026, 11, 17),
            "2026-10",
            date(2026, 10, 1),
            date(2026, 10, 31),
        ),
        ("monthly", date(2027, 1, 5), "2026-12", date(2026, 12, 1), date(2026, 12, 31)),
    ],
)
def test_closed_period(frequency, today, key, start, end):
    period = closed_period(frequency, today)
    assert (period.key, period.date_from, period.date_to) == (key, start, end)


async def _schedule(db_session, db_seed, *, kind="evolution", active=True):
    schedule = ReportSchedule(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        created_by=db_seed["user_id"],
        name="Bilan mensuel",
        frequency="monthly",
        request={"kind": kind, "format": "csv"},
        is_active=active,
    )
    db_session.add(schedule)
    await db_session.commit()
    return schedule


async def _count(db_session, model, *where) -> int:
    return await db_session.scalar(
        select(func.count()).select_from(model).where(*where)
    )


@pytest.mark.asyncio
async def test_one_copy_per_closed_period_and_a_second_pass_writes_nothing(
    db_session, db_seed
):
    schedule = await _schedule(db_session, db_seed)

    first = await run_due_schedules(db_session, now=NOW)
    assert (len(first.issued), len(first.failed), first.skipped) == (1, 0, 0)

    issue = (
        await db_session.execute(
            select(ReportIssue).where(ReportIssue.tenant_id == db_seed["tenant_id"])
        )
    ).scalar_one()
    assert issue.issued_by == db_seed["user_id"]
    assert (issue.filters["date_from"], issue.filters["date_to"]) == (
        "2026-10-01",
        "2026-10-31",
    )
    run = (
        await db_session.execute(
            select(ReportRun).where(ReportRun.schedule_id == schedule.id)
        )
    ).scalar_one()
    assert (run.period_key, run.status, run.report_issue_id) == (
        "2026-10",
        "issued",
        issue.id,
    )
    notification = (
        await db_session.execute(
            select(Notification).where(Notification.user_id == db_seed["user_id"])
        )
    ).scalar_one()
    assert notification.event_type == "REPORT_SCHEDULED"
    assert issue.number in notification.message

    second = await run_due_schedules(db_session, now=NOW)
    assert (len(second.issued), len(second.failed), second.skipped) == (0, 0, 1)
    assert await _count(db_session, ReportIssue) == 1
    assert await _count(db_session, Notification) == 1


@pytest.mark.asyncio
async def test_a_refusal_is_recorded_and_notified_once(db_session, db_seed):
    await _schedule(db_session, db_seed, kind="document-activity")
    await db_session.execute(
        update(Tenant).where(Tenant.id == db_seed["tenant_id"]).values(short_name="")
    )
    await db_session.commit()

    first = await run_due_schedules(db_session, now=NOW)
    assert (len(first.issued), len(first.failed)) == (0, 1)
    run = (await db_session.execute(select(ReportRun))).scalar_one()
    assert run.status == "failed" and run.report_issue_id is None
    assert "sigle" in run.error
    assert await _count(db_session, ReportIssue) == 0

    second = await run_due_schedules(db_session, now=NOW)
    assert second.skipped == 1
    assert await _count(db_session, Notification) == 1


@pytest.mark.asyncio
async def test_an_inactive_creator_gets_no_copy(db_session, db_seed):
    await _schedule(db_session, db_seed, kind="document-activity")
    await db_session.execute(
        update(User).where(User.id == db_seed["user_id"]).values(is_active=False)
    )
    await db_session.commit()

    result = await run_due_schedules(db_session, now=NOW)
    assert len(result.failed) == 1
    assert await _count(db_session, ReportIssue) == 0


@pytest.mark.asyncio
async def test_a_stopped_schedule_is_ignored(db_session, db_seed):
    await _schedule(db_session, db_seed, active=False)
    result = await run_due_schedules(db_session, now=NOW)
    assert (result.issued, result.failed, result.skipped) == ([], [], 0)
    assert await _count(db_session, ReportRun) == 0


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setattr(settings, "SCHEDULED_REPORTS_ENABLED", True)


@pytest.mark.asyncio
async def test_disabled_server_refuses_schedules_and_runs_nothing(
    admin_client, db_session, db_seed
):
    assert settings.SCHEDULED_REPORTS_ENABLED is False  # default
    assert "run-scheduled-reports" not in (celery_app.conf.beat_schedule or {})

    refused = await admin_client.post(
        SCHEDULES,
        json={"name": "x", "frequency": "weekly", "report": {"kind": "evolution"}},
    )
    assert refused.status_code == 409
    assert refused.json()["detail"] == (
        "Les rapports programmés sont désactivés sur ce serveur."
    )
    assert await _count(db_session, ReportSchedule) == 0

    await _schedule(db_session, db_seed)  # left from a time it was on
    assert run_scheduled_reports() is None
    assert await _count(db_session, ReportRun) == 0
    assert await _count(db_session, ReportIssue) == 0


@pytest.mark.asyncio
async def test_create_list_and_stop_a_schedule(admin_client, db_session, enabled):
    created = await admin_client.post(
        SCHEDULES,
        json={
            "name": "Activité hebdomadaire",
            "frequency": "weekly",
            "report": {"kind": "evolution", "date_from": "2026-01-01"},
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["request"]["kind"] == "evolution"
    assert "date_from" not in body["request"]

    listed = await admin_client.get(SCHEDULES)
    assert [item["id"] for item in listed.json()] == [body["id"]]

    stopped = await admin_client.delete(f"{SCHEDULES}/{body['id']}")
    assert stopped.status_code == 204
    assert (await admin_client.get(SCHEDULES)).json() == []
    again = await admin_client.delete(f"{SCHEDULES}/{body['id']}")
    assert again.status_code == 204  # already stopped: no-op


@pytest.mark.asyncio
async def test_unknown_frequency_or_foreign_schedule(client_as, db_session, db_seed):
    schedule = await _schedule(db_session, db_seed)
    async with client_as("tenant_admin", tenant_id=db_seed["tenant_id"]) as client:
        bad = await client.post(
            SCHEDULES,
            json={"name": "x", "frequency": "daily", "report": {"kind": "evolution"}},
        )
        foreign = await client.delete(f"{SCHEDULES}/{schedule.id}")
    assert bad.status_code == 422
    assert foreign.status_code == 404


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
    schedule = await _schedule(db_session, db_seed)
    other = await _other_tenant(db_session)
    async with client_as("tenant_admin", tenant_id=other) as client:
        listed = await client.get(SCHEDULES)
        stopped = await client.delete(f"{SCHEDULES}/{schedule.id}")
    assert listed.status_code == 200 and listed.json() == []
    assert stopped.status_code == 404
    await db_session.refresh(schedule)
    assert schedule.is_active is True


@pytest.mark.asyncio
async def test_a_schedule_for_another_institution_is_refused(db_session, db_seed):
    other = await _other_tenant(db_session)
    schedule = await _schedule(db_session, db_seed)
    await db_session.execute(
        update(ReportSchedule)
        .where(ReportSchedule.id == schedule.id)
        .values(tenant_id=other)
    )
    await db_session.commit()

    result = await run_due_schedules(db_session, now=NOW)
    assert (len(result.issued), len(result.failed)) == (0, 1)
    run = (await db_session.execute(select(ReportRun))).scalar_one()
    assert (run.status, run.error) == ("failed", "Institution du rapport invalide.")
    assert await _count(db_session, ReportIssue) == 0
