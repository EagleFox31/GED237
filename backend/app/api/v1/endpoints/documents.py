# backend/app/api/v1/endpoints/documents.py
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from app.core.rate_limit import limiter
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.authz import can_perform, authorize_or_403, ctx_from_resource
from app.core.tenant_guard import assert_org_unit_scope
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.document_category import DocumentCategory
from app.models.document_version import DocumentVersion
from app.models.org_unit import OrgUnit
from app.models.user import User
from app.schemas.document import (
    DirectoryIngestRequest,
    DirectoryIngestResponse,
    DocumentOCRContent,
    DocumentRead,
    DocumentUpdate,
    NeedsReviewDocument,
    ResolveReviewPayload,
)
from app.services.classification_review_service import ClassificationReviewService
from app.services.ingestion import DirectoryIngestionService
from app.services.classification_rule_engine import ClassificationRuleEngine
from app.services.storage.factory import get_storage_service
from app.workers.tasks import process_document_ocr

router = APIRouter()
storage_service = get_storage_service()

ADMIN_ROLES = {"super_admin", "tenant_admin", "unit_admin"}
TENANT_WIDE_READ_ROLES = ADMIN_ROLES | {"auditor"}
ORG_UNIT_READ_ROLES = {"manager", "reader"}
OWNER_MUTABLE_STATUSES = {"draft", "rejected"}
ARCHIVABLE_SOURCE_STATUSES = {"validated", "signed"}
LOCK_DURATION_MINUTES = 30


def _document_load_options():
    return (
        selectinload(Document.document_category),
        selectinload(Document.current_version),
        selectinload(Document.classification_domain),
        selectinload(Document.classification_activity),
        selectinload(Document.owner),
    )


def _role_code(user: User) -> str:
    return (getattr(user.role, "code", "") or "").lower()


def _require_org_unit(user: User) -> UUID:
    if not user.org_unit_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be attached to an org unit for this operation",
        )
    return user.org_unit_id


async def _resolve_target_org_unit_id(
    db: AsyncSession,
    *,
    current_user: User,
    requested_org_unit_id: Optional[UUID],
) -> UUID:
    if requested_org_unit_id is None:
        return _require_org_unit(current_user)

    assert_org_unit_scope(requested_org_unit_id, current_user)

    result = await db.execute(
        select(OrgUnit).where(
            OrgUnit.id == requested_org_unit_id,
            OrgUnit.tenant_id == current_user.tenant_id,
            OrgUnit.is_active,
        )
    )
    org_unit = result.scalar_one_or_none()
    if org_unit is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target org unit not found or inactive in this tenant",
        )
    return org_unit.id


async def _can_read_document(user: User, document: Document) -> bool:
    """
    Casbin valide le TYPE de permission (read / read_own).
    La logique org_unit pour manager/reader reste ici (règle métier).
    """
    ctx = ctx_from_resource(document)
    if await can_perform(user, "documents", "read", ctx):
        role_code = _role_code(user)
        if role_code in ORG_UNIT_READ_ROLES:
            return bool(user.org_unit_id and document.org_unit_id == user.org_unit_id)
        return True  # admin / auditor : accès tenant-wide
    return await can_perform(user, "documents", "read_own", ctx)


async def _can_mutate_document(user: User, document: Document) -> bool:
    """
    Casbin valide update / update_own.
    OWNER_MUTABLE_STATUSES reste une règle métier (hors Casbin).
    """
    ctx = ctx_from_resource(document)
    if await can_perform(user, "documents", "update", ctx):
        return True
    return (
        await can_perform(user, "documents", "update_own", ctx)
        and document.status in OWNER_MUTABLE_STATUSES
    )


async def _can_trash_document(user: User, document: Document) -> bool:
    """
    Casbin valide delete (admins) ou trash_own (propriétaire).
    """
    ctx = ctx_from_resource(document)
    if await can_perform(user, "documents", "delete", ctx):
        return True
    return await can_perform(user, "documents", "trash_own", ctx)


async def _can_manage_lock(user: User, document: Document) -> bool:
    """
    Décision métier explicite (GED237):
    - le verrou est une extension du droit d'édition du document ;
    - `update` => lock/unlock/refresh sur les documents accessibles ;
    - `update_own` => lock/unlock/refresh sur ses propres documents.

    Ce choix est intentionnel: lock/unlock n'est pas traité comme un droit
    d'administration séparé à ce stade.
    """
    ctx = ctx_from_resource(document)
    if await can_perform(user, "documents", "update", ctx):
        return True
    return await can_perform(user, "documents", "update_own", ctx)


def _is_locked_by_other_user(document: Document, user: User) -> bool:
    now = datetime.now(timezone.utc)
    return bool(
        document.locked_by_user_id
        and str(document.locked_by_user_id) != str(user.id)
        and document.lock_expires_at
        and document.lock_expires_at > now
    )


async def _ensure_not_locked_for_write(document: Document, user: User) -> None:
    # Casbin: "manage" permet de bypass un lock actif.
    if await can_perform(user, "documents", "manage", ctx_from_resource(document)):
        return
    if not _is_locked_by_other_user(document, user):
        return
    raise HTTPException(
        status_code=status.HTTP_423_LOCKED,
        detail={
            "error": "document_locked",
            "message": "Ce document est verrouille par un autre utilisateur.",
            "locked_by": str(document.locked_by_user_id),
            "lock_expires_at": document.lock_expires_at.isoformat()
            if document.lock_expires_at
            else None,
        },
    )


