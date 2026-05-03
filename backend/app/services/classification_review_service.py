import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import String, cast, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.authz import can_perform, ctx_from_resource
from app.models.audit import AuditLog
from app.models.classification_activity import ClassificationActivity
from app.models.classification_domain import ClassificationDomain
from app.models.classification_review import ClassificationReview
from app.models.document import Document
from app.models.document_category import DocumentCategory
from app.models.document_version import DocumentVersion
from app.models.import_job import ImportJob
from app.models.import_job_item import ImportJobItem
from app.models.org_unit import OrgUnit
from app.models.user import User
from app.models.workflow import WorkflowStep
from app.schemas.classification_review import (
    ClassificationReviewRead,
    ClassificationReviewResolvePayload,
    ClassificationReviewResolveResponse,
)
from app.schemas.document import DocumentRead, NeedsReviewDocument
from app.schemas.imports import ImportJobItemRead
from app.services.space_path_builder import SpacePathBuilder
from app.services.storage.factory import get_storage_service


@dataclass
class ClassificationReviewResolutionOutcome:
    review: ClassificationReview
    document: Document
    workflow_relaunched: bool = False
    dispatch_payload: Optional[dict] = None
    ocr_payload: Optional[tuple[str, str, str]] = None
    post_commit_delete_paths: list[str] = field(default_factory=list)
    rollback_delete_paths: list[str] = field(default_factory=list)
    rollback_renames: list[tuple[str, str]] = field(default_factory=list)


