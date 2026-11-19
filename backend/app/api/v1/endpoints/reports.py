from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import authorize_or_403
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.reports import (
    ReportsDocumentActivityResponse,
    ReportsEvolutionResponse,
    ReportsGranularity,
    ReportsServiceActivityResponse,
    ReportsWorkflowActivityResponse,
)
from app.services.reports_scope import resolve_report_scope
from app.services.reports_service import ReportsService

router = APIRouter()


@router.get("/evolution", response_model=ReportsEvolutionResponse)
async def get_reports_evolution(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    granularity: ReportsGranularity = Query("day"),
    org_unit_id: Optional[UUID] = Query(None),
    recursive: bool = Query(False),
    domain_id: Optional[UUID] = Query(None),
    activity_id: Optional[UUID] = Query(None),
    document_category_id: Optional[UUID] = Query(None),
    tenant_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "analytics.tenant", "read")
    scope = await resolve_report_scope(
        current_user,
        db,
        tenant_id=tenant_id,
        org_unit_id=org_unit_id,
        recursive=recursive,
    )

    service = ReportsService(db)
    try:
        return await service.get_evolution(
            tenant_id=scope.tenant_id,
            date_from=date_from,
            date_to=date_to,
            granularity=granularity,
            org_unit_id=scope.org_unit_id,
            recursive=scope.recursive,
            domain_id=domain_id,
            activity_id=activity_id,
            document_category_id=document_category_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/document-activity", response_model=ReportsDocumentActivityResponse)
async def get_reports_document_activity(
    org_unit_id: Optional[UUID] = Query(None),
    recursive: bool = Query(False),
    domain_id: Optional[UUID] = Query(None),
    activity_id: Optional[UUID] = Query(None),
    document_category_id: Optional[UUID] = Query(None),
    tenant_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "analytics.tenant", "read")
    scope = await resolve_report_scope(
        current_user,
        db,
        tenant_id=tenant_id,
        org_unit_id=org_unit_id,
        recursive=recursive,
    )

    service = ReportsService(db)
    return await service.get_document_activity(
        tenant_id=scope.tenant_id,
        org_unit_id=scope.org_unit_id,
        recursive=scope.recursive,
        domain_id=domain_id,
        activity_id=activity_id,
        document_category_id=document_category_id,
    )


@router.get("/workflow-activity", response_model=ReportsWorkflowActivityResponse)
async def get_reports_workflow_activity(
    org_unit_id: Optional[UUID] = Query(None),
    recursive: bool = Query(False),
    domain_id: Optional[UUID] = Query(None),
    activity_id: Optional[UUID] = Query(None),
    document_category_id: Optional[UUID] = Query(None),
    tenant_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "analytics.tenant", "read")
    scope = await resolve_report_scope(
        current_user,
        db,
        tenant_id=tenant_id,
        org_unit_id=org_unit_id,
        recursive=recursive,
    )

    service = ReportsService(db)
    return await service.get_workflow_activity(
        tenant_id=scope.tenant_id,
        org_unit_id=scope.org_unit_id,
        recursive=scope.recursive,
        domain_id=domain_id,
        activity_id=activity_id,
        document_category_id=document_category_id,
    )


@router.get("/service-activity", response_model=ReportsServiceActivityResponse)
async def get_reports_service_activity(
    org_unit_id: Optional[UUID] = Query(None),
    recursive: bool = Query(False),
    domain_id: Optional[UUID] = Query(None),
    activity_id: Optional[UUID] = Query(None),
    document_category_id: Optional[UUID] = Query(None),
    tenant_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "analytics.tenant", "read")
    scope = await resolve_report_scope(
        current_user,
        db,
        tenant_id=tenant_id,
        org_unit_id=org_unit_id,
        recursive=recursive,
    )

    service = ReportsService(db)
    return await service.get_service_activity(
        tenant_id=scope.tenant_id,
        org_unit_id=scope.org_unit_id,
        recursive=scope.recursive,
        domain_id=domain_id,
        activity_id=activity_id,
        document_category_id=document_category_id,
    )
