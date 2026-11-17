from datetime import date
from typing import Optional
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
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
from app.schemas.official_report import (
    OfficialReportIssueOut,
    OfficialReportKind,
    OfficialReportRequest,
)
from app.services.official_report import (
    OfficialReportError,
    issue_official_report,
    list_issues,
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
        current_user, tenant_id=tenant_id, org_unit_id=org_unit_id, recursive=recursive
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
        current_user, tenant_id=tenant_id, org_unit_id=org_unit_id, recursive=recursive
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
        current_user, tenant_id=tenant_id, org_unit_id=org_unit_id, recursive=recursive
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
        current_user, tenant_id=tenant_id, org_unit_id=org_unit_id, recursive=recursive
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


@router.post("/official")
async def issue_official_report_route(
    payload: OfficialReportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Numbered official copy (CSV or HTML) of one report, registered and logged.

    Same right and same scope as the report screens. ``X-Report-Number`` carries the
    number percent-encoded (``N%C2%B0 0001/2026/SIGLE``), ``X-Report-SHA256`` the
    fingerprint of the file delivered, also kept in the register.
    """
    await authorize_or_403(current_user, "analytics.tenant", "read")
    scope = await resolve_report_scope(
        current_user,
        tenant_id=payload.tenant_id,
        org_unit_id=payload.org_unit_id,
        recursive=payload.recursive,
    )
    try:
        issued = await issue_official_report(db, current_user, payload, scope)
    except OfficialReportError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return Response(
        content=issued.content,
        media_type=issued.media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{issued.filename}"',
            "X-Report-Number": quote(issued.issue.number, safe="/ "),
            "X-Report-SHA256": issued.issue.file_sha256,
        },
    )


@router.get("/official/issues", response_model=list[OfficialReportIssueOut])
async def list_official_report_issues(
    response: Response,
    year: Optional[int] = Query(None, ge=2000, le=2100),
    kind: Optional[OfficialReportKind] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    tenant_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register of issued copies, newest number first; ``X-Total-Count`` = total.

    Roles limited to their unit see only the copies they issued themselves.
    """
    await authorize_or_403(current_user, "analytics.tenant", "read")
    scope = await resolve_report_scope(current_user, tenant_id=tenant_id)
    own_only = scope.org_unit_id is not None
    total, issues = await list_issues(
        db,
        tenant_id=scope.tenant_id,
        issued_by=current_user.id if own_only else None,
        year=year,
        kind=kind,
        skip=skip,
        limit=limit,
    )
    response.headers["X-Total-Count"] = str(total)
    return issues