async def _validate_category_for_tenant(
    db: AsyncSession, category_id: UUID, tenant_id: UUID
) -> None:
    """Vérifie que la catégorie existe, appartient au tenant et est active."""
    result = await db.execute(
        select(DocumentCategory).where(
            DocumentCategory.id == category_id,
            DocumentCategory.tenant_id == tenant_id,
        )
    )
    cat = result.scalar_one_or_none()
    if cat is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category not found or does not belong to this tenant",
        )
    if not cat.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category is inactive",
        )


async def _collect_descendant_org_unit_ids(
    db: AsyncSession, *, tenant_id: UUID, root_org_unit_id: UUID
) -> List[UUID]:
    """Return the selected org unit plus all descendants using parent_id links.

    This avoids depending on org_unit_closure, which may be empty in local/dev data.
    """
    result = await db.execute(
        select(OrgUnit.id, OrgUnit.parent_id).where(OrgUnit.tenant_id == tenant_id)
    )
    rows = result.all()

    children_by_parent: Dict[Optional[UUID], List[UUID]] = {}
    for org_unit_id, parent_id in rows:
        children_by_parent.setdefault(parent_id, []).append(org_unit_id)

    collected: List[UUID] = []
    stack: List[UUID] = [root_org_unit_id]
    seen: set[UUID] = set()

    while stack:
        current_id = stack.pop()
        if current_id in seen:
            continue
        seen.add(current_id)
        collected.append(current_id)
        stack.extend(children_by_parent.get(current_id, []))

    return collected


