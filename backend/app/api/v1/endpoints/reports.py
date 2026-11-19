from datetime import date
from typing import Optional
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import authorize_or_403
from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.report_schedule import ReportSchedule
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
    ReportScheduleCreate,
    ReportScheduleOut,
)
from app.services.official_report import (
    OfficialReportError,
    issue_filename,
    issue_official_report,
    list_issues,
    media_type,
    reprint_issue,
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
        headers=_copy_headers(issued.issue, issued.filename),
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


def _copy_headers(issue, filename: str) -> dict[str, str]:
    return {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "X-Report-Number": quote(issue.number, safe="/ "),
        "X-Report-SHA256": issue.file_sha256,
    }


@router.get("/official/issues/{issue_id}/file")
async def reprint_official_report(
    issue_id: UUID,
    tenant_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reprint: the very file delivered at issue, same number, no new number.

    Same visibility as the register; logged as ``report_reprinted``.
    """
    await authorize_or_403(current_user, "analytics.tenant", "read")
    scope = await resolve_report_scope(current_user, tenant_id=tenant_id)
    try:
        issue = await reprint_issue(
            db,
            current_user,
            tenant_id=scope.tenant_id,
            issue_id=issue_id,
            issued_by=current_user.id if scope.org_unit_id is not None else None,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(
        content=issue.content,
        media_type=media_type(issue.format),
        headers=_copy_headers(issue, issue_filename(issue)),
    )


SCHEDULED_REPORTS_HEADER = "X-Scheduled-Reports-Enabled"


@router.get("/official/schedules", response_model=list[ReportScheduleOut])
async def list_report_schedules(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The caller's active scheduled reports.

    The header tells the client whether this server runs them, so it can hide
    the feature when it is off.
    """
    await authorize_or_403(current_user, "analytics.tenant", "read")
    response.headers[SCHEDULED_REPORTS_HEADER] = (
        "true" if settings.SCHEDULED_REPORTS_ENABLED else "false"
    )
    result = await db.execute(
        select(ReportSchedule)
        .where(
            ReportSchedule.created_by == current_user.id,
            ReportSchedule.is_active.is_(True),
        )
        .order_by(ReportSchedule.created_at)
    )
    return result.scalars().all()


@router.post("/official/schedules", response_model=ReportScheduleOut, status_code=201)
async def create_report_schedule(
    payload: ReportScheduleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Schedule an official report, issued in the caller's name and scope.

    The scope is checked now (403 if refused) and again at each issue. 409 while
    the server does not run scheduled reports (SCHEDULED_REPORTS_ENABLED=false).
    """
    await authorize_or_403(current_user, "analytics.tenant", "read")
    if not settings.SCHEDULED_REPORTS_ENABLED:
        raise HTTPException(
            status_code=409,
            detail="Les rapports programmés sont désactivés sur ce serveur.",
        )
    scope = await resolve_report_scope(
        current_user,
        tenant_id=payload.report.tenant_id,
        org_unit_id=payload.report.org_unit_id,
        recursive=payload.report.recursive,
    )
    schedule = ReportSchedule(
        tenant_id=scope.tenant_id,
        created_by=current_user.id,
        name=payload.name.strip(),
        frequency=payload.frequency,
        request=payload.report.model_dump(
            mode="json", exclude={"date_from", "date_to"}
        ),
        is_active=True,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.delete("/official/schedules/{schedule_id}", status_code=204)
async def stop_report_schedule(
    schedule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stop a schedule of the caller; copies already issued stay in the register."""
    await authorize_or_403(current_user, "analytics.tenant", "read")
    schedule = await db.get(ReportSchedule, schedule_id)
    if schedule is None or schedule.created_by != current_user.id:
        raise HTTPException(status_code=404, detail="Rapport programmé introuvable.")
    if schedule.is_active:
        schedule.is_active = False
        await db.commit()
    return Response(status_code=204)
