"""Scheduled official reports (post-rc1 lot 9).

Each active schedule gets one official report per closed period: the previous ISO
week (``2026-W46``) or the previous month (``2026-10``). A pass inserts the run line
first with ON CONFLICT DO NOTHING on (schedule_id, period_key): a second pass, or a
second worker, over the same period writes nothing. The report is issued in the
name and scope of the schedule's creator, who gets an in-app notification in the
same transaction. A refusal (rights lost, no short name) is recorded as a failed run
and notified once; an unexpected error rolls everything back, so the next pass
tries again.
"""

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.authz import can_perform
from app.models.notification import Notification
from app.models.report_schedule import ReportRun, ReportSchedule
from app.models.user import User
from app.schemas.official_report import OfficialReportRequest
from app.services.official_report import (
    LOCAL_TZ,
    OfficialReportError,
    issue_official_report,
)
from app.services.reports_scope import resolve_report_scope

logger = logging.getLogger(__name__)

FREQUENCIES = ("weekly", "monthly")
EVENT_TYPE = "REPORT_SCHEDULED"


@dataclass(frozen=True)
class Period:
    key: str
    date_from: date
    date_to: date


@dataclass
class PassResult:
    issued: list[str] = field(default_factory=list)
    failed: list[str] = field(default_factory=list)
    skipped: int = 0


def closed_period(frequency: str, today: date) -> Period:
    """The last full week (Monday to Sunday) or month before ``today``."""
    if frequency == "weekly":
        this_monday = today - timedelta(days=today.weekday())
        start = this_monday - timedelta(days=7)
        iso = start.isocalendar()
        return Period(
            f"{iso.year}-W{iso.week:02d}", start, this_monday - timedelta(days=1)
        )
    if frequency == "monthly":
        end = today.replace(day=1) - timedelta(days=1)
        start = end.replace(day=1)
        return Period(f"{start:%Y-%m}", start, end)
    raise ValueError(f"Unknown frequency: {frequency}")


def report_request(schedule: ReportSchedule, period: Period) -> OfficialReportRequest:
    payload = dict(schedule.request or {})
    payload.pop("date_from", None)
    payload.pop("date_to", None)
    if payload.get("kind") == "evolution":
        payload.update(date_from=period.date_from, date_to=period.date_to)
    return OfficialReportRequest.model_validate(payload)


async def _claim(db: AsyncSession, schedule: ReportSchedule, period: Period):
    """Insert the run line; None when this period already has one."""
    statement = (
        pg_insert(ReportRun)
        .values(schedule_id=schedule.id, period_key=period.key, status="pending")
        .on_conflict_do_nothing(constraint="uq_report_runs_schedule_period")
        .returning(ReportRun.id)
    )
    run_id = (await db.execute(statement)).scalar_one_or_none()
    return None if run_id is None else await db.get(ReportRun, run_id)


async def _creator(db: AsyncSession, schedule: ReportSchedule) -> Optional[User]:
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == schedule.created_by, User.is_active)
    )
    return result.scalar_one_or_none()


def _refusal(error: Exception) -> str:
    if isinstance(error, HTTPException):
        detail = error.detail
        return detail if isinstance(detail, str) else "Accès refusé."
    return str(error) or error.__class__.__name__


async def _issue(db: AsyncSession, schedule: ReportSchedule, period: Period, run):
    creator = await _creator(db, schedule)
    if creator is None:
        run.status, run.error = "failed", "Créateur du rapport programmé inactif."
        return None, None
    try:
        async with db.begin_nested():
            if not await can_perform(creator, "analytics.tenant", "read"):
                raise OfficialReportError("Droits insuffisants pour ce rapport.")
            request = report_request(schedule, period)
            scope = await resolve_report_scope(
                creator,
                tenant_id=request.tenant_id,
                org_unit_id=request.org_unit_id,
                recursive=request.recursive,
            )
            if scope.tenant_id != schedule.tenant_id:
                raise OfficialReportError("Institution du rapport invalide.")
            issued = await issue_official_report(
                db, creator, request, scope, commit=False
            )
    except (HTTPException, OfficialReportError, LookupError, ValueError) as error:
        run.status, run.error = "failed", _refusal(error)[:300]
        return creator, None
    run.status, run.report_issue_id = "issued", issued.issue.id
    return creator, issued.issue


def _notify(schedule, period, run, creator, issue) -> Notification:
    if issue is not None:
        message = (
            f"Rapport programmé « {schedule.name} » ({period.key}) : {issue.number}."
        )
    else:
        message = f"Rapport programmé « {schedule.name} » ({period.key}) non émis : {run.error}"
    return Notification(
        user_id=creator.id if creator else schedule.created_by,
        tenant_id=schedule.tenant_id,
        event_type=EVENT_TYPE,
        message=message[:500],
        channel="in_app",
        meta_data={
            "schedule_id": str(schedule.id),
            "period_key": period.key,
            "report_issue_id": str(issue.id) if issue is not None else None,
        },
    )


async def run_due_schedules(
    db: AsyncSession, now: Optional[datetime] = None
) -> PassResult:
    """One pass over every active schedule; one commit per schedule."""
    today = (now or datetime.now(LOCAL_TZ)).astimezone(LOCAL_TZ).date()
    result = PassResult()
    schedule_ids = (
        (
            await db.execute(
                select(ReportSchedule.id).where(ReportSchedule.is_active.is_(True))
            )
        )
        .scalars()
        .all()
    )
    for schedule_id in schedule_ids:
        try:
            schedule = await db.get(ReportSchedule, schedule_id)
            period = closed_period(schedule.frequency, today)
            run = await _claim(db, schedule, period)
            if run is None:
                result.skipped += 1
                await db.rollback()
                continue
            creator, issue = await _issue(db, schedule, period, run)
            db.add(_notify(schedule, period, run, creator, issue))
            issued = issue is not None
            await db.commit()
        except Exception:  # noqa: BLE001 - one bad schedule must not stop the others
            await db.rollback()
            logger.exception("[ScheduledReports] schedule %s failed", schedule_id)
            continue
        (result.issued if issued else result.failed).append(str(schedule_id))
    return result
