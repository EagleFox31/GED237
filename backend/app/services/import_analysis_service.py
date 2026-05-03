import json
import os
import uuid
from dataclasses import replace
from typing import Iterable

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.import_job import ImportJob
from app.models.import_job_item import ImportJobItem
from app.services.classification_rule_engine import (
    ClassificationStatus,
    ClassificationResolution,
    ClassificationRuleEngine,
)
from app.services.ingestion import SUPPORTED_EXTENSIONS
from app.services.space_path_builder import SpacePathBuilder
from app.services.storage.factory import get_storage_service


class ImportAnalysisService:
    """Analyze and stage one batch import without creating final documents."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.storage_service = get_storage_service()
        self.path_builder = SpacePathBuilder(db)

    async def analyze(
        self,
        *,
        job: ImportJob,
        files: list[UploadFile],
        source_relative_paths_raw: str | None = None,
    ) -> ImportJob:
        source_relative_paths = self._parse_source_relative_paths(
            source_relative_paths_raw, len(files)
        )
        engine = ClassificationRuleEngine(self.db)
        seen_checksums: set[str] = set()

        job.total_files = len(files)
        job.supported_files = 0
        job.ignored_files = 0
        job.duplicate_files = 0
        job.error_files = 0

        for index, file in enumerate(files):
            source_relative_path = source_relative_paths[index] if index < len(source_relative_paths) else None
            source_relative_path = source_relative_path or file.filename or f"file-{index + 1}"
            original_filename = os.path.basename(source_relative_path) or file.filename or f"file-{index + 1}"
            extension = os.path.splitext(original_filename)[1].lower()
            mime_type = file.content_type or "application/octet-stream"
            file_size = await self._file_size(file)

            try:
                item = ImportJobItem(
                    import_job_id=job.id,
                    original_filename=original_filename,
                    source_relative_path=source_relative_path,
                    mime_type=mime_type,
                    file_size=file_size,
                    detected_document_category_id=job.default_document_category_id,
                    status="pending",
                )
                self.db.add(item)
                await self.db.flush()

                if extension not in SUPPORTED_EXTENSIONS:
                    item.status = "ignored"
                    item.error_message = "Format non supporte par l'import de masse."
                    job.ignored_files += 1
                    continue

                job.supported_files += 1

                staging_name = f"{index + 1:05d}_{uuid.uuid4().hex}_{original_filename}"
                original_upload_name = file.filename
                try:
                    file.filename = staging_name
                    staging_directory = f"imports/staging/{job.tenant_id}/{job.id}"
                    staging_path, checksum = await self.storage_service.save_file_with_checksum(
                        file, directory=staging_directory
                    )
                    item.staging_file_path = staging_path
                    item.checksum_sha256 = checksum
                finally:
                    file.filename = original_upload_name
                    await file.seek(0)

                if await self._is_duplicate(
                    checksum=item.checksum_sha256, tenant_id=job.tenant_id
                ):
                    item.status = "duplicate"
                    item.error_message = "Un fichier identique existe deja dans ce tenant."
                    if item.staging_file_path:
                        self.storage_service.delete_file(item.staging_file_path)
                    job.duplicate_files += 1
                    continue
                if item.checksum_sha256 in seen_checksums:
                    item.status = "duplicate"
                    item.error_message = (
                        "Ce fichier est present plusieurs fois dans le meme batch."
                    )
                    if item.staging_file_path:
                        self.storage_service.delete_file(item.staging_file_path)
                    job.duplicate_files += 1
                    continue
                seen_checksums.add(item.checksum_sha256)

                resolution = await engine.simulate(
                    tenant_id=job.tenant_id,
                    document_category_id=job.default_document_category_id,
                    source_scope=job.source_scope,
                    source_org_unit_id=job.target_org_unit_id,
                    source_user_id=job.target_user_id,
                    filename=source_relative_path,
                    mime_type=mime_type,
                )
                resolution = await self._apply_forced_year(
                    resolution,
                    tenant_id=job.tenant_id,
                    source_scope=job.source_scope,
                    source_org_unit_id=job.target_org_unit_id,
                    source_user_id=job.target_user_id,
                    forced_year=job.forced_year,
                )
                self._apply_resolution_to_item(item, resolution)
            except Exception as exc:
                item.status = "failed"
                item.error_message = str(exc)
                if item.staging_file_path:
                    self.storage_service.delete_file(item.staging_file_path)
                job.error_files += 1

        job.status = "analyzed"
        await self.db.flush()
        return job

    @staticmethod
    def _parse_source_relative_paths(raw: str | None, expected: int) -> list[str]:
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError("source_relative_paths must be valid JSON") from exc
        if not isinstance(parsed, list):
            raise ValueError("source_relative_paths must be a JSON array")
        values = [str(value) for value in parsed]
        if len(values) != expected:
            raise ValueError(
                "source_relative_paths length must match the number of uploaded files"
            )
        return values

    @staticmethod
    async def _file_size(file: UploadFile) -> int:
        file.file.seek(0, os.SEEK_END)
        size = file.file.tell()
        await file.seek(0)
        return int(size or 0)

    async def _is_duplicate(self, *, checksum: str | None, tenant_id) -> bool:
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

    async def _apply_forced_year(
        self,
        resolution: ClassificationResolution,
        *,
        tenant_id,
        source_scope: str,
        source_org_unit_id,
        source_user_id,
        forced_year: int | None,
    ) -> ClassificationResolution:
        if forced_year is None:
            return resolution
        updated = replace(resolution, classification_year=forced_year)
        if updated.status == ClassificationStatus.classified:
            updated.logical_space_path = await self.path_builder.build_full_path(
                tenant_id=tenant_id,
                target_org_unit_id=updated.target_org_unit.id
                if updated.target_org_unit
                else None,
                target_user_id=updated.target_user.id if updated.target_user else None,
                domain_name=updated.domain.name if updated.domain else None,
                activity_name=updated.activity.name if updated.activity else None,
                classification_year=forced_year,
            )
        else:
            pending_label = (
                "A revoir"
                if updated.status == ClassificationStatus.needs_review
                else SpacePathBuilder.PENDING_LABEL
            )
            updated.logical_space_path = await self.path_builder.build_pending_full_path(
                tenant_id=tenant_id,
                target_org_unit_id=source_org_unit_id,
                target_user_id=source_user_id if source_scope == "person" else None,
                classification_year=forced_year,
                pending_label=pending_label,
            )
        return updated

    @staticmethod
    def _apply_resolution_to_item(
        item: ImportJobItem,
        resolution: ClassificationResolution,
    ) -> None:
        if resolution.rule and resolution.rule.workflow_template_id:
            item.workflow_template_id = resolution.rule.workflow_template_id
        if resolution.domain:
            item.resolved_domain_id = resolution.domain.id
        if resolution.activity:
            item.resolved_activity_id = resolution.activity.id
        if resolution.target_org_unit:
            item.resolved_target_org_unit_id = resolution.target_org_unit.id
        if resolution.target_user:
            item.resolved_target_user_id = resolution.target_user.id
        item.resolved_scope = resolution.target_scope
        item.resolved_year = resolution.classification_year
        item.logical_space_path = resolution.logical_space_path

        if resolution.status == "classified":
            item.status = "classified"
            item.error_message = None
        elif resolution.status == "needs_review":
            item.status = "needs_review"
            item.error_message = resolution.message
        elif resolution.status == "no_rule":
            item.status = "pending"
            item.error_message = resolution.message
        else:
            item.status = "needs_review"
            item.error_message = resolution.message