def _audit_document_action(
    *,
    user: User,
    document_id: UUID,
    action: str,
    details: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    return AuditLog(
        tenant_id=user.tenant_id,
        user_id=user.id,
        table_name="documents",
        record_id=document_id,
        action=action,
        new_data=details or {},
    )


def _serialize_audit_log(audit_log: AuditLog) -> Dict[str, Any]:
    return {
        "id": str(audit_log.id),
        "tenant_id": str(audit_log.tenant_id) if audit_log.tenant_id else None,
        "user_id": str(audit_log.user_id) if audit_log.user_id else None,
        "table_name": audit_log.table_name,
        "record_id": str(audit_log.record_id),
        "action": audit_log.action,
        "old_data": audit_log.old_data,
        "new_data": audit_log.new_data,
        "ip_address": str(audit_log.ip_address) if audit_log.ip_address else None,
        "user_agent": audit_log.user_agent,
        "created_at": audit_log.created_at.isoformat()
        if audit_log.created_at
        else None,
    }


def _derive_file_type(
    filename: Optional[str], mime_type: Optional[str]
) -> Optional[str]:
    if filename:
        extension = os.path.splitext(filename)[1].lower().lstrip(".")
        if extension:
            return extension[:50]
    if mime_type:
        subtype = mime_type.split("/")[-1].lower().strip()
        if subtype:
            return subtype[:50]
    return None


def _serialize_document(document: Document) -> DocumentRead:
    owner_name: Optional[str] = None
    if document.owner:
        owner_name = document.owner.full_name or document.owner.matricule

    return DocumentRead(
        id=document.id,
        title=document.title,
        document_category_id=document.document_category_id,
        tags=document.tags or [],
        description=None,
        category_code=document.category_code,
        category_name=document.category_name,
        tenant_id=document.tenant_id,
        org_unit_id=document.org_unit_id,
        owner_id=document.owner_id,
        file_path=document.file_path,
        file_type=document.file_type,
        mime_type=document.mime_type,
        file_size=document.file_size,
        status=document.status,
        processing_mode=document.processing_mode or "process",
        classification_domain_id=document.classification_domain_id,
        classification_domain_name=document.classification_domain_name,
        classification_activity_id=document.classification_activity_id,
        classification_activity_name=document.classification_activity_name,
        classification_year=document.classification_year,
        classification_scope=document.classification_scope or "service",
        classification_target_org_unit_id=document.classification_target_org_unit_id,
        classification_target_user_id=document.classification_target_user_id,
        classification_status=document.classification_status or "pending",
        logical_space_path=document.logical_space_path,
        source_relative_path=document.source_relative_path,
        import_job_id=document.import_job_id,
        current_version_id=document.current_version_id,
        created_at=document.created_at,
        updated_at=document.updated_at,
        owner_name=owner_name,
        current_version_number=document.current_version_number,
    )


def _parse_next_version(versions: List[DocumentVersion]) -> str:
    max_major = 1
    max_minor = 0
    for version in versions:
        raw = (version.version_number or "").strip()
        if not raw:
            continue
        parts = raw.split(".")
        try:
            major = int(parts[0])
            minor = int(parts[1]) if len(parts) > 1 else 0
        except ValueError:
            continue
        if (major, minor) > (max_major, max_minor):
            max_major, max_minor = major, minor
    return f"{max_major}.{max_minor + 1}"


async def _get_document_or_404(
    db: AsyncSession, tenant_id: UUID, document_id: UUID
) -> Document:
    result = await db.execute(
        select(Document)
        .options(*_document_load_options())
        .where(Document.id == document_id, Document.tenant_id == tenant_id)
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.get("/stats")
async def get_document_stats(
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Compteurs de documents pour un tenant (total + par statut).
    super_admin peut passer ?tenant_id= pour cibler un tenant.
    Aucun contenu de document n est expose.
    """
    is_super = await can_perform(current_user, "tenants", "manage")
    effective_tenant = tenant_id if (is_super and tenant_id) else current_user.tenant_id

    total_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.tenant_id == effective_tenant,
            Document.deleted_at.is_(None),
        )
    )
    total = total_result.scalar_one()

    status_result = await db.execute(
        select(Document.status, func.count(Document.id))
        .where(
            Document.tenant_id == effective_tenant,
            Document.deleted_at.is_(None),
        )
        .group_by(Document.status)
    )
    by_status = {row[0]: row[1] for row in status_result.all()}

    trash_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.tenant_id == effective_tenant,
            Document.deleted_at.is_not(None),
        )
    )
    trashed = trash_result.scalar_one()

    return {
        "tenant_id": str(effective_tenant),
        "total": total,
        "trashed": trashed,
        "by_status": by_status,
    }


@router.post(
    "/upload", response_model=DocumentRead, status_code=status.HTTP_201_CREATED
)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    document_category_id: Optional[UUID] = Form(None),
    org_unit_id: Optional[UUID] = Form(None),
    tags: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    processing_mode: str = Form("process"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a document and create V1.0 with checksum-based duplicate protection.

    processing_mode:
      - 'process' (défaut) : déclenche les règles d'aiguillage et le routage workflow.
      - 'archive' : pure archivage, aucune règle déclenchée. Utile pour la migration
        initiale ou les pièces purement documentaires (rapports, copies, archives).
    """
    if processing_mode not in ("archive", "process"):
        raise HTTPException(status_code=400, detail="processing_mode invalide.")
    await authorize_or_403(current_user, "documents", "create")
    if document_category_id:
        await _validate_category_for_tenant(
            db, document_category_id, current_user.tenant_id
        )
    target_org_unit_id = await _resolve_target_org_unit_id(
        db,
        current_user=current_user,
        requested_org_unit_id=org_unit_id,
    )
    directory = f"{current_user.tenant_id}/{target_org_unit_id}"

    file_path, checksum = await storage_service.save_file_with_checksum(
        file, directory=directory
    )

    existing_dup = await db.execute(
        select(DocumentVersion)
        .join(Document, Document.id == DocumentVersion.document_id)
        .where(
            DocumentVersion.checksum_sha256 == checksum,
            Document.tenant_id == current_user.tenant_id,
            Document.deleted_at.is_(None),
        )
        .limit(1)
    )
    dup_version = existing_dup.scalar_one_or_none()
    if dup_version:
        storage_service.delete_file(file_path)
        db.add(
            _audit_document_action(
                user=current_user,
                document_id=dup_version.document_id,
                action="dup_detected",
                details={
                    "checksum_sha256": checksum,
                    "attempted_filename": file.filename,
                    "existing_version": dup_version.version_number,
                },
            )
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "duplicate_file",
                "message": "Un fichier identique existe deja dans ce tenant.",
                "existing_document_id": str(dup_version.document_id),
                "existing_version": dup_version.version_number,
            },
        )

    tag_list = [t.strip() for t in tags.split(",")] if tags else []
    file_size = file.size or 0
    file_mime_type = file.content_type or "application/octet-stream"
    file_type = _derive_file_type(file.filename, file_mime_type)

    db_document = Document(
        title=title,
        file_path=file_path,
        file_type=file_type,
        file_size=file_size,
        mime_type=file_mime_type,
        document_category_id=document_category_id,
        tags=tag_list,
        owner_id=current_user.id,
        tenant_id=current_user.tenant_id,
        org_unit_id=target_org_unit_id,
        status="draft",
        processing_mode=processing_mode,
        extra_data={"description": description} if description else {},
    )
    db.add(db_document)
    await db.flush()

    db_version = DocumentVersion(
        document_id=db_document.id,
        version_number="1.0",
        file_path=file_path,
        file_size=file_size,
        mime_type=file_mime_type,
        checksum_sha256=checksum,
        uploaded_by_id=current_user.id,
        uploaded_at=datetime.now(timezone.utc),
    )
    db.add(db_version)
    await db.flush()

    db_document.current_version_id = db_version.id
    classification_engine = ClassificationRuleEngine(db)
    await classification_engine.classify_document(
        document=db_document,
        source_scope="service",
        source_user_id=current_user.id,
        filename=file.filename or title,
        mime_type=file_mime_type,
    )
    if db_document.classification_status in {"pending", "needs_review"}:
        review_service = ClassificationReviewService(db)
        await review_service.ensure_open_review_for_document(document=db_document)
    await db.commit()
    await db.refresh(db_document)

    # 5. Dispatch Event for GEDRules / Routing
    # En mode 'archive', on saute le dispatch : la pièce est rangée mais aucun circuit
    # n'est déclenché. Cas typique : migration initiale, copies pour information.
    if processing_mode == "process":
        from app.core.events.dispatcher import dispatcher

        payload = {
            "document_id": str(db_document.id),
            "tenant_id": str(db_document.tenant_id),
            "document_category_id": str(db_document.document_category_id)
            if db_document.document_category_id
            else None,
            "org_unit_id": str(db_document.org_unit_id)
            if db_document.org_unit_id
            else None,
        }

        await dispatcher.dispatch("DOCUMENT_CREATED", payload)

    # Refresh après le listener : le flush() du listener expire db_document.
    # Sans ce refresh, FastAPI ne peut pas sérialiser les attributs lazy (updated_at, etc.)
    await db.refresh(db_document)

    # Reload with category and current_version relationships for serialization
    result = await db.execute(
        select(Document)
        .options(*_document_load_options())
        .where(Document.id == db_document.id)
    )
    db_document = result.scalar_one()

    if file_mime_type and (
        file_mime_type.startswith("image/") or file_mime_type == "application/pdf"
    ):
        try:
            process_document_ocr.delay(str(db_document.id), file_path, file_mime_type)
        except Exception as exc:
            print(f"Warning: Could not queue OCR task: {exc}")

    return _serialize_document(db_document)


@router.get("/", response_model=List[DocumentRead])
async def list_documents(
    skip: int = 0,
    limit: int = 100,
    document_status: Optional[str] = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role_code = _role_code(current_user)
    query = select(Document).where(
        Document.tenant_id == current_user.tenant_id, Document.deleted_at.is_(None)
    )

    if role_code in TENANT_WIDE_READ_ROLES:
        pass
    elif role_code in ORG_UNIT_READ_ROLES and current_user.org_unit_id:
        query = query.where(Document.org_unit_id == current_user.org_unit_id)
    else:
        query = query.where(Document.owner_id == current_user.id)

    if document_status:
        query = query.where(Document.status == document_status)

    query = query.options(*_document_load_options())
    result = await db.execute(query.offset(skip).limit(limit))
    return [_serialize_document(document) for document in result.scalars().all()]


@router.get("/trash", response_model=List[DocumentRead])
async def list_trashed_documents(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role_code = _role_code(current_user)
    query = select(Document).where(
        Document.tenant_id == current_user.tenant_id, Document.deleted_at.is_not(None)
    )
    if role_code in TENANT_WIDE_READ_ROLES:
        pass
    elif role_code in ORG_UNIT_READ_ROLES and current_user.org_unit_id:
        query = query.where(Document.org_unit_id == current_user.org_unit_id)
    else:
        query = query.where(Document.owner_id == current_user.id)
    result = await db.execute(
        query.options(
            *_document_load_options(),
        )
        .order_by(Document.deleted_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return [_serialize_document(document) for document in result.scalars().all()]


@router.get("/needs-review", response_model=List[NeedsReviewDocument])
async def list_needs_review(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "documents", "manage")
    service = ClassificationReviewService(db)
    documents = await service.list_legacy_needs_review_documents(
        tenant_id=current_user.tenant_id
    )
    return documents[skip : skip + limit]


@router.get("/{document_id}/audit-logs")
async def get_document_audit_logs(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    if not await _can_read_document(current_user, document):
        raise HTTPException(status_code=403, detail="Not enough privileges")

    query = (
        select(AuditLog)
        .where(
            or_(
                (AuditLog.table_name == "documents")
                & (AuditLog.record_id == document_id),
                (AuditLog.table_name == "ged_rules")
                & (
                    cast(AuditLog.new_data["document_id"], String) == f'"{document_id}"'
                ),
            )
        )
        .order_by(AuditLog.created_at.desc())
    )
    result = await db.execute(query)
    return [_serialize_audit_log(audit_log) for audit_log in result.scalars().all()]


@router.post("/{document_id}/resolve-review")
async def resolve_manual_review(
    document_id: UUID,
    payload: ResolveReviewPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    await authorize_or_403(
        current_user, "workflows", "resolve_review", ctx_from_resource(document)
    )
    is_classification_review = document.classification_status in {
        "pending",
        "needs_review",
    }
    is_legacy_returned_review = document.status == "returned"
    if is_classification_review:
        raise HTTPException(
            status_code=410,
            detail="Classification review resolution moved to /api/v1/classification-reviews/{review_id}/resolve.",
        )
    if not is_legacy_returned_review:
        raise HTTPException(
            status_code=400,
            detail="Document is not in a legacy workflow reviewable state",
        )

    previous_status = document.status
    previous_classification_status = document.classification_status

    if payload.target_folder_id:
        try:
            target_folder_uuid = UUID(payload.target_folder_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=400, detail="target_folder_id must be a valid UUID"
            ) from exc
        document.org_unit_id = target_folder_uuid
        document.classification_target_org_unit_id = target_folder_uuid

    if payload.document_category_id:
        await _validate_category_for_tenant(
            db, payload.document_category_id, current_user.tenant_id
        )
        document.document_category_id = payload.document_category_id

    if payload.new_filename:
        import os

        current_filename = (document.file_path or "").split("/")[-1]
        current_ext = os.path.splitext(current_filename)[1]
        new_name = payload.new_filename.strip()
        if not os.path.splitext(new_name)[1]:
            new_name = f"{new_name}{current_ext}"

        if document.file_path:
            new_rel_path = storage_service.rename_file(document.file_path, new_name)
            if new_rel_path:
                document.file_path = new_rel_path
                if document.current_version_id:
                    current_version = await db.get(
                        DocumentVersion, document.current_version_id
                    )
                    if current_version:
                        current_version.file_path = new_rel_path

        # Keep title business-friendly (without extension).
        document.title = os.path.splitext(new_name)[0]

    if payload.mark_as_resolved:
        document.classification_status = "classified"
        if is_legacy_returned_review:
            document.status = "validated"

    db.add(document)
    audit = _audit_document_action(
        user=current_user,
        document_id=document.id,
        action="review_resolved",
        details={
            "previous_status": previous_status,
            "new_status": document.status,
            "previous_classification_status": previous_classification_status,
            "new_classification_status": document.classification_status,
            "target_folder_id": payload.target_folder_id,
            "document_category_id": str(payload.document_category_id)
            if payload.document_category_id
            else None,
            "comment": payload.comment,
            "resolution_reason": payload.resolution_reason,
            "created_rule_suggestion": payload.create_rule_suggestion,
            "renamed_to": payload.new_filename,
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(document)

    return {
        "success": True,
        "document_id": str(document.id),
        "previous_status": previous_status,
        "new_status": document.status,
        "previous_classification_status": previous_classification_status,
        "new_classification_status": document.classification_status,
        "target_folder_id": payload.target_folder_id,
        "document_category_id": str(document.document_category_id)
        if document.document_category_id
        else None,
        "resolved_by": str(current_user.id),
        "audit_log_id": str(audit.id),
    }


@router.get("/workspace", response_model=List[DocumentRead])
async def list_workspace_documents(
    org_unit_id: Optional[UUID] = None,
    recursive: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List documents for a specific workspace (org unit).
    If recursive=True, includes documents from sub-units.
    """
    target_unit_id = org_unit_id or current_user.org_unit_id
    if not target_unit_id:
        raise HTTPException(
            status_code=400, detail="No org unit specified or found for user"
        )

    # Check access (simplified: must be in same tenant)
    # In a real scenario, we might want more granular checks
    role_code = _role_code(current_user)

    query = select(Document).where(
        Document.tenant_id == current_user.tenant_id, Document.deleted_at.is_(None)
    )

    if recursive:
        org_unit_ids = await _collect_descendant_org_unit_ids(
            db,
            tenant_id=current_user.tenant_id,
            root_org_unit_id=target_unit_id,
        )
        query = query.where(Document.org_unit_id.in_(org_unit_ids))
    else:
        query = query.where(Document.org_unit_id == target_unit_id)

    # Apply role-based filtering aligned with list_documents policy:
    # - Tenant-wide roles (admins, auditors): full access to any unit.
    # - Org-unit roles (manager, reader): restricted to their own unit.
    #   Accessing another unit's workspace is forbidden unless they are admin.
    # - Everyone else (collaborator, etc.): only their own documents.
    if role_code not in TENANT_WIDE_READ_ROLES:
        if role_code in ORG_UNIT_READ_ROLES:
            if not current_user.org_unit_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User must be attached to an org unit for this operation",
                )
            if str(current_user.org_unit_id) != str(target_unit_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access to another org unit's workspace requires admin privileges",
                )
        else:
            query = query.where(Document.owner_id == current_user.id)

    result = await db.execute(
        query.options(
            *_document_load_options(),
        )
    )
    return result.scalars().all()


@router.get("/tree")
async def get_org_unit_tree(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the hierarchy of organization units for the current tenant.
    """
    from app.models.org_unit import OrgUnit

    query = (
        select(OrgUnit)
        .where(OrgUnit.tenant_id == current_user.tenant_id, OrgUnit.is_active.is_(True))
        .order_by(OrgUnit.level, OrgUnit.name)
    )

    result = await db.execute(query)
    units = result.scalars().all()

    # Build tree
    nodes = {
        str(u.id): {
            "id": str(u.id),
            "name": u.name,
            "code": u.code,
            "level": u.level,
            "parent_id": str(u.parent_id) if u.parent_id else None,
            "children": [],
        }
        for u in units
    }

    tree = []
    for unit_id, node in nodes.items():
        parent_id = node["parent_id"]
        if parent_id and parent_id in nodes:
            nodes[parent_id]["children"].append(node)
        else:
            if not parent_id:  # Root level for this tenant
                tree.append(node)

    return tree


@router.get("/{document_id}", response_model=DocumentRead)
async def get_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    if not await _can_read_document(current_user, document):
        raise HTTPException(
            status_code=403, detail="Not enough privileges to access this document"
        )
    return _serialize_document(document)


@router.get("/{document_id}/versions")
async def get_document_versions(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    if not await _can_read_document(current_user, document):
        raise HTTPException(
            status_code=403, detail="Not enough privileges to access this document"
        )

    result = await db.execute(
        select(DocumentVersion, User)
        .outerjoin(User, User.id == DocumentVersion.uploaded_by_id)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.uploaded_at.desc())
    )
    versions = result.all()
    return [
        {
            "id": str(version.id),
            "version_number": version.version_number,
            "file_path": version.file_path,
            "file_size": version.file_size,
            "mime_type": version.mime_type,
            "checksum_sha256": version.checksum_sha256,
            "uploaded_by_id": str(version.uploaded_by_id)
            if version.uploaded_by_id
            else None,
            "uploaded_by_name": user.full_name if user else "Système",
            "uploaded_at": version.uploaded_at.isoformat()
            if version.uploaded_at
            else None,
            "change_note": version.change_note,
            "is_current": str(version.id) == str(document.current_version_id),
        }
        for version, user in versions
    ]


@router.get("/{document_id}/content")
@limiter.limit("60/minute")
async def get_document_content(
    request: Request,
    document_id: UUID,
    disposition: str = "inline",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Sert le contenu binaire d'un document.

    Sécurité :
    - OWASP API 2023 #1 (BOLA) : 404 défensif sur cross-tenant via _get_document_or_404,
      puis _can_read_document (RBAC + scope unité organisationnelle).
    - OWASP API 2023 #4 (Resource Consumption) : rate-limit 60/min/IP.
    - Audit ISO 27001 A.8.15 + RGPD art.30 : trace de chaque consultation.
    - Headers de sécurité : X-Content-Type-Options=nosniff, CSP minimaliste,
      Cache-Control private (multi-tenant — jamais de cache partagé).
    - Content-Disposition RFC 6266 + filename* RFC 5987 (UTF-8 pour accents FR).

    Query params :
    - disposition: "inline" (par défaut, pour <iframe>/<img>) ou "attachment" (download).
    """
    if disposition not in ("inline", "attachment"):
        raise HTTPException(
            status_code=400, detail="disposition must be 'inline' or 'attachment'"
        )

    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    if not await _can_read_document(current_user, document):
        # 404 plutôt que 403 : on évite de signaler l'existence d'une ressource
        # à un utilisateur non autorisé (anti-énumération).
        raise HTTPException(status_code=404, detail="Document not found")

    if not document.file_path:
        raise HTTPException(status_code=404, detail="Document not found")

    # Audit obligatoire de la consultation (mode = inline → preview ; attachment → download).
    db.add(
        _audit_document_action(
            user=current_user,
            document_id=document.id,
            action="content_viewed",
            details={"disposition": disposition},
        )
    )
    await db.commit()

    # Nom de fichier : title + extension d'origine si manquante.
    filename = document.title or "document"
    ext = os.path.splitext(document.file_path)[1]
    if ext and not filename.lower().endswith(ext.lower()):
        filename += ext

    # RFC 5987 : encodage UTF-8 pour les noms avec accents.
    from urllib.parse import quote
    safe_ascii = filename.encode("ascii", errors="ignore").decode("ascii") or "document"
    content_disposition = (
        f"{disposition}; filename=\"{safe_ascii}\"; "
        f"filename*=UTF-8''{quote(filename)}"
    )

    media_type = document.mime_type or "application/octet-stream"

    # Headers de sécurité communs (locaux + S3).
    common_headers = {
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": content_disposition,
        "Referrer-Policy": "no-referrer",
    }

    full_path = storage_service.get_full_path(document.file_path)

    # ── Stockage S3 ────────────────────────────────────────────────────
    if full_path.startswith("s3://"):
        content = storage_service.get_file_content(document.file_path)
        if not content:
            raise HTTPException(status_code=404, detail="Document not found")
        from fastapi import Response
        return Response(content=content, media_type=media_type, headers=common_headers)

    # ── Stockage local : FileResponse gère Range automatiquement ──────
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Document not found")

    from fastapi.responses import FileResponse
    return FileResponse(
        path=full_path,
        media_type=media_type,
        headers=common_headers,
        # On laisse FileResponse poser sa propre Content-Disposition par défaut,
        # mais notre `headers` la remplace (override explicite RFC-compliant).
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    if not await _can_mutate_document(current_user, document):
        raise HTTPException(
            status_code=403, detail="Not enough privileges to delete this document"
        )
    await _ensure_not_locked_for_write(document, current_user)

    versions_result = await db.execute(
        select(DocumentVersion).where(DocumentVersion.document_id == document.id)
    )
    versions = versions_result.scalars().all()
    for version in versions:
        if version.file_path:
            storage_service.delete_file(version.file_path)
    if document.file_path:
        storage_service.delete_file(document.file_path)

    await db.delete(document)
    await db.commit()
    return None


@router.patch("/{document_id}", response_model=DocumentRead)
async def update_document(
    document_id: UUID,
    document_in: DocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    if not await _can_mutate_document(current_user, document):
        raise HTTPException(
            status_code=403, detail="Not enough privileges to update this document"
        )
    if document.deleted_at:
        raise HTTPException(status_code=400, detail="Cannot update a document in trash")
    await _ensure_not_locked_for_write(document, current_user)

    update_data = document_in.model_dump(exclude_unset=True)
    if "document_category_id" in update_data:
        new_cat_id = update_data["document_category_id"]
        if new_cat_id is not None:
            await _validate_category_for_tenant(db, new_cat_id, current_user.tenant_id)
        else:
            # Désaffectation de catégorie : réservé aux admins
            await authorize_or_403(current_user, "documents", "manage")
    requested_status = update_data.pop("status", None)

    if requested_status is not None:
        if requested_status != "archived":
            raise HTTPException(
                status_code=400,
                detail="Document status transitions must go through workflow endpoints",
            )
        await authorize_or_403(current_user, "documents", "manage")
        if document.status not in ARCHIVABLE_SOURCE_STATUSES:
            raise HTTPException(
                status_code=409,
                detail="Only validated or signed documents can be archived",
            )
        document.status = "archived"

    for field, value in update_data.items():
        setattr(document, field, value)

    db.add(document)
    await db.commit()
    # Reload with relationships
    return await _get_document_or_404(db, current_user.tenant_id, document.id)


@router.get("/{document_id}/ocr", response_model=DocumentOCRContent)
async def get_document_ocr(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    if not await _can_read_document(current_user, document):
        raise HTTPException(
            status_code=403, detail="Not enough privileges to access this document"
        )

    ocr_status = "not_processed"
    ocr_confidence = None
    if document.ocr_content:
        ocr_status = "completed"
        if document.extra_data and "ocr_confidence" in document.extra_data:
            ocr_confidence = document.extra_data["ocr_confidence"]
    else:
        ocr_source_type = document.mime_type or document.file_type
        if ocr_source_type and (
            ocr_source_type.startswith("image/") or ocr_source_type == "application/pdf"
        ):
            ocr_status = "processing"

    return DocumentOCRContent(
        document_id=document.id,
        ocr_content=document.ocr_content,
        ocr_confidence=ocr_confidence,
        ocr_status=ocr_status,
    )


@router.post("/ingest-directory", response_model=DirectoryIngestResponse)
async def ingest_directory(
    request: DirectoryIngestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "documents", "create")

    service = DirectoryIngestionService(db)
    report = service.ingest(
        source_dir=request.directory_path,
        tenant_id=current_user.tenant_id,
        org_unit_id=_require_org_unit(current_user),
        owner_id=current_user.id,
        recursive=request.recursive,
        document_category_id=request.document_category_id,
        processing_mode=request.processing_mode,
    )
    result = await report
    return DirectoryIngestResponse(**result.to_dict())


@router.post("/{document_id}/start-workflow", response_model=DocumentRead)
async def start_workflow_a_posteriori(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lance un circuit de validation a posteriori sur un document archivé.

    Cas d'usage : une pièce a été déposée en mode 'archive' (rangement initial,
    migration), et l'admin décide finalement de la soumettre au circuit défini par
    les règles d'aiguillage en vigueur.
    """
    await authorize_or_403(current_user, "documents", "update")
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    await _ensure_not_locked_for_write(document, current_user)

    if document.processing_mode != "archive":
        raise HTTPException(
            status_code=400,
            detail="Ce document est déjà en mode traitement.",
        )
    if document.status not in ("draft", "archived"):
        raise HTTPException(
            status_code=400,
            detail="Le document doit être en brouillon ou archivé pour lancer un circuit.",
        )

    document.processing_mode = "process"
    db.add(
        _audit_document_action(
            user=current_user,
            document_id=document.id,
            action="workflow_started_a_posteriori",
        )
    )
    await db.commit()
    await db.refresh(document)

    from app.core.events.dispatcher import dispatcher

    await dispatcher.dispatch(
        "DOCUMENT_CREATED",
        {
            "document_id": str(document.id),
            "tenant_id": str(document.tenant_id),
            "document_category_id": str(document.document_category_id)
            if document.document_category_id
            else None,
            "org_unit_id": str(document.org_unit_id) if document.org_unit_id else None,
        },
    )
    await db.refresh(document)

    result = await db.execute(
        select(Document)
        .options(*_document_load_options())
        .where(Document.id == document.id)
    )
    return result.scalar_one()


@router.post("/{document_id}/trash", status_code=status.HTTP_200_OK)
async def trash_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    if not await _can_trash_document(current_user, document):
        raise HTTPException(status_code=403, detail="Privileges insuffisants")
    await _ensure_not_locked_for_write(document, current_user)
    if document.deleted_at is not None:
        return {"message": "Document deja dans la corbeille."}

    document.deleted_at = datetime.now(timezone.utc)
    document.deleted_by = current_user.id
    db.add(
        _audit_document_action(
            user=current_user, document_id=document.id, action="document_trashed"
        )
    )
    await db.commit()
    return {"message": "Document place dans la corbeille."}


@router.post("/{document_id}/restore", status_code=status.HTTP_200_OK)
async def restore_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    if not await _can_trash_document(current_user, document):
        raise HTTPException(status_code=403, detail="Privileges insuffisants")
    if document.deleted_at is None:
        return {"message": "Document deja actif."}

    document.deleted_at = None
    document.deleted_by = None
    db.add(
        _audit_document_action(
            user=current_user, document_id=document.id, action="document_restored"
        )
    )
    await db.commit()
    return {"message": "Document restaure."}


@router.delete("/{document_id}/purge", status_code=status.HTTP_200_OK)
async def purge_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "documents", "manage")

    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    versions_result = await db.execute(
        select(DocumentVersion).where(DocumentVersion.document_id == document.id)
    )
    versions = versions_result.scalars().all()
    for version in versions:
        if version.file_path:
            storage_service.delete_file(version.file_path)
    if document.file_path:
        storage_service.delete_file(document.file_path)

    db.add(
        _audit_document_action(
            user=current_user, document_id=document.id, action="document_purged"
        )
    )
    await db.delete(document)
    await db.commit()
    return {"message": "Document definitivement supprime."}


@router.post("/{document_id}/versions", status_code=status.HTTP_201_CREATED)
async def upload_new_version(
    document_id: UUID,
    file: UploadFile = File(...),
    change_note: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a new binary version for a document.
    Rejects:
    - identical to current version
    - identical to any previous version of the same document
    - identical to a version in another active document of the same tenant
    """
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    if not await _can_mutate_document(current_user, document):
        raise HTTPException(status_code=403, detail="Privileges insuffisants")
    if document.deleted_at:
        raise HTTPException(
            status_code=400,
            detail="Impossible de modifier un document dans la corbeille.",
        )
    await _ensure_not_locked_for_write(document, current_user)

    org_unit_id = current_user.org_unit_id or document.org_unit_id
    if not org_unit_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be attached to an org unit for this operation",
        )
    directory = f"{current_user.tenant_id}/{org_unit_id}"
    file_path, checksum = await storage_service.save_file_with_checksum(
        file, directory=directory
    )

    versions_result = await db.execute(
        select(DocumentVersion).where(DocumentVersion.document_id == document.id)
    )
    versions = versions_result.scalars().all()
    current_version = next(
        (v for v in versions if str(v.id) == str(document.current_version_id)), None
    )

    if current_version and current_version.checksum_sha256 == checksum:
        storage_service.delete_file(file_path)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "identical_to_current",
                "message": "Le fichier est identique a la version actuelle.",
            },
        )

    previous_same = next(
        (
            v
            for v in versions
            if v.checksum_sha256 == checksum
            and str(v.id) != str(document.current_version_id)
        ),
        None,
    )
    if previous_same:
        storage_service.delete_file(file_path)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "identical_to_previous_version",
                "message": "Le fichier est identique a une ancienne version du document.",
                "existing_version": previous_same.version_number,
            },
        )

    tenant_dup_result = await db.execute(
        select(DocumentVersion)
        .join(Document, Document.id == DocumentVersion.document_id)
        .where(
            DocumentVersion.checksum_sha256 == checksum,
            Document.tenant_id == current_user.tenant_id,
            Document.deleted_at.is_(None),
            Document.id != document.id,
        )
        .limit(1)
    )
    tenant_dup = tenant_dup_result.scalar_one_or_none()
    if tenant_dup:
        storage_service.delete_file(file_path)
        db.add(
            _audit_document_action(
                user=current_user,
                document_id=tenant_dup.document_id,
                action="dup_detected",
                details={
                    "checksum_sha256": checksum,
                    "attempted_filename": file.filename,
                    "during": "version_upload",
                },
            )
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "duplicate_file",
                "message": "Ce binaire existe deja sur un autre document du tenant.",
                "existing_document_id": str(tenant_dup.document_id),
                "existing_version": tenant_dup.version_number,
            },
        )

    new_version_num = _parse_next_version(versions)
    file_size = file.size or 0
    file_mime_type = file.content_type or "application/octet-stream"
    file_type = _derive_file_type(file.filename, file_mime_type)
    db_version = DocumentVersion(
        document_id=document.id,
        version_number=new_version_num,
        file_path=file_path,
        file_size=file_size,
        mime_type=file_mime_type,
        checksum_sha256=checksum,
        uploaded_by_id=current_user.id,
        uploaded_at=datetime.now(timezone.utc),
        change_note=change_note,
    )
    db.add(db_version)
    await db.flush()

    document.current_version_id = db_version.id
    document.file_path = file_path
    document.file_size = file_size
    document.file_type = file_type
    document.mime_type = file_mime_type

    db.add(
        _audit_document_action(
            user=current_user,
            document_id=document.id,
            action="version_uploaded",
            details={"new_version": new_version_num, "checksum_sha256": checksum},
        )
    )
    await db.commit()
    return {"message": "Nouvelle version televersee", "version": new_version_num}


@router.post("/{document_id}/lock", status_code=status.HTTP_200_OK)
async def lock_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    if not await _can_manage_lock(current_user, document):
        raise HTTPException(status_code=403, detail="Privileges insuffisants")
    if document.deleted_at:
        raise HTTPException(
            status_code=400,
            detail="Impossible de verrouiller un document dans la corbeille.",
        )

    now = datetime.now(timezone.utc)
    if _is_locked_by_other_user(document, current_user):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail={
                "error": "already_locked",
                "message": "Ce document est deja verrouille par un autre utilisateur.",
                "locked_by": str(document.locked_by_user_id),
                "lock_expires_at": document.lock_expires_at.isoformat()
                if document.lock_expires_at
                else None,
            },
        )

    expires = now + timedelta(minutes=LOCK_DURATION_MINUTES)
    document.locked_by_user_id = current_user.id
    document.locked_at = now
    document.lock_expires_at = expires
    await db.commit()
    return {"message": "Document verrouille.", "lock_expires_at": expires.isoformat()}


@router.post("/{document_id}/unlock", status_code=status.HTTP_200_OK)
async def unlock_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    if not await _can_manage_lock(current_user, document):
        raise HTTPException(status_code=403, detail="Privileges insuffisants")
    is_admin = await can_perform(
        current_user, "documents", "manage", ctx_from_resource(document)
    )
    is_lock_owner = (
        str(document.locked_by_user_id) == str(current_user.id)
        if document.locked_by_user_id
        else False
    )
    if not is_admin and not is_lock_owner:
        raise HTTPException(
            status_code=403,
            detail="Seul le proprietaire du verrou ou un admin peut deverrouiller.",
        )

    document.locked_by_user_id = None
    document.locked_at = None
    document.lock_expires_at = None
    await db.commit()
    return {"message": "Verrou libere."}


@router.post("/{document_id}/refresh-lock", status_code=status.HTTP_200_OK)
async def refresh_lock(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    if not await _can_manage_lock(current_user, document):
        raise HTTPException(status_code=403, detail="Privileges insuffisants")
    if not document.locked_by_user_id or str(document.locked_by_user_id) != str(
        current_user.id
    ):
        raise HTTPException(
            status_code=403, detail="Vous ne detenez pas le verrou sur ce document."
        )

    now = datetime.now(timezone.utc)
    if document.lock_expires_at and document.lock_expires_at < now:
        raise HTTPException(
            status_code=409, detail="Le verrou a expire, veuillez reprendre le verrou."
        )

    expires = now + timedelta(minutes=LOCK_DURATION_MINUTES)
    document.locked_at = now
    document.lock_expires_at = expires
    await db.commit()
    return {"message": "Verrou renouvele.", "lock_expires_at": expires.isoformat()}
