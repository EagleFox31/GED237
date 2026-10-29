import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.import_job import ImportJob
from app.models.import_job_item import ImportJobItem
from app.models.user import User
from app.services.classification_review_service import ClassificationReviewService
from app.services.storage.factory import get_storage_service


@dataclass
class ImportExecutionSummary:
    imported_documents: int = 0
    pending_review_items: int = 0
    failed_items: int = 0
    dispatch_payloads: list[dict] = field(default_factory=list)
    ocr_payloads: list[tuple[str, str, str]] = field(default_factory=list)
    post_commit_delete_paths: list[str] = field(default_factory=list)
    rollback_delete_paths: list[str] = field(default_factory=list)


class ImportExecutionService:
    """Commit one analyzed import job into final documents."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.storage_service = get_storage_service()

    async def commit(self, *, job: ImportJob) -> ImportExecutionSummary:
        summary = ImportExecutionSummary()
        review_service = ClassificationReviewService(self.db)

        job.status = "running"
        await self.db.flush()

        for item in job.items:
            if item.status in {"duplicate", "ignored", "failed", "imported"}:
                if item.status == "failed":
                    summary.failed_items += 1
                continue

            if item.status in {"pending", "needs_review"}:
                if not item.staging_file_path or not item.checksum_sha256:
                    item.status = "failed"
                    item.error_message = "Fichier de staging introuvable pour cet item en attente de revue."
                    summary.failed_items += 1
                    continue
                await review_service.ensure_open_review_for_import_item(item=item)
                summary.pending_review_items += 1
                continue

            if not item.staging_file_path or not item.checksum_sha256:
                item.status = "failed"
                item.error_message = "Fichier de staging introuvable pour cet item."
                summary.failed_items += 1
                continue

            final_relative_path: str | None = None
            try:
                owner_id, target_org_unit_id = await self._resolve_document_ownership(
                    job=job, item=item
                )
                final_relative_path = self._build_final_relative_path(
                    tenant_id=job.tenant_id,
                    org_unit_id=target_org_unit_id,
                    original_filename=item.original_filename,
                )

                if await self._is_duplicate(item, tenant_id=job.tenant_id):
                    item.status = "duplicate"
                    item.error_message = (
                        "Un fichier identique existe deja dans ce tenant."
                    )
                    job.duplicate_files += 1
                    summary.post_commit_delete_paths.append(item.staging_file_path)
                    continue

                copied = self.storage_service.copy_file(
                    item.staging_file_path, final_relative_path
                )
                if not copied:
                    raise RuntimeError(
                        "Copie du fichier vers le stockage final impossible."
                    )
                summary.rollback_delete_paths.append(final_relative_path)

                document = Document(
                    title=os.path.splitext(item.original_filename)[0],
                    file_path=final_relative_path,
                    file_type=self._derive_file_type(
                        item.original_filename, item.mime_type
                    ),
                    file_size=item.file_size,
                    mime_type=item.mime_type,
                    document_category_id=item.detected_document_category_id,
                    tags=["import-auto", "batch-import"],
                    owner_id=owner_id,
                    tenant_id=job.tenant_id,
                    org_unit_id=target_org_unit_id,
                    status="draft",
                    processing_mode=job.processing_mode,
                    classification_domain_id=item.resolved_domain_id,
                    classification_activity_id=item.resolved_activity_id,
                    classification_year=item.resolved_year,
                    classification_scope=item.resolved_scope or "service",
                    classification_target_org_unit_id=item.resolved_target_org_unit_id,
                    classification_target_user_id=item.resolved_target_user_id,
                    classification_status=self._document_classification_status(item),
                    logical_space_path=item.logical_space_path,
                    import_job_id=job.id,
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
                    uploaded_by_id=job.created_by_id,
                    uploaded_at=datetime.now(timezone.utc),
                )
                self.db.add(version)
                await self.db.flush()

                document.current_version_id = version.id
                item.document_id = document.id
                item.status = "imported"
                item.error_message = None
                summary.post_commit_delete_paths.append(item.staging_file_path)
                summary.imported_documents += 1

                if (
                    job.processing_mode == "process"
                    and document.classification_status == "classified"
                ):
                    summary.dispatch_payloads.append(
                        {
                            "document_id": str(document.id),
                            "tenant_id": str(document.tenant_id),
                            "document_category_id": str(document.document_category_id)
                            if document.document_category_id
                            else None,
                            "org_unit_id": str(document.org_unit_id)
                            if document.org_unit_id
                            else None,
                        }
                    )

                if document.mime_type and (
                    document.mime_type.startswith("image/")
                    or document.mime_type == "application/pdf"
                ):
                    summary.ocr_payloads.append(
                        (str(document.id), document.file_path, document.mime_type)
                    )
            except Exception as exc:
                if final_relative_path:
                    self.storage_service.delete_file(final_relative_path)
                    summary.rollback_delete_paths = [
                        path
                        for path in summary.rollback_delete_paths
                        if path != final_relative_path
                    ]
                item.status = "failed"
                item.error_message = str(exc)
                summary.failed_items += 1

        job.error_files = summary.failed_items
        if summary.failed_items or summary.pending_review_items:
            job.status = "completed_with_errors"
        else:
            job.status = "completed"
        await self.db.flush()
        return summary

    async def _is_duplicate(self, item: ImportJobItem, *, tenant_id) -> bool:
        result = await self.db.execute(
            select(DocumentVersion.id)
            .join(Document, Document.id == DocumentVersion.document_id)
            .where(
                DocumentVersion.checksum_sha256 == item.checksum_sha256,
                Document.tenant_id == tenant_id,
                Document.deleted_at.is_(None),
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def _resolve_document_ownership(
        self,
        *,
        job: ImportJob,
        item: ImportJobItem,
    ) -> tuple[uuid.UUID, uuid.UUID]:
        owner_id = job.created_by_id
        if item.resolved_scope == "person" and item.resolved_target_user_id:
            owner_id = item.resolved_target_user_id
        elif job.source_scope == "person" and job.target_user_id:
            owner_id = job.target_user_id

        if item.resolved_target_org_unit_id:
            return owner_id, item.resolved_target_org_unit_id

        user = await self.db.get(User, owner_id)
        if user and user.org_unit_id:
            return owner_id, user.org_unit_id
        if job.target_org_unit_id:
            return owner_id, job.target_org_unit_id
        raise RuntimeError(
            "Impossible de determiner l'unite organisationnelle du document."
        )

    @staticmethod
    def _build_final_relative_path(
        *, tenant_id, org_unit_id, original_filename: str
    ) -> str:
        safe_name = os.path.basename(original_filename)
        return f"{tenant_id}/{org_unit_id}/{uuid.uuid4().hex}_{safe_name}".replace(
            "\\", "/"
        )

    @staticmethod
    def _document_classification_status(item: ImportJobItem) -> str:
        if item.status in {"classified", "imported"}:
            return "classified"
        if item.status == "needs_review":
            return "needs_review"
        if item.status == "pending":
            return "pending"
        return "rejected"

    @staticmethod
    def _derive_file_type(filename: str, mime_type: str | None) -> str | None:
        extension = os.path.splitext(filename)[1].lower().lstrip(".")
        if extension:
            return extension[:50]
        subtype = (mime_type or "").split("/")[-1].lower().strip()
        return subtype[:50] if subtype else None
