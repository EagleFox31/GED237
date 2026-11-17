"""Documentary quality indicators (post-rc1 lot 8)."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import authorize_or_403
from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.quality_alert import QualityAlertEvent, QualityAlertRule
from app.models.user import User
from app.schemas.quality import (
    QualityAlertCreate,
    QualityAlertOut,
    QualityDocument,
    QualityIndicatorKey,
    QualitySummary,
)
from app.services.document_quality import (
    documents_for_indicator,
    quality_summary,
    scope_filters,
)
from app.services.reports_scope import resolve_report_scope

router = APIRouter()


@router.get("", response_model=QualitySummary)
async def get_quality_summary(
    org_unit_id: Optional[UUID] = Query(None),
    recursive: bool = Query(False),
    domain_id: Optional[UUID] = Query(None),
    activity_id: Optional[UUID] = Query(None),
    document_category_id: Optional[UUID] = Query(None),
    tenant_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Counts per indicator; same right and scope as the report screens."""
    await authorize_or_403(current_user, "analytics.tenant", "read")
    scope = await resolve_report_scope(
        current_user, tenant_id=tenant_id, org_unit_id=org_unit_id, recursive=recursive
    )
    filters = scope_filters(
        scope,
        domain_id=domain_id,
        activity_id=activity_id,
        document_category_id=document_category_id,
    )
    return await quality_summary(db, filters)


@router.get("/documents", response_model=list[QualityDocument])
async def list_quality_documents(
    response: Response,
    indicator: QualityIndicatorKey = Query(...),
    org_unit_id: Optional[UUID] = Query(None),
    recursive: bool = Query(False),
    domain_id: Optional[UUID] = Query(None),
    activity_id: Optional[UUID] = Query(None),
    document_category_id: Optional[UUID] = Query(None),
    tenant_id: Optional[UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Documents raising one indicator, newest first; ``X-Total-Count`` = total.

    Lists titles, so it also needs ``documents read`` (a collaborator, who only
    reads their own documents, gets the counts but not this list).
    """
    await authorize_or_403(current_user, "analytics.tenant", "read")
    await authorize_or_403(current_user, "documents", "read")
    scope = await resolve_report_scope(
        current_user, tenant_id=tenant_id, org_unit_id=org_unit_id, recursive=recursive
    )
    filters = scope_filters(
        scope,
        domain_id=domain_id,
        activity_id=activity_id,
        document_category_id=document_category_id,
    )
    total, documents = await documents_for_indicator(
        db, filters, indicator, skip=skip, limit=limit
    )
    response.headers["X-Total-Count"] = str(total)
    return documents


def _alert_out(rule: QualityAlertRule, alerting_since) -> QualityAlertOut:
    out = QualityAlertOut.model_validate(rule)
    out.alerting_since = alerting_since
    return out


@router.get("/alerts", response_model=list[QualityAlertOut])
async def list_quality_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The caller's active alert rules, with the start of the current breach."""
    await authorize_or_403(current_user, "analytics.tenant", "read")
    rows = await db.execute(
        select(QualityAlertRule, QualityAlertEvent.opened_at)
        .outerjoin(
            QualityAlertEvent,
            and_(
                QualityAlertEvent.rule_id == QualityAlertRule.id,
                QualityAlertEvent.cleared_at.is_(None),
            ),
        )
        .where(
            QualityAlertRule.created_by == current_user.id,
            QualityAlertRule.is_active.is_(True),
        )
        .order_by(QualityAlertRule.created_at)
    )
    return [_alert_out(rule, opened_at) for rule, opened_at in rows.all()]


@router.post("/alerts", response_model=QualityAlertOut, status_code=201)
async def create_quality_alert(
    payload: QualityAlertCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Watch one indicator in the caller's scope (403 if refused, checked again
    at each pass); 409 while the alerts are switched off on this server."""
    await authorize_or_403(current_user, "analytics.tenant", "read")
    if not settings.QUALITY_ALERTS_ENABLED:
        raise HTTPException(
            status_code=409,
            detail="Les alertes qualité sont désactivées sur ce serveur.",
        )
    scope = await resolve_report_scope(
        current_user,
        tenant_id=payload.tenant_id,
        org_unit_id=payload.scope.org_unit_id,
        recursive=payload.scope.recursive,
    )
    rule = QualityAlertRule(
        tenant_id=scope.tenant_id,
        created_by=current_user.id,
        name=payload.name.strip(),
        indicator=payload.indicator,
        measure=payload.measure,
        threshold=payload.threshold,
        scope=payload.scope.model_dump(mode="json"),
        is_active=True,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return _alert_out(rule, None)


@router.delete("/alerts/{rule_id}", status_code=204)
async def stop_quality_alert(
    rule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stop an alert rule of the caller; idempotent."""
    await authorize_or_403(current_user, "analytics.tenant", "read")
    rule = await db.get(QualityAlertRule, rule_id)
    if rule is None or rule.created_by != current_user.id:
        raise HTTPException(status_code=404, detail="Alerte introuvable.")
    if rule.is_active:
        rule.is_active = False
        await db.commit()
    return Response(status_code=204)
