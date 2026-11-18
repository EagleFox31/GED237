"""Weekly trends for the dashboards (documents filed, visas given).

Weeks run Monday to Sunday in Douala time. ``documents.created_at`` is a naive UTC
timestamp, ``workflow_actions.performed_at`` is timezone-aware: both are converted to
Douala local time before being bucketed. Empty weeks are returned as 0, so every
series has exactly ``weeks`` points aligned with the ``weeks`` list.
"""

from datetime import date, datetime, timedelta
from typing import Any, Dict, List
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import and_, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.workflow import OutcomeType, WorkflowAction, WorkflowStep

TIMEZONE = "Africa/Douala"
ACCEPTED = (OutcomeType.accepted, OutcomeType.acknowledged)
REJECTED_OR_RETURNED = (OutcomeType.rejected, OutcomeType.returned)


def week_starts(weeks: int, today: date | None = None) -> List[date]:
    """Mondays of the last ``weeks`` weeks, oldest first, current week last."""
    if today is None:
        today = datetime.now(ZoneInfo(TIMEZONE)).date()
    current_monday = today - timedelta(days=today.weekday())
    return [current_monday - timedelta(weeks=n) for n in range(weeks - 1, -1, -1)]


def _scope_filters(scope: str, tenant_id: UUID, user_id: UUID, org_unit_id):
    filters = [Document.tenant_id == tenant_id, Document.deleted_at.is_(None)]
    if scope == "unit":
        filters.append(Document.org_unit_id == org_unit_id)
    elif scope == "mine":
        filters.append(Document.owner_id == user_id)
    return filters


def _fill(rows, mondays: List[date]) -> List[int]:
    counts = {row.week: row.total for row in rows}
    return [int(counts.get(monday, 0)) for monday in mondays]


async def compute_trends(
    db: AsyncSession,
    *,
    scope: str,
    weeks: int,
    tenant_id: UUID,
    user_id: UUID,
    org_unit_id: UUID | None,
    today: date | None = None,
) -> Dict[str, Any]:
    mondays = week_starts(weeks, today)
    start = datetime.combine(mondays[0], datetime.min.time())
    filters = _scope_filters(scope, tenant_id, user_id, org_unit_id)
    tz = literal(TIMEZONE)

    created_local = func.timezone(
        tz, func.timezone(literal("UTC"), Document.created_at)
    )
    created_week = func.date(func.date_trunc("week", created_local))
    created_rows = await db.execute(
        select(created_week.label("week"), func.count().label("total"))
        .where(*filters, created_local >= start)
        .group_by(created_week)
    )

    performed_local = func.timezone(tz, WorkflowAction.performed_at)
    performed_week = func.date(func.date_trunc("week", performed_local))

    async def visas(outcomes) -> List[int]:
        rows = await db.execute(
            select(performed_week.label("week"), func.count().label("total"))
            .select_from(WorkflowAction)
            .join(WorkflowStep, WorkflowStep.id == WorkflowAction.workflow_step_id)
            .join(Document, Document.id == WorkflowStep.document_id)
            .where(
                and_(*filters),
                WorkflowAction.outcome.in_(outcomes),
                performed_local >= start,
            )
            .group_by(performed_week)
        )
        return _fill(rows, mondays)

    result: Dict[str, Any] = {
        "scope": scope,
        "timezone": TIMEZONE,
        "weeks": [monday.isoformat() for monday in mondays],
        "series": {
            "documents_created": _fill(created_rows, mondays),
            "visas_accepted": await visas(ACCEPTED),
            "visas_rejected_or_returned": await visas(REJECTED_OR_RETURNED),
        },
    }
    if scope == "mine":
        counts = await db.execute(
            select(Document.status, func.count())
            .where(*filters, Document.status.in_(("draft", "in_review")))
            .group_by(Document.status)
        )
        by_status = {status: total for status, total in counts.all()}
        result["now"] = {
            "drafts": int(by_status.get("draft", 0)),
            "awaiting_visa": int(by_status.get("in_review", 0)),
        }
    return result