class ClassificationReviewService:
    """Orchestrate manual review of documents or staged import items pending classification."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.path_builder = SpacePathBuilder(db)
        self.storage_service = get_storage_service()

    async def list_open_reviews(self, *, tenant_id: UUID) -> List[ClassificationReviewRead]:
        reviews = await self._load_open_reviews(tenant_id=tenant_id)
        return [self._to_review_read(review) for review in reviews]

    async def list_legacy_needs_review_documents(
        self, *, tenant_id: UUID
    ) -> List[NeedsReviewDocument]:
        documents = await self._load_reviewable_documents(tenant_id=tenant_id)
        return [
            NeedsReviewDocument(
                **DocumentRead.model_validate(document).model_dump(),
                arbitration_reason=await self._resolve_arbitration_reason(document),
            )
            for document in documents
        ]

    async def ensure_open_review_for_document(
        self,
        *,
        document: Document,
    ) -> ClassificationReview:
        arbitration_reason = await self._resolve_arbitration_reason(document)
        return await self._ensure_open_review_for_document(
            document=document,
            arbitration_reason=arbitration_reason,
        )

    async def ensure_open_review_for_import_item(
        self,
        *,
        item: ImportJobItem,
    ) -> ClassificationReview:
        if item.import_job is None:
            item = await self._get_import_item_for_review(
                import_job_item_id=item.id,
                tenant_id=None,
                for_update=False,
            )

        result = await self.db.execute(
            select(ClassificationReview).where(
                ClassificationReview.import_job_item_id == item.id,
            )
        )
        review = result.scalar_one_or_none()
        if review is None:
            review = ClassificationReview(
                tenant_id=item.import_job.tenant_id,
                import_job_item_id=item.id,
            )

        review.review_status = "open"
        review.arbitration_reason = self._import_item_arbitration_reason(item)
        review.suggested_domain_id = item.resolved_domain_id
        review.suggested_activity_id = item.resolved_activity_id
        review.suggested_year = item.resolved_year
        review.suggested_scope = item.resolved_scope
        review.suggested_target_org_unit_id = item.resolved_target_org_unit_id
        review.suggested_target_user_id = item.resolved_target_user_id
        review.resolved_by_id = None
        review.resolved_at = None
        review.resolution_comment = None
        self.db.add(review)
        await self.db.flush()
        return review

    async def resolve_review(
        self,
        *,
        review_id: UUID,
        payload: ClassificationReviewResolvePayload,
        current_user: User,
    ) -> ClassificationReviewResolutionOutcome:
        review = await self._get_review_or_404(
            review_id=review_id,
            tenant_id=current_user.tenant_id,
            for_update=True,
        )
        if review.review_status != "open":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Classification review is not open.",
            )

        domain = await self._get_domain_or_400(
            domain_id=payload.classification_domain_id,
            tenant_id=current_user.tenant_id,
        )
        activity = await self._get_activity_or_400(
            activity_id=payload.classification_activity_id,
            tenant_id=current_user.tenant_id,
            expected_domain_id=domain.id,
        )
        target_org_unit, target_user = await self._resolve_target(
            tenant_id=current_user.tenant_id,
            scope=payload.classification_scope,
            target_org_unit_id=payload.classification_target_org_unit_id,
            target_user_id=payload.classification_target_user_id,
        )

        if review.import_job_item_id and review.document_id is None:
            return await self._resolve_import_item_review(
                review=review,
                payload=payload,
                current_user=current_user,
                domain=domain,
                activity=activity,
                target_org_unit=target_org_unit,
                target_user=target_user,
            )

        return await self._resolve_document_review(
            review=review,
            payload=payload,
            current_user=current_user,
            domain=domain,
            activity=activity,
            target_org_unit=target_org_unit,
            target_user=target_user,
        )

    async def reload_document(self, *, document_id: UUID, tenant_id: UUID) -> Document:
        result = await self.db.execute(
            select(Document)
            .options(
                selectinload(Document.document_category),
                selectinload(Document.current_version),
                selectinload(Document.classification_domain),
                selectinload(Document.classification_activity),
            )
            .where(Document.id == document_id, Document.tenant_id == tenant_id)
        )
        document = result.scalar_one_or_none()
        if document is None:
            raise HTTPException(
                status_code=404,
                detail="Document not found after review resolution.",
            )
        return document

    def build_resolve_response(
        self,
        *,
        outcome: ClassificationReviewResolutionOutcome,
    ) -> ClassificationReviewResolveResponse:
        return ClassificationReviewResolveResponse(
            success=True,
            review_id=outcome.review.id,
            document_id=outcome.document.id,
            review_status=outcome.review.review_status,
            document_classification_status=outcome.document.classification_status,
            logical_space_path=outcome.document.logical_space_path,
            workflow_relaunched=outcome.workflow_relaunched,
            document=DocumentRead.model_validate(outcome.document),
        )

    async def _resolve_document_review(
        self,
        *,
        review: ClassificationReview,
        payload: ClassificationReviewResolvePayload,
        current_user: User,
        domain: ClassificationDomain,
        activity: ClassificationActivity,
        target_org_unit: OrgUnit,
        target_user: Optional[User],
    ) -> ClassificationReviewResolutionOutcome:
        document = await self._get_document_for_review(
            review=review,
            tenant_id=current_user.tenant_id,
            for_update=True,
        )
        if document.classification_status not in {"pending", "needs_review"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Document is not in a reviewable classification state.",
            )
        await self._ensure_not_locked_for_write(document=document, actor=current_user)

        if payload.document_category_id:
            await self._validate_category_for_tenant(
                category_id=payload.document_category_id,
                tenant_id=current_user.tenant_id,
            )
            document.document_category_id = payload.document_category_id

        rollback_renames: list[tuple[str, str]] = []
        if payload.new_filename:
            rollback_rename = self._rename_document_file(
                document=document, new_filename=payload.new_filename
            )
            if rollback_rename:
                rollback_renames.append(rollback_rename)

        logical_space_path = await self.path_builder.build_full_path(
            tenant_id=current_user.tenant_id,
            target_org_unit_id=target_org_unit.id,
            target_user_id=target_user.id if target_user else None,
            domain_name=domain.name,
            activity_name=activity.name,
            classification_year=payload.classification_year,
        )
        if not logical_space_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to build logical space path from the provided classification.",
            )

        document.classification_domain_id = domain.id
        document.classification_activity_id = activity.id
        document.classification_year = payload.classification_year
        document.classification_scope = payload.classification_scope
        document.classification_target_org_unit_id = target_org_unit.id
        document.classification_target_user_id = target_user.id if target_user else None
        document.classification_status = "classified"
        document.logical_space_path = logical_space_path

        if payload.classification_scope == "person" and target_user:
            document.owner_id = target_user.id
            document.org_unit_id = target_user.org_unit_id
        else:
            document.org_unit_id = target_org_unit.id

        review.review_status = "resolved"
        review.resolved_by_id = current_user.id
        review.resolved_at = datetime.now(timezone.utc)
        review.resolution_comment = payload.comment
        review.document_id = document.id

        self.db.add(document)
        self.db.add(review)
        self.db.add(
            self._build_review_audit_log(
                tenant_id=current_user.tenant_id,
                user_id=current_user.id,
                document=document,
                review=review,
                domain=domain,
                activity=activity,
                target_org_unit=target_org_unit,
                target_user=target_user,
                classification_year=payload.classification_year,
                classification_scope=payload.classification_scope,
                comment=payload.comment,
                workflow_relaunch_requested=payload.relaunch_workflow,
            )
        )
        await self.db.flush()

        workflow_relaunched = False
        dispatch_payload = None
        if payload.relaunch_workflow and document.processing_mode == "process":
            workflow_relaunched = not await self._has_workflow_steps(document_id=document.id)
            if workflow_relaunched:
                dispatch_payload = self._build_dispatch_payload(document)

        return ClassificationReviewResolutionOutcome(
            review=review,
            document=document,
            workflow_relaunched=workflow_relaunched,
            dispatch_payload=dispatch_payload,
            rollback_renames=rollback_renames,
        )

    async def _resolve_import_item_review(
        self,
        *,
        review: ClassificationReview,
        payload: ClassificationReviewResolvePayload,
        current_user: User,
        domain: ClassificationDomain,
        activity: ClassificationActivity,
        target_org_unit: OrgUnit,
        target_user: Optional[User],
    ) -> ClassificationReviewResolutionOutcome:
        item = await self._get_import_item_for_review(
            import_job_item_id=review.import_job_item_id,
            tenant_id=current_user.tenant_id,
            for_update=True,
        )
        if item.status not in {"pending", "needs_review"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Import item is not in a reviewable state.",
            )
        if not item.staging_file_path or not item.checksum_sha256:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The staged file is no longer available for this review.",
            )

        if payload.document_category_id:
            await self._validate_category_for_tenant(
                category_id=payload.document_category_id,
                tenant_id=current_user.tenant_id,
            )
            item.detected_document_category_id = payload.document_category_id

        final_filename = self._resolved_filename(
            requested_name=payload.new_filename,
            fallback_name=item.original_filename,
        )

        logical_space_path = await self.path_builder.build_full_path(
            tenant_id=current_user.tenant_id,
            target_org_unit_id=target_org_unit.id,
            target_user_id=target_user.id if target_user else None,
            domain_name=domain.name,
            activity_name=activity.name,
            classification_year=payload.classification_year,
        )
        if not logical_space_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to build logical space path from the provided classification.",
            )

        final_relative_path = self._build_final_relative_path(
            tenant_id=current_user.tenant_id,
            org_unit_id=target_org_unit.id,
            filename=final_filename,
        )
        if await self._is_duplicate_checksum(
            checksum=item.checksum_sha256,
            tenant_id=current_user.tenant_id,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Un fichier identique existe deja dans ce tenant.",
            )
        if not self.storage_service.copy_file(item.staging_file_path, final_relative_path):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Copie du fichier vers le stockage final impossible.",
            )

        rollback_delete_paths = [final_relative_path]
        post_commit_delete_paths = [item.staging_file_path]

        try:
            owner_id = self._resolve_owner_id_for_import_item(
                item=item,
                classification_scope=payload.classification_scope,
                target_user=target_user,
            )
            document = Document(
                title=os.path.splitext(final_filename)[0],
                file_path=final_relative_path,
                file_type=self._derive_file_type(final_filename, item.mime_type),
                file_size=item.file_size,
                mime_type=item.mime_type,
                document_category_id=item.detected_document_category_id,
                tags=["import-auto", "batch-import", "classification-review"],
                owner_id=owner_id,
                tenant_id=current_user.tenant_id,
                org_unit_id=target_org_unit.id,
                status="draft",
                processing_mode=item.import_job.processing_mode,
                classification_domain_id=domain.id,
                classification_activity_id=activity.id,
                classification_year=payload.classification_year,
                classification_scope=payload.classification_scope,
                classification_target_org_unit_id=target_org_unit.id,
                classification_target_user_id=target_user.id if target_user else None,
                classification_status="classified",
                logical_space_path=logical_space_path,
                import_job_id=item.import_job_id,
                source_relative_path=item.source_relative_path,
            )
            self.db.add(document)
            await self.db.flush()

            version = DocumentVersion(
                document_id=document.id,
                version_number="1.0",
                file_path=final_relative_path,
                file_size=item.file_size,
                mime_type=item.mime_type,
                checksum_sha256=item.checksum_sha256,
                uploaded_by_id=current_user.id,
                uploaded_at=datetime.now(timezone.utc),
            )
            self.db.add(version)
            await self.db.flush()

            document.current_version_id = version.id
            if payload.classification_scope == "person" and target_user:
                document.org_unit_id = target_user.org_unit_id

            item.original_filename = final_filename
            item.resolved_domain_id = domain.id
            item.resolved_activity_id = activity.id
            item.resolved_year = payload.classification_year
            item.resolved_scope = payload.classification_scope
            item.resolved_target_org_unit_id = target_org_unit.id
            item.resolved_target_user_id = target_user.id if target_user else None
            item.logical_space_path = logical_space_path
            item.document_id = document.id
            item.status = "imported"
            item.error_message = None

            review.document_id = document.id
            review.review_status = "resolved"
            review.resolved_by_id = current_user.id
            review.resolved_at = datetime.now(timezone.utc)
            review.resolution_comment = payload.comment
            review.suggested_domain_id = domain.id
            review.suggested_activity_id = activity.id
            review.suggested_year = payload.classification_year
            review.suggested_scope = payload.classification_scope
            review.suggested_target_org_unit_id = target_org_unit.id
            review.suggested_target_user_id = target_user.id if target_user else None

            self.db.add(item)
            self.db.add(review)
            self.db.add(document)
            self.db.add(
                self._build_review_audit_log(
                    tenant_id=current_user.tenant_id,
                    user_id=current_user.id,
                    document=document,
                    review=review,
                    domain=domain,
                    activity=activity,
                    target_org_unit=target_org_unit,
                    target_user=target_user,
                    classification_year=payload.classification_year,
                    classification_scope=payload.classification_scope,
                    comment=payload.comment,
                    workflow_relaunch_requested=payload.relaunch_workflow,
                )
            )
            await self.db.flush()
            await self._refresh_import_job_status(import_job_id=item.import_job_id)
        except Exception:
            self.storage_service.delete_file(final_relative_path)
            raise

        workflow_relaunched = False
        dispatch_payload = None
        if payload.relaunch_workflow and document.processing_mode == "process":
            workflow_relaunched = True
            dispatch_payload = self._build_dispatch_payload(document)

        ocr_payload = None
        if document.mime_type and (
            document.mime_type.startswith("image/")
            or document.mime_type == "application/pdf"
        ):
            ocr_payload = (str(document.id), document.file_path, document.mime_type)

        return ClassificationReviewResolutionOutcome(
            review=review,
            document=document,
            workflow_relaunched=workflow_relaunched,
            dispatch_payload=dispatch_payload,
            ocr_payload=ocr_payload,
            post_commit_delete_paths=post_commit_delete_paths,
            rollback_delete_paths=rollback_delete_paths,
        )

    async def _load_open_reviews(self, *, tenant_id: UUID) -> list[ClassificationReview]:
        result = await self.db.execute(
            select(ClassificationReview)
            .options(
                selectinload(ClassificationReview.document).selectinload(
                    Document.document_category
                ),
                selectinload(ClassificationReview.document).selectinload(
                    Document.current_version
                ),
                selectinload(ClassificationReview.document).selectinload(
                    Document.classification_domain
                ),
                selectinload(ClassificationReview.document).selectinload(
                    Document.classification_activity
                ),
                selectinload(ClassificationReview.import_job_item).selectinload(
                    ImportJobItem.import_job
                ),
                selectinload(ClassificationReview.import_job_item).selectinload(
                    ImportJobItem.detected_document_category
                ),
            )
            .where(
                ClassificationReview.tenant_id == tenant_id,
                ClassificationReview.review_status == "open",
            )
            .order_by(ClassificationReview.updated_at.desc())
        )
        return list(result.scalars().all())

    async def _load_reviewable_documents(self, *, tenant_id: UUID) -> List[Document]:
        result = await self.db.execute(
            select(Document)
            .options(
                selectinload(Document.document_category),
                selectinload(Document.current_version),
                selectinload(Document.classification_domain),
                selectinload(Document.classification_activity),
            )
            .where(
                Document.tenant_id == tenant_id,
                Document.classification_status.in_(("pending", "needs_review")),
                Document.deleted_at.is_(None),
            )
            .order_by(Document.created_at.desc())
        )
        return list(result.scalars().all())

    async def _ensure_open_review_for_document(
        self,
        *,
        document: Document,
        arbitration_reason: str,
    ) -> ClassificationReview:
        result = await self.db.execute(
            select(ClassificationReview).where(
                ClassificationReview.document_id == document.id,
                ClassificationReview.tenant_id == document.tenant_id,
            )
        )
        review = result.scalar_one_or_none()
        if review is None:
            review = ClassificationReview(
                tenant_id=document.tenant_id,
                document_id=document.id,
            )

        review.review_status = "open"
        review.arbitration_reason = arbitration_reason
        review.suggested_domain_id = document.classification_domain_id
        review.suggested_activity_id = document.classification_activity_id
        review.suggested_year = document.classification_year
        review.suggested_scope = document.classification_scope
        review.suggested_target_org_unit_id = document.classification_target_org_unit_id
        review.suggested_target_user_id = document.classification_target_user_id
        review.resolved_by_id = None
        review.resolved_at = None
        review.resolution_comment = None
        self.db.add(review)
        await self.db.flush()
        return review

    async def _resolve_arbitration_reason(self, document: Document) -> str:
        audit_query = (
            select(AuditLog.new_data)
            .where(
                AuditLog.table_name == "ged_rules",
                cast(AuditLog.new_data["document_id"], String) == f'"{document.id}"',
            )
            .order_by(AuditLog.created_at.desc())
            .limit(1)
        )
        audit_result = await self.db.execute(audit_query)
        latest = audit_result.scalar_one_or_none()
        if latest:
            reports = latest.get("actions", [])
            sys_report = next(
                (
                    item
                    for item in reports
                    if item.get("rule_id") == "system-arbitration"
                ),
                None,
            )
            if sys_report and sys_report.get("arbitration_reason"):
                return sys_report["arbitration_reason"]
        if document.classification_status == "needs_review":
            return (
                "Le moteur de classement a detecte une ambiguite ou une cible a verifier."
            )
        return "Aucune regle deterministe n a permis de classer ce document."

    async def _get_review_or_404(
        self,
        *,
        review_id: UUID,
        tenant_id: UUID,
        for_update: bool = False,
    ) -> ClassificationReview:
        stmt = select(ClassificationReview).where(
            ClassificationReview.id == review_id,
            ClassificationReview.tenant_id == tenant_id,
        )
        if for_update:
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        review = result.scalar_one_or_none()
        if review is None:
            raise HTTPException(status_code=404, detail="Classification review not found.")
        return review

    async def _get_document_for_review(
        self,
        *,
        review: ClassificationReview,
        tenant_id: UUID,
        for_update: bool = False,
    ) -> Document:
        if review.document_id is None:
            raise HTTPException(
                status_code=404, detail="Document linked to review not found."
            )
        stmt = (
            select(Document)
            .options(
                selectinload(Document.document_category),
                selectinload(Document.current_version),
                selectinload(Document.classification_domain),
                selectinload(Document.classification_activity),
            )
            .where(
                Document.id == review.document_id,
                Document.tenant_id == tenant_id,
            )
        )
        if for_update:
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        document = result.scalar_one_or_none()
        if document is None:
            raise HTTPException(
                status_code=404, detail="Document linked to review not found."
            )
        return document

    async def _get_import_item_for_review(
        self,
        *,
        import_job_item_id: UUID | None,
        tenant_id: UUID | None,
        for_update: bool = False,
    ) -> ImportJobItem:
        if import_job_item_id is None:
            raise HTTPException(
                status_code=404, detail="Import item linked to review not found."
            )
        stmt = (
            select(ImportJobItem)
            .options(selectinload(ImportJobItem.import_job))
            .where(ImportJobItem.id == import_job_item_id)
        )
        if tenant_id is not None:
            stmt = stmt.join(ImportJobItem.import_job).where(
                ImportJobItem.import_job.has(tenant_id=tenant_id)
            )
        if for_update:
            stmt = stmt.with_for_update()
        result = await self.db.execute(stmt)
        item = result.scalar_one_or_none()
        if item is None or item.import_job is None:
            raise HTTPException(
                status_code=404, detail="Import item linked to review not found."
            )
        return item

    async def _get_domain_or_400(
        self, *, domain_id: UUID, tenant_id: UUID
    ) -> ClassificationDomain:
        result = await self.db.execute(
            select(ClassificationDomain).where(
                ClassificationDomain.id == domain_id,
                ClassificationDomain.tenant_id == tenant_id,
                ClassificationDomain.is_active,
            )
        )
        domain = result.scalar_one_or_none()
        if domain is None:
            raise HTTPException(
                status_code=400, detail="Classification domain is invalid."
            )
        return domain

    async def _get_activity_or_400(
        self,
        *,
        activity_id: UUID,
        tenant_id: UUID,
        expected_domain_id: UUID,
    ) -> ClassificationActivity:
        result = await self.db.execute(
            select(ClassificationActivity).where(
                ClassificationActivity.id == activity_id,
                ClassificationActivity.tenant_id == tenant_id,
                ClassificationActivity.domain_id == expected_domain_id,
                ClassificationActivity.is_active,
            )
        )
        activity = result.scalar_one_or_none()
        if activity is None:
            raise HTTPException(
                status_code=400, detail="Classification activity is invalid."
            )
        return activity

    async def _resolve_target(
        self,
        *,
        tenant_id: UUID,
        scope: str,
        target_org_unit_id: Optional[UUID],
        target_user_id: Optional[UUID],
    ) -> tuple[OrgUnit, Optional[User]]:
        if scope == "person":
            if not target_user_id:
                raise HTTPException(
                    status_code=400, detail="Target user is required for person scope."
                )
            result = await self.db.execute(
                select(User).where(
                    User.id == target_user_id,
                    User.tenant_id == tenant_id,
                    User.is_active,
                )
            )
            user = result.scalar_one_or_none()
            if user is None or not user.org_unit_id:
                raise HTTPException(
                    status_code=400,
                    detail="Target user is invalid or has no org unit assigned.",
                )
            unit = await self._get_org_unit_or_400(
                org_unit_id=user.org_unit_id, tenant_id=tenant_id
            )
            return unit, user

        if not target_org_unit_id:
            raise HTTPException(
                status_code=400,
                detail="Target org unit is required for this scope.",
            )
        unit = await self._get_org_unit_or_400(
            org_unit_id=target_org_unit_id, tenant_id=tenant_id
        )
        return unit, None

    async def _get_org_unit_or_400(
        self, *, org_unit_id: UUID, tenant_id: UUID
    ) -> OrgUnit:
        result = await self.db.execute(
            select(OrgUnit).where(
                OrgUnit.id == org_unit_id,
                OrgUnit.tenant_id == tenant_id,
                OrgUnit.is_active,
            )
        )
        org_unit = result.scalar_one_or_none()
        if org_unit is None:
            raise HTTPException(status_code=400, detail="Target org unit is invalid.")
        return org_unit

    async def _validate_category_for_tenant(
        self, *, category_id: UUID, tenant_id: UUID
    ) -> None:
        result = await self.db.execute(
            select(DocumentCategory).where(
                DocumentCategory.id == category_id,
                DocumentCategory.tenant_id == tenant_id,
                DocumentCategory.is_active,
            )
        )
        category = result.scalar_one_or_none()
        if category is None:
            raise HTTPException(status_code=400, detail="Document category is invalid.")

    def _rename_document_file(
        self, *, document: Document, new_filename: str
    ) -> tuple[str, str] | None:
        current_filename = (document.file_path or "").split("/")[-1]
        current_ext = os.path.splitext(current_filename)[1]
        requested_name = new_filename.strip()
        if not requested_name:
            raise HTTPException(status_code=400, detail="new_filename cannot be empty.")
        if not os.path.splitext(requested_name)[1]:
            requested_name = f"{requested_name}{current_ext}"

        if document.file_path:
            previous_rel_path = document.file_path
            new_rel_path = self.storage_service.rename_file(
                document.file_path, requested_name
            )
            if new_rel_path:
                document.file_path = new_rel_path
                if document.current_version:
                    document.current_version.file_path = new_rel_path
                document.title = os.path.splitext(requested_name)[0]
                return new_rel_path, os.path.basename(previous_rel_path)
        document.title = os.path.splitext(requested_name)[0]
        return None

    async def _has_workflow_steps(self, *, document_id: UUID) -> bool:
        result = await self.db.execute(
            select(WorkflowStep.id)
            .where(
                WorkflowStep.document_id == document_id,
                WorkflowStep.status.in_(("current", "pending", "pending_assignment")),
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def _ensure_not_locked_for_write(self, *, document: Document, actor: User) -> None:
        now = datetime.now(timezone.utc)
        if await can_perform(actor, "documents", "manage", ctx_from_resource(document)):
            return
        if (
            document.locked_by_user_id
            and str(document.locked_by_user_id) != str(actor.id)
            and document.lock_expires_at
            and document.lock_expires_at > now
        ):
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail={
                    "error": "document_locked",
                    "message": "Ce document est verrouille par un autre utilisateur.",
                    "locked_by": str(document.locked_by_user_id),
                    "lock_expires_at": document.lock_expires_at.isoformat(),
                },
            )

    async def _is_duplicate_checksum(self, *, checksum: str | None, tenant_id: UUID) -> bool:
        if not checksum:
            return False
        result = await self.db.execute(
            select(DocumentVersion.id)
            .join(Document, Document.id == DocumentVersion.document_id)
            .where(
                DocumentVersion.checksum_sha256 == checksum,
                Document.tenant_id == tenant_id,
                Document.deleted_at.is_(None),
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def _refresh_import_job_status(self, *, import_job_id: UUID) -> None:
        job = await self.db.get(ImportJob, import_job_id)
        if job is None:
            return

        result = await self.db.execute(
            select(ImportJobItem.status).where(ImportJobItem.import_job_id == import_job_id)
        )
        statuses = list(result.scalars().all())
        has_failed = any(status == "failed" for status in statuses)
        has_pending_review = any(
            status in {"pending", "needs_review"} for status in statuses
        )
        has_incomplete = any(status == "classified" for status in statuses)

        job.error_files = sum(1 for status in statuses if status == "failed")
        if has_failed or has_pending_review or has_incomplete:
            job.status = "completed_with_errors"
        else:
            job.status = "completed"
        self.db.add(job)
        await self.db.flush()

    @staticmethod
    def _build_final_relative_path(*, tenant_id, org_unit_id, filename: str) -> str:
        safe_name = os.path.basename(filename)
        return f"{tenant_id}/{org_unit_id}/{uuid.uuid4().hex}_{safe_name}".replace(
            "\\", "/"
        )

    @staticmethod
    def _derive_file_type(filename: str, mime_type: str | None) -> str | None:
        extension = os.path.splitext(filename)[1].lower().lstrip(".")
        if extension:
            return extension[:50]
        subtype = (mime_type or "").split("/")[-1].lower().strip()
        return subtype[:50] if subtype else None

    @staticmethod
    def _resolved_filename(*, requested_name: Optional[str], fallback_name: str) -> str:
        current_ext = os.path.splitext(fallback_name)[1]
        if not requested_name or not requested_name.strip():
            return os.path.basename(fallback_name)
        cleaned = requested_name.strip()
        if not os.path.splitext(cleaned)[1]:
            cleaned = f"{cleaned}{current_ext}"
        return os.path.basename(cleaned)

    @staticmethod
    def _resolve_owner_id_for_import_item(
        *,
        item: ImportJobItem,
        classification_scope: str,
        target_user: Optional[User],
    ) -> UUID:
        if classification_scope == "person" and target_user:
            return target_user.id
        if item.import_job.source_scope == "person" and item.import_job.target_user_id:
            return item.import_job.target_user_id
        return item.import_job.created_by_id

    @staticmethod
    def _import_item_arbitration_reason(item: ImportJobItem) -> str:
        if item.error_message:
            return item.error_message
        if item.status == "needs_review":
            return (
                "Le moteur de classement a detecte une ambiguite ou une cible a verifier."
            )
        return "Aucune regle deterministe n a permis de classer ce fichier du batch."

    @staticmethod
    def _build_dispatch_payload(document: Document) -> dict:
        return {
            "document_id": str(document.id),
            "tenant_id": str(document.tenant_id),
            "document_category_id": str(document.document_category_id)
            if document.document_category_id
            else None,
            "org_unit_id": str(document.org_unit_id) if document.org_unit_id else None,
        }

    @staticmethod
    def _build_review_audit_log(
        *,
        tenant_id: UUID,
        user_id: UUID,
        document: Document,
        review: ClassificationReview,
        domain: ClassificationDomain,
        activity: ClassificationActivity,
        target_org_unit: OrgUnit,
        target_user: Optional[User],
        classification_year: int,
        classification_scope: str,
        comment: Optional[str],
        workflow_relaunch_requested: bool,
    ) -> AuditLog:
        return AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            table_name="documents",
            record_id=document.id,
            action="review_resolved",
            new_data={
                "classification_review_id": str(review.id),
                "comment": comment,
                "classification_domain_id": str(domain.id),
                "classification_activity_id": str(activity.id),
                "classification_year": classification_year,
                "classification_scope": classification_scope,
                "classification_target_org_unit_id": str(target_org_unit.id),
                "classification_target_user_id": str(target_user.id)
                if target_user
                else None,
                "logical_space_path": document.logical_space_path,
                "workflow_relaunch_requested": workflow_relaunch_requested,
            },
        )

    @staticmethod
    def _to_review_read(review: ClassificationReview) -> ClassificationReviewRead:
        document_payload = (
            DocumentRead.model_validate(review.document) if review.document else None
        )
        import_item_payload = (
            ImportJobItemRead.model_validate(review.import_job_item)
            if review.import_job_item
            else None
        )
        processing_mode = None
        if review.document:
            processing_mode = review.document.processing_mode
        elif review.import_job_item and review.import_job_item.import_job:
            processing_mode = review.import_job_item.import_job.processing_mode

        return ClassificationReviewRead(
            id=review.id,
            tenant_id=review.tenant_id,
            document_id=review.document_id,
            import_job_item_id=review.import_job_item_id,
            review_source="import_job_item"
            if review.import_job_item_id and review.document is None
            else "document",
            review_status=review.review_status,
            processing_mode=processing_mode,
            arbitration_reason=review.arbitration_reason,
            suggested_domain_id=review.suggested_domain_id,
            suggested_activity_id=review.suggested_activity_id,
            suggested_year=review.suggested_year,
            suggested_scope=review.suggested_scope,
            suggested_target_org_unit_id=review.suggested_target_org_unit_id,
            suggested_target_user_id=review.suggested_target_user_id,
            resolved_by_id=review.resolved_by_id,
            resolved_at=review.resolved_at,
            resolution_comment=review.resolution_comment,
            created_at=review.created_at,
            updated_at=review.updated_at,
            document=document_payload,
            import_job_item=import_item_payload,
        )
