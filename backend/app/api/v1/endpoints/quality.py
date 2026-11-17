"""Documentary quality indicators (post-rc1 lot 8)."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import authorize_or_403
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.quality import QualityDocument, QualityIndicatorKey, QualitySummary
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

    Lists titles, so it also needs ``documents read``. A collaborator gets neither
    the counts nor this list: reports are closed to that role (#188).
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
