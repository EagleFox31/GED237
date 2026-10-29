import logging
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.authz import authorize_or_403, can_perform
from app.core.authz.context import AuthzContext
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.tenant_guard import assert_org_unit_scope
from app.models.document_category import DocumentCategory
from app.models.import_job import ImportJob
from app.models.org_unit import OrgUnit
from app.models.user import User
from app.schemas.imports import (
    ImportCommitResponse,
    ImportJobItemRead,
    ImportJobRead,
    ImportJobWithItemsRead,
)
from app.services.import_analysis_service import ImportAnalysisService
from app.services.import_execution_service import ImportExecutionService
from app.services.storage.factory import get_storage_service

logger = logging.getLogger(__name__)

router = APIRouter()

ADMIN_ROLES = {"super_admin", "tenant_admin", "unit_admin"}
TENANT_WIDE_READ_ROLES = ADMIN_ROLES | {"auditor"}
ORG_UNIT_READ_ROLES = {"manager", "reader"}


def _role_code(user: User) -> str:
    return (getattr(user.role, "code", "") or "").lower()


async def _validate_category_for_tenant(
    db: AsyncSession, category_id: UUID, tenant_id: UUID
) -> None:
    result = await db.execute(
        select(DocumentCategory.id).where(
            DocumentCategory.id == category_id,
            DocumentCategory.tenant_id == tenant_id,
            DocumentCategory.is_active,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=400, detail="Categorie documentaire invalide.")


async def _resolve_target_org_unit_id(
    db: AsyncSession,
    *,
    current_user: User,
    target_org_unit_id: UUID | None,
) -> UUID | None:
    if target_org_unit_id is None:
        return current_user.org_unit_id
    assert_org_unit_scope(target_org_unit_id, current_user)
    result = await db.execute(
        select(OrgUnit.id).where(
            OrgUnit.id == target_org_unit_id,
            OrgUnit.tenant_id == current_user.tenant_id,
            OrgUnit.is_active,
        )
    )
    resolved = result.scalar_one_or_none()
    if resolved is None:
        raise HTTPException(status_code=400, detail="Unite cible invalide.")
    return resolved


async def _resolve_target_user(
    db: AsyncSession,
    *,
    current_user: User,
    target_user_id: UUID | None,
) -> User | None:
    if target_user_id is None:
        return None
    result = await db.execute(
        select(User).where(
            User.id == target_user_id,
            User.tenant_id == current_user.tenant_id,
            User.is_active,
        )
    )
    target_user = result.scalar_one_or_none()
    if target_user is None:
        raise HTTPException(status_code=400, detail="Utilisateur cible invalide.")
    if _role_code(current_user) not in ADMIN_ROLES and str(target_user.id) != str(
        current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="Vous ne pouvez cibler que votre propre utilisateur pour un import personnel.",
        )
    if _role_code(current_user) in ORG_UNIT_READ_ROLES:
        assert_org_unit_scope(target_user.org_unit_id, current_user)
    return target_user


async def _get_job_or_404(db: AsyncSession, job_id: UUID) -> ImportJob:
    result = await db.execute(
        select(ImportJob)
        .options(selectinload(ImportJob.items))
        .where(ImportJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Batch d'import introuvable.")
    return job


async def _get_job_for_update_or_404(db: AsyncSession, job_id: UUID) -> ImportJob:
    result = await db.execute(
        select(ImportJob)
        .options(selectinload(ImportJob.items))
        .where(ImportJob.id == job_id)
        .with_for_update()
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Batch d'import introuvable.")
    return job


async def _can_read_job(user: User, job: ImportJob) -> bool:
    ctx = AuthzContext(
        tenant_id=job.tenant_id,
        owner_id=job.created_by_id,
        org_unit_id=job.target_org_unit_id,
    )
    if await can_perform(user, "documents", "read", ctx):
        role_code = _role_code(user)
        if role_code in ORG_UNIT_READ_ROLES:
            return bool(user.org_unit_id and job.target_org_unit_id == user.org_unit_id)
        return True
    return await can_perform(user, "documents", "read_own", ctx)


def _can_commit_job(user: User, job: ImportJob) -> bool:
    role_code = _role_code(user)
    if role_code in ADMIN_ROLES:
        return True
    return str(job.created_by_id) == str(user.id)


def _delete_storage_paths(paths: list[str]) -> None:
    storage_service = get_storage_service()
    for path in paths:
        try:
            storage_service.delete_file(path)
        except Exception:
            logger.warning("Storage cleanup failed for %s", path, exc_info=True)


@router.post(
    "/analyze",
    response_model=ImportJobWithItemsRead,
    status_code=status.HTTP_201_CREATED,
)
async def analyze_import_job(
    files: list[UploadFile] = File(...),
    source_scope: str = Form("service"),
    target_org_unit_id: UUID | None = Form(default=None),
    target_user_id: UUID | None = Form(default=None),
    default_document_category_id: UUID | None = Form(default=None),
    forced_year: int | None = Form(default=None),
    processing_mode: str = Form("process"),
    source_relative_paths: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "documents", "create")
    if processing_mode not in {"archive", "process"}:
        raise HTTPException(status_code=400, detail="processing_mode invalide.")
    if source_scope not in {"person", "service", "subdirectorate"}:
        raise HTTPException(status_code=400, detail="source_scope invalide.")
    if not files:
        raise HTTPException(status_code=400, detail="Aucun fichier fourni.")
    if source_scope == "person" and target_user_id is None:
        raise HTTPException(
            status_code=400,
            detail="source_scope=person exige un utilisateur cible.",
        )

    resolved_target_user = await _resolve_target_user(
        db, current_user=current_user, target_user_id=target_user_id
    )
    derived_target_org_unit_id = target_org_unit_id
    if derived_target_org_unit_id is None and resolved_target_user is not None:
        derived_target_org_unit_id = resolved_target_user.org_unit_id
    resolved_target_org_unit_id = await _resolve_target_org_unit_id(
        db, current_user=current_user, target_org_unit_id=derived_target_org_unit_id
    )
    resolved_target_user_id = resolved_target_user.id if resolved_target_user else None
    if resolved_target_org_unit_id is None and resolved_target_user_id is None:
        raise HTTPException(
            status_code=400,
            detail="Le batch doit cibler un utilisateur ou une unite organisationnelle.",
        )
    if default_document_category_id:
        await _validate_category_for_tenant(
            db, default_document_category_id, current_user.tenant_id
        )

    job = ImportJob(
        tenant_id=current_user.tenant_id,
        created_by_id=current_user.id,
        source_scope=source_scope,
        target_org_unit_id=resolved_target_org_unit_id,
        target_user_id=resolved_target_user_id,
        default_document_category_id=default_document_category_id,
        forced_year=forced_year,
        processing_mode=processing_mode,
        status="draft",
    )
    db.add(job)
    await db.flush()

    service = ImportAnalysisService(db)
    try:
        await service.analyze(
            job=job,
            files=files,
            source_relative_paths_raw=source_relative_paths,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await db.commit()
    await db.refresh(job)
    job = await _get_job_or_404(db, job.id)
    return job


@router.post("/{job_id}/commit", response_model=ImportCommitResponse)
async def commit_import_job(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "documents", "create")
    job = await _get_job_for_update_or_404(db, job_id)
    if not await _can_read_job(current_user, job):
        raise HTTPException(status_code=403, detail="Acces refuse a ce batch d'import.")
    if not _can_commit_job(current_user, job):
        raise HTTPException(
            status_code=403,
            detail="Seul le createur ou un admin peut executer ce batch.",
        )
    if job.status != "analyzed":
        raise HTTPException(
            status_code=409,
            detail="Seuls les batches analyses peuvent etre executes.",
        )

    service = ImportExecutionService(db)
    summary = await service.commit(job=job)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        _delete_storage_paths(summary.rollback_delete_paths)
        raise
    _delete_storage_paths(summary.post_commit_delete_paths)
    if summary.dispatch_payloads:
        from app.core.events.dispatcher import dispatcher

        for payload in summary.dispatch_payloads:
            await dispatcher.dispatch("DOCUMENT_CREATED", payload)
    if summary.ocr_payloads:
        from app.workers.tasks import process_document_ocr

        for document_id, file_path, mime_type in summary.ocr_payloads:
            try:
                process_document_ocr.delay(document_id, file_path, mime_type)
            except Exception:
                logger.warning(
                    "OCR enqueue failed for document %s", document_id, exc_info=True
                )
    job = await _get_job_or_404(db, job_id)
    return ImportCommitResponse(
        job=ImportJobWithItemsRead.model_validate(job),
        imported_documents=summary.imported_documents,
        pending_review_items=summary.pending_review_items,
        failed_items=summary.failed_items,
    )


@router.get("/{job_id}", response_model=ImportJobRead)
async def get_import_job(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await _get_job_or_404(db, job_id)
    if not await _can_read_job(current_user, job):
        raise HTTPException(status_code=403, detail="Acces refuse a ce batch d'import.")
    return job


@router.get("/{job_id}/items", response_model=list[ImportJobItemRead])
async def get_import_job_items(
    job_id: UUID,
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await _get_job_or_404(db, job_id)
    if not await _can_read_job(current_user, job):
        raise HTTPException(status_code=403, detail="Acces refuse a ce batch d'import.")
    items = job.items
    if status_filter:
        items = [item for item in items if item.status == status_filter]
    return items
