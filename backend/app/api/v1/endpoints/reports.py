from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import authorize_or_403, can_perform
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.tenant_guard import assert_org_unit_scope
from app.models.user import User
from app.schemas.reports import (
    ReportsDocumentActivityResponse,
    ReportsEvolutionResponse,
    ReportsGranularity,
    ReportsServiceActivityResponse,
    ReportsWorkflowActivityResponse,
)
from app.services.reports_service import ReportsService

router = APIRouter()


def _role_code(user: User) -> str:
    return (getattr(getattr(user, "role", None), "code", "") or "").lower()


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

    is_super = await can_perform(current_user, "tenants", "manage")
    effective_tenant = tenant_id if (is_super and tenant_id) else current_user.tenant_id
    effective_org_unit_id = org_unit_id
    effective_recursive = recursive

    if not is_super and _role_code(current_user) in {"manager", "reader"}:
        if current_user.org_unit_id is None:
            raise HTTPException(
                status_code=403, detail="Portée organisationnelle invalide."
            )
        if org_unit_id is not None:
            assert_org_unit_scope(org_unit_id, current_user)
        effective_org_unit_id = current_user.org_unit_id
        if org_unit_id is None:
            effective_recursive = True

    service = ReportsService(db)
    try:
        return await service.get_evolution(
            tenant_id=effective_tenant,
            date_from=date_from,
            date_to=date_to,
            granularity=granularity,
            org_unit_id=effective_org_unit_id,
            recursive=effective_recursive,
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

    is_super = await can_perform(current_user, "tenants", "manage")
    effective_tenant = tenant_id if (is_super and tenant_id) else current_user.tenant_id
    effective_org_unit_id = org_unit_id
    effective_recursive = recursive

    if not is_super and _role_code(current_user) in {"manager", "reader"}:
        if current_user.org_unit_id is None:
            raise HTTPException(
                status_code=403, detail="Portée organisationnelle invalide."
            )
        if org_unit_id is not None:
            assert_org_unit_scope(org_unit_id, current_user)
        effective_org_unit_id = current_user.org_unit_id
        if org_unit_id is None:
            effective_recursive = True

    service = ReportsService(db)
    return await service.get_document_activity(
        tenant_id=effective_tenant,
        org_unit_id=effective_org_unit_id,
        recursive=effective_recursive,
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

    is_super = await can_perform(current_user, "tenants", "manage")
    effective_tenant = tenant_id if (is_super and tenant_id) else current_user.tenant_id
    effective_org_unit_id = org_unit_id
    effective_recursive = recursive

    if not is_super and _role_code(current_user) in {"manager", "reader"}:
        if current_user.org_unit_id is None:
            raise HTTPException(
                status_code=403, detail="Portée organisationnelle invalide."
            )
        if org_unit_id is not None:
            assert_org_unit_scope(org_unit_id, current_user)
        effective_org_unit_id = current_user.org_unit_id
        if org_unit_id is None:
            effective_recursive = True

    service = ReportsService(db)
    return await service.get_workflow_activity(
        tenant_id=effective_tenant,
        org_unit_id=effective_org_unit_id,
        recursive=effective_recursive,
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

    is_super = await can_perform(current_user, "tenants", "manage")
    effective_tenant = tenant_id if (is_super and tenant_id) else current_user.tenant_id
    effective_org_unit_id = org_unit_id
    effective_recursive = recursive

    if not is_super and _role_code(current_user) in {"manager", "reader"}:
        if current_user.org_unit_id is None:
            raise HTTPException(
                status_code=403, detail="Portée organisationnelle invalide."
            )
        if org_unit_id is not None:
            assert_org_unit_scope(org_unit_id, current_user)
        effective_org_unit_id = current_user.org_unit_id
        if org_unit_id is None:
            effective_recursive = True

    service = ReportsService(db)
    return await service.get_service_activity(
        tenant_id=effective_tenant,
        org_unit_id=effective_org_unit_id,
        recursive=effective_recursive,
        domain_id=domain_id,
        activity_id=activity_id,
        document_category_id=document_category_id,
    )
