"""Alerts on the documentary quality indicators (post-rc1 lot 9, second part).

A rule watches one indicator of ``document_quality`` (a count of documents, or a
rate in percent) in the scope of its creator, who is checked at each pass like for
the report screens. When the value reaches the threshold an event opens and the
creator gets one in-app notification; when it falls back below, the event closes
and they get one more. The partial unique index (one open event per rule) makes a
second pass, or a second worker, write nothing.
A rule whose creator is inactive or no longer has the rights or the scope stops
for good, and so does a rule its creator stops: its open event closes without a
notification.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.authz import can_perform
from app.models.notification import Notification
from app.models.quality_alert import QualityAlertEvent, QualityAlertRule
from app.models.user import User
from app.services.document_quality import INDICATORS, quality_summary, scope_filters
from app.services.reports_scope import resolve_report_scope

logger = logging.getLogger(__name__)

EVENT_TYPE = "QUALITY_ALERT"
MEASURES = ("count", "rate")
SCOPE_KEYS = (
    "org_unit_id",
    "recursive",
    "domain_id",
    "activity_id",
    "document_category_id",
)
_LABELS = {indicator.key: indicator.label for indicator in INDICATORS}


class AlertRefused(Exception):
    """The rule cannot be evaluated any more (creator inactive, rights lost)."""


@dataclass
class AlertPass:
    opened: list[str] = field(default_factory=list)
    cleared: list[str] = field(default_factory=list)
    unchanged: int = 0
    refused: list[str] = field(default_factory=list)


def _uuid(value) -> Optional[UUID]:
    return UUID(str(value)) if value else None


def indicator_value(summary: dict, indicator: str, measure: str) -> Optional[float]:
    """Count or rate of one indicator; None when the scope has no document."""
    for item in summary["indicators"]:
        if item["key"] == indicator:
            return float(item["count"]) if measure == "count" else item["rate"]
    raise ValueError(f"Unknown indicator: {indicator}")


def describe(rule: QualityAlertRule, value: Optional[float]) -> str:
    unit = " %" if rule.measure == "rate" else " document(s)"
    shown = "—" if value is None else f"{value:g}{unit}"
    return (
        f"« {_LABELS.get(rule.indicator, rule.indicator)} » : {shown} "
        f"(seuil {rule.threshold:g}{unit})"
    )


async def measure_rule(db: AsyncSession, rule: QualityAlertRule) -> Optional[float]:
    """The indicator value in the creator's scope, checked now."""
    creator = (
        await db.execute(
            select(User)
            .options(selectinload(User.role))
            .where(User.id == rule.created_by, User.is_active)
        )
    ).scalar_one_or_none()
    if creator is None:
        raise AlertRefused("Créateur de l'alerte inactif.")
    if not await can_perform(creator, "analytics.tenant", "read"):
        raise AlertRefused("Droits insuffisants pour cette alerte.")
    scope_data = rule.scope or {}
    try:
        scope = await resolve_report_scope(
            creator,
            tenant_id=rule.tenant_id,
            org_unit_id=_uuid(scope_data.get("org_unit_id")),
            recursive=bool(scope_data.get("recursive")),
        )
    except HTTPException as error:
        raise AlertRefused(str(error.detail)) from error
    if scope.tenant_id != rule.tenant_id:
        raise AlertRefused("Institution de l'alerte invalide.")
    filters = scope_filters(
        scope,
        domain_id=_uuid(scope_data.get("domain_id")),
        activity_id=_uuid(scope_data.get("activity_id")),
        document_category_id=_uuid(scope_data.get("document_category_id")),
    )
    summary = await quality_summary(db, filters)
    return indicator_value(summary, rule.indicator, rule.measure)


def _notify(rule: QualityAlertRule, message: str, value: Optional[float]):
    return Notification(
        user_id=rule.created_by,
        tenant_id=rule.tenant_id,
        event_type=EVENT_TYPE,
        message=message[:500],
        channel="in_app",
        meta_data={
            "rule_id": str(rule.id),
            "indicator": rule.indicator,
            "measure": rule.measure,
            "value": value,
            "threshold": rule.threshold,
        },
    )


async def _open(db: AsyncSession, rule: QualityAlertRule, value: float) -> bool:
    statement = (
        pg_insert(QualityAlertEvent)
        .values(rule_id=rule.id, value=value)
        .on_conflict_do_nothing(
            index_elements=["rule_id"],
            index_where=QualityAlertEvent.cleared_at.is_(None),
        )
        .returning(QualityAlertEvent.id)
    )
    if (await db.execute(statement)).scalar_one_or_none() is None:
        return False  # another pass opened it first
    db.add(
        _notify(rule, f"Alerte qualité « {rule.name} » {describe(rule, value)}.", value)
    )
    return True


async def _clear(db: AsyncSession, rule: QualityAlertRule, value) -> bool:
    statement = (
        update(QualityAlertEvent)
        .where(
            QualityAlertEvent.rule_id == rule.id,
            QualityAlertEvent.cleared_at.is_(None),
        )
        .values(cleared_at=func.now())
        .returning(QualityAlertEvent.id)
    )
    if (await db.execute(statement)).scalar_one_or_none() is None:
        return False
    db.add(
        _notify(
            rule,
            f"Fin d'alerte qualité « {rule.name} » {describe(rule, value)}.",
            value,
        )
    )
    return True


async def stop_rule(db: AsyncSession, rule: QualityAlertRule) -> None:
    """Deactivate a rule and close its open event, without notification."""
    rule.is_active = False
    await db.execute(
        update(QualityAlertEvent)
        .where(
            QualityAlertEvent.rule_id == rule.id,
            QualityAlertEvent.cleared_at.is_(None),
        )
        .values(cleared_at=func.now())
    )


async def _stop_refused(db: AsyncSession, rule_id) -> None:
    """A refused rule (creator inactive, rights or scope lost) stops for good."""
    try:
        await stop_rule(db, await db.get(QualityAlertRule, rule_id))
        await db.commit()
    except Exception:  # noqa: BLE001 - retried at the next pass
        await db.rollback()
        logger.exception("[QualityAlerts] rule %s could not be stopped", rule_id)


async def evaluate_rules(db: AsyncSession) -> AlertPass:
    """One pass over every active rule; one commit per rule."""
    result = AlertPass()
    rule_ids = (
        (
            await db.execute(
                select(QualityAlertRule.id).where(QualityAlertRule.is_active.is_(True))
            )
        )
        .scalars()
        .all()
    )
    for rule_id in rule_ids:
        try:
            rule = await db.get(QualityAlertRule, rule_id)
            value = await measure_rule(db, rule)
            if value is not None and value >= rule.threshold:
                changed, bucket = await _open(db, rule, value), result.opened
            else:
                changed, bucket = await _clear(db, rule, value), result.cleared
            await db.commit()
        except AlertRefused as refusal:
            await db.rollback()
            logger.warning("[QualityAlerts] rule %s stopped: %s", rule_id, refusal)
            result.refused.append(str(rule_id))
            await _stop_refused(db, rule_id)
            continue
        except Exception:  # noqa: BLE001 - one bad rule must not stop the others
            await db.rollback()
            logger.exception("[QualityAlerts] rule %s failed", rule_id)
            continue
        if changed:
            bucket.append(str(rule_id))
        else:
            result.unchanged += 1
    return result
