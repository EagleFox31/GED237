# backend/app/services/ingestion.py
"""
Directory Ingestion Service
Scans a local directory, imports files into the GED, and triggers classification via rules + OCR.
"""

import os
import shutil
import mimetypes
import logging
from typing import List, Dict, Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.core.config import settings


logger = logging.getLogger(__name__)

# Supported file extensions for ingestion
SUPPORTED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".odt",
    ".ods",
    ".odp",
    ".txt",
    ".csv",
    ".rtf",
    ".png",
    ".jpg",
    ".jpeg",
    ".tiff",
    ".tif",
    ".bmp",
    ".gif",
    ".webp",
}


class IngestionReport:
    """Tracks results of a batch ingestion."""

    def __init__(self):
        self.total_found: int = 0
        self.imported: int = 0
        self.skipped: int = 0
        self.errors: List[Dict[str, str]] = []
        self.details: List[Dict[str, Any]] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_found": self.total_found,
            "imported": self.imported,
            "skipped": self.skipped,
            "error_count": len(self.errors),
            "errors": self.errors,
            "details": self.details,
        }


class DirectoryIngestionService:
    """
    Scans a directory, copies each supported file into GED storage,
    creates Document records, runs pre-OCR rules, and queues OCR.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.storage_base = settings.STORAGE_PATH

    async def ingest(
        self,
        source_dir: str,
        tenant_id: UUID,
        org_unit_id: UUID,
        owner_id: UUID,
        recursive: bool = True,
        document_category_id: Optional[UUID] = None,
        processing_mode: str = "process",
    ) -> IngestionReport:
        """
        Scan source_dir and import all supported files.

        Args:
            source_dir: Absolute path to the directory to scan.
            tenant_id: Tenant for multi-tenant isolation.
            org_unit_id: Organization unit to assign documents to.
            owner_id: User who owns the imported documents.
            recursive: Whether to scan subdirectories.
            document_category_id: Optional default category ID for imported docs.

        Returns:
            IngestionReport with import results.
        """
        report = IngestionReport()

        if not os.path.isdir(source_dir):
            report.errors.append(
                {"file": source_dir, "error": "Le répertoire n'existe pas"}
            )
            return report

        # Collect files
        files = self._scan_directory(source_dir, recursive)
        report.total_found = len(files)

        if not files:
            return report

        # Prepare GED storage directory
        ged_dir = f"{tenant_id}/{org_unit_id}"
        ged_full_dir = os.path.join(self.storage_base, str(ged_dir))
        os.makedirs(ged_full_dir, exist_ok=True)

        for file_path in files:
            try:
                result = await self._ingest_single_file(
                    file_path=file_path,
                    ged_dir=ged_dir,
                    tenant_id=tenant_id,
                    org_unit_id=org_unit_id,
                    owner_id=owner_id,
                    document_category_id=document_category_id,
                    processing_mode=processing_mode,
                )
                report.imported += 1
                report.details.append(result)
            except Exception as e:
                logger.error(f"[Ingestion] Failed to ingest {file_path}: {e}")
                report.errors.append({"file": file_path, "error": str(e)})

        report.skipped = report.total_found - report.imported - len(report.errors)
        return report

    def _scan_directory(self, source_dir: str, recursive: bool) -> List[str]:
        """Return list of supported file paths in source_dir."""
        files: List[str] = []

        if recursive:
            for root, _dirs, filenames in os.walk(source_dir):
                for name in filenames:
                    ext = os.path.splitext(name)[1].lower()
                    if ext in SUPPORTED_EXTENSIONS:
                        files.append(os.path.join(root, name))
        else:
            for name in os.listdir(source_dir):
                full = os.path.join(source_dir, name)
                if os.path.isfile(full):
                    ext = os.path.splitext(name)[1].lower()
                    if ext in SUPPORTED_EXTENSIONS:
                        files.append(full)

        return sorted(files)

    async def _ingest_single_file(
        self,
        file_path: str,
        ged_dir: str,
        tenant_id: UUID,
        org_unit_id: UUID,
        owner_id: UUID,
        document_category_id: Optional[UUID],
        processing_mode: str = "process",
    ) -> Dict[str, Any]:
        """
        Import a single file: copy to storage, create Document, run rules, queue OCR.
        """
        filename = os.path.basename(file_path)
        file_ext = os.path.splitext(filename)[1].lower()
        file_size = os.path.getsize(file_path)
        mime_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"

        # 1. Copy file to GED storage
        relative_path = os.path.join(ged_dir, filename).replace("\\", "/")
        dest_path = os.path.join(self.storage_base, relative_path)

        # Handle duplicate filenames by appending a suffix
        if os.path.exists(dest_path):
            base, ext = os.path.splitext(filename)
            counter = 1
            while os.path.exists(dest_path):
                filename = f"{base}_{counter}{ext}"
                relative_path = os.path.join(ged_dir, filename).replace("\\", "/")
                dest_path = os.path.join(self.storage_base, relative_path)
                counter += 1

        shutil.copy2(file_path, dest_path)

        # 2. Create Document record
        title = (
            os.path.splitext(os.path.basename(file_path))[0]
            .replace("_", " ")
            .replace("-", " ")
            .title()
        )

        document = Document(
            title=title,
            file_path=relative_path,
            file_type=mime_type,
            file_size=file_size,
            mime_type=mime_type,
            document_category_id=document_category_id,
            tags=["import-auto"],
            owner_id=owner_id,
            tenant_id=tenant_id,
            org_unit_id=org_unit_id,
            status="draft",
            processing_mode=processing_mode,
            extra_data={"source_path": file_path, "ingestion": "directory"},
        )

        self.db.add(document)
        await self.db.commit()
        await self.db.refresh(document)

        # 2b. Dispatch Event for GEDRules / Routing — sauté en mode 'archive'.
        if processing_mode == "process":
            from app.core.events.dispatcher import dispatcher

            await dispatcher.dispatch(
                "DOCUMENT_CREATED",
                {
                    "document_id": str(document.id),
                    "tenant_id": str(document.tenant_id),
                    "document_category_id": str(document.document_category_id)
                    if document.document_category_id
                    else None,
                    "org_unit_id": str(document.org_unit_id)
                    if document.org_unit_id
                    else None,
                },
            )

        # 3. Supprimé: Ancien pre-OCR rules (rule_runner)

        # 4. Queue OCR for images and PDFs (lazy import to avoid Celery at module level)
        ocr_queued = False
        if mime_type.startswith("image/") or mime_type == "application/pdf":
            try:
                from app.workers.tasks import process_document_ocr

                process_document_ocr.delay(str(document.id), relative_path, mime_type)
                ocr_queued = True
            except Exception as e:
                logger.warning(
                    f"[Ingestion] Could not queue OCR for {document.id}: {e}"
                )

        matched_rules = []

        return {
            "document_id": str(document.id),
            "filename": filename,
            "title": title,
            "mime_type": mime_type,
            "file_size": file_size,
            "rules_matched": matched_rules,
            "ocr_queued": ocr_queued,
        }
