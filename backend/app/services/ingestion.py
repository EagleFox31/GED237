# backend/app/services/ingestion.py
"""
Directory Ingestion Service
Scans a local directory, imports files into the GED, and triggers classification via rules + OCR.
"""

import hashlib
import os
import shutil
import mimetypes
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Dict, Any, Optional
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.document import Document
from app.services.classification_rule_engine import ClassificationRuleEngine
from app.models.document_version import DocumentVersion
from app.models.ingest_run import IngestRun, IngestRunFile
from app.core.config import settings
from app.core.errors.domain import (
    IngestPathForbiddenError,
    IngestRunInProgressError,
)


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
        # Files already in the GED (same SHA-256 in the tenant): counted in skipped.
        self.duplicates: List[Dict[str, str]] = []
        # Tracked imports only: the run, and the files a previous request already
        # recorded (counted in skipped, neither hashed nor audited again).
        self.run_id: Optional[str] = None
        self.already_done: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "already_done": self.already_done,
            "total_found": self.total_found,
            "imported": self.imported,
            "skipped": self.skipped,
            "error_count": len(self.errors),
            "errors": self.errors,
            "details": self.details,
            "duplicate_count": len(self.duplicates),
            "duplicates": self.duplicates,
        }


# A tracked file in one of these states is in the GED: a resumed run skips it.
DONE_STATUSES = ("imported", "duplicate")
# A run that ended with failed files stays "partial": the same request retries
# those files only. "completed" means every file is in the GED.
RESUMABLE_STATUSES = ("running", "partial")
# A "running" run with a heartbeat this recent is live: the same request is
# refused (409). Older, it was cut and the request resumes it. Each file bumps
# the heartbeat; one file (hash, copy, version) stays well under this.
RUN_ALIVE_WINDOW = timedelta(minutes=5)


def _derive_file_type(filename: str, mime_type: str) -> str | None:
    extension = os.path.splitext(filename)[1].lower().lstrip(".")
    if extension:
        return extension[:50]
    subtype = (mime_type or "").split("/")[-1].lower().strip()
    return subtype[:50] if subtype else None


def _sha256_of(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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
        exclude_dirs: Iterable[str] = (),
        settle_seconds: int = 0,
        track: bool = False,
    ) -> IngestionReport:
        """
        Scan source_dir and import all supported files.

        With ``track``, each file's outcome is recorded with its document (see
        ``app.models.ingest_run``): the same request after an interruption resumes
        the unfinished run and retries only the files not yet in the GED.

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

        requested = source_dir
        source_dir, root = self.resolve_source_dir(requested)

        if not os.path.isdir(source_dir):
            report.errors.append(
                {"file": requested, "error": "Le répertoire n'existe pas"}
            )
            return report

        # Collect files (links escaping the root are reported, not imported)
        files, rejected = self._scan_directory(
            source_dir,
            recursive,
            root,
            exclude_dirs=set(exclude_dirs),
            settle_seconds=settle_seconds,
        )
        for path in rejected:
            report.errors.append(
                {"file": path, "error": "Lien hors des emplacements autorisés"}
            )
        report.total_found = len(files) + len(rejected)

        if not files:
            return report

        # Prepare GED storage directory
        ged_dir = f"{tenant_id}/{org_unit_id}"
        ged_full_dir = os.path.join(self.storage_base, str(ged_dir))
        os.makedirs(ged_full_dir, exist_ok=True)

        run_id, done, failed = None, set(), 0
        if track:
            run_id, done = await self._open_run(
                source_dir=source_dir,
                tenant_id=tenant_id,
                org_unit_id=org_unit_id,
                owner_id=owner_id,
                recursive=recursive,
                document_category_id=document_category_id,
                processing_mode=processing_mode,
                total_found=report.total_found,
            )
            report.run_id = str(run_id)

        for file_path in files:
            if file_path in done:
                report.already_done += 1
                continue
            try:
                result = await self._ingest_single_file(
                    file_path=file_path,
                    ged_dir=ged_dir,
                    tenant_id=tenant_id,
                    org_unit_id=org_unit_id,
                    owner_id=owner_id,
                    document_category_id=document_category_id,
                    processing_mode=processing_mode,
                    run_id=run_id,
                )
                if "duplicate_of" in result:
                    report.duplicates.append(result)
                    continue
                report.imported += 1
                report.details.append(result)
            except Exception as e:
                # A failed flush leaves the session unusable: the next files need it.
                await self.db.rollback()
                logger.error(f"[Ingestion] Failed to ingest {file_path}: {e}")
                report.errors.append({"file": file_path, "error": str(e)})
                failed += 1
                if run_id is not None:
                    await self._record_error(run_id, file_path, str(e))

        if run_id is not None:
            await self.db.execute(
                update(IngestRun)
                .where(IngestRun.id == run_id)
                .values(
                    status="partial" if failed else "completed",
                    finished_at=func.now(),
                )
            )
            await self.db.commit()
        report.skipped = report.total_found - report.imported - len(report.errors)
        return report

    # ── Resumable runs (tracked imports) ──────────────────────────────

    @staticmethod
    def _run_lock_key(*params) -> str:
        """Advisory-lock key of one import (same request, same key)."""
        return "ingest-run:" + ":".join(str(p) for p in params)

    async def _open_run(
        self,
        *,
        source_dir: str,
        tenant_id: UUID,
        org_unit_id: UUID,
        owner_id: UUID,
        recursive: bool,
        document_category_id: Optional[UUID],
        processing_mode: str,
        total_found: int,
    ) -> tuple[UUID, set[str]]:
        """The unfinished run with the same parameters, or a new one, and the
        source paths it already brought into the GED (imported or duplicate).

        Raises ``IngestRunInProgressError`` while another request runs the same
        import: the lock serialises the opening, the heartbeat tells a live run
        from one that was cut."""
        key = self._run_lock_key(
            tenant_id,
            owner_id,
            org_unit_id,
            source_dir,
            recursive,
            processing_mode,
            document_category_id,
        )
        locked = await self.db.scalar(
            select(func.pg_try_advisory_xact_lock(func.hashtext(key)))
        )
        if not locked:
            await self.db.rollback()
            raise IngestRunInProgressError(technical_detail=f"lock busy: {key}")
        run = (
            await self.db.execute(
                select(IngestRun)
                .where(
                    IngestRun.tenant_id == tenant_id,
                    IngestRun.owner_id == owner_id,
                    IngestRun.org_unit_id == org_unit_id,
                    IngestRun.source_dir == source_dir,
                    IngestRun.recursive.is_(recursive),
                    IngestRun.processing_mode == processing_mode,
                    IngestRun.document_category_id.is_not_distinct_from(
                        document_category_id
                    ),
                    IngestRun.status.in_(RESUMABLE_STATUSES),
                )
                .order_by(IngestRun.started_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if run is None:
            run = IngestRun(
                tenant_id=tenant_id,
                owner_id=owner_id,
                org_unit_id=org_unit_id,
                source_dir=source_dir,
                recursive=recursive,
                processing_mode=processing_mode,
                document_category_id=document_category_id,
                status="running",
                total_found=total_found,
                attempts=1,
            )
            self.db.add(run)
            await self.db.flush()
            done: set[str] = set()
        else:
            if run.status == "running" and await self.db.scalar(
                select(IngestRun.heartbeat_at > func.now() - RUN_ALIVE_WINDOW).where(
                    IngestRun.id == run.id
                )
            ):
                await self.db.rollback()
                raise IngestRunInProgressError(technical_detail=f"run {run.id} alive")
            run.attempts = (run.attempts or 1) + 1
            run.heartbeat_at = func.now()
            run.status, run.finished_at = "running", None
            run.total_found = total_found
            done = set(
                (
                    await self.db.execute(
                        select(IngestRunFile.source_path).where(
                            IngestRunFile.run_id == run.id,
                            IngestRunFile.status.in_(DONE_STATUSES),
                        )
                    )
                )
                .scalars()
                .all()
            )
        run_id = run.id
        await self.db.commit()
        return run_id, done

    async def _record_error(self, run_id: UUID, source_path: str, error: str) -> None:
        """Keep the failure for the report; never stops the import."""
        try:
            await self._record(run_id, source_path, "error", error=error)
            await self.db.commit()
        except Exception:  # noqa: BLE001 - the file stays retried on resume
            await self.db.rollback()
            logger.exception(
                "[Ingestion] could not record the failure of %s", source_path
            )

    async def _record(
        self,
        run_id: UUID,
        source_path: str,
        status: str,
        *,
        document_id: Optional[UUID] = None,
        error: Optional[str] = None,
    ) -> None:
        """Upsert the file's line; the caller commits it with the document."""
        values = {
            "status": status,
            "document_id": document_id,
            "error": error[:500] if error else None,
        }
        await self.db.execute(
            pg_insert(IngestRunFile)
            .values(run_id=run_id, source_path=source_path, **values)
            .on_conflict_do_update(
                constraint="uq_ingest_run_files_path",
                set_={**values, "updated_at": func.now()},
            )
        )
        await self.db.execute(
            update(IngestRun)
            .where(IngestRun.id == run_id)
            .values(heartbeat_at=func.now())
        )

    # ── Allowed roots (INGEST_ALLOWED_ROOTS) ──────────────────────────

    @staticmethod
    def _allowed_roots() -> List[str]:
        """Real paths of the configured roots; missing ones are skipped with a warning."""
        roots: List[str] = []
        for raw in settings.INGEST_ALLOWED_ROOTS:
            real = os.path.realpath(raw)
            if os.path.isdir(real):
                roots.append(real)
            else:
                logger.warning(
                    "[Ingestion] INGEST_ALLOWED_ROOTS entry ignored, not a directory: %s",
                    raw,
                )
        return roots

    @staticmethod
    def _is_under(real_path: str, real_root: str) -> bool:
        """True when real_path is real_root or below it (no prefix trick: /root-bis)."""
        try:
            return os.path.commonpath([real_path, real_root]) == real_root
        except ValueError:  # different drives (Windows)
            return False

    def resolve_source_dir(self, requested: str) -> tuple[str, str]:
        """Map the requested directory onto an allowed root.

        A relative path is resolved against the first root. ``realpath`` on both
        sides neutralises ``..`` and symlinks, ``commonpath`` rejects look-alike
        prefixes. Returns (real_source_dir, real_root) or raises
        IngestPathForbiddenError, including when no root is configured.
        """
        roots = self._allowed_roots()
        candidate = (requested or "").strip()
        if not roots or not candidate or candidate in (".", ".."):
            raise IngestPathForbiddenError(requested)
        if not os.path.isabs(candidate):
            candidate = os.path.join(roots[0], candidate)
        real = os.path.realpath(candidate)
        for root in roots:
            if self._is_under(real, root):
                return real, root
        raise IngestPathForbiddenError(requested)

    def _scan_directory(
        self,
        source_dir: str,
        recursive: bool,
        root: str,
        *,
        exclude_dirs: set[str] | None = None,
        settle_seconds: int = 0,
    ) -> tuple[List[str], List[str]]:
        """Return (supported files under root, supported files whose target escapes root).

        ``exclude_dirs`` names are pruned at any depth; with ``settle_seconds``, files
        modified more recently are left for a later pass (still being copied).
        """
        candidates: List[str] = []
        exclude_dirs = exclude_dirs or set()

        if recursive:
            for dirpath, dirs, filenames in os.walk(source_dir, followlinks=False):
                dirs[:] = [d for d in dirs if d not in exclude_dirs]
                for name in filenames:
                    ext = os.path.splitext(name)[1].lower()
                    if ext in SUPPORTED_EXTENSIONS:
                        candidates.append(os.path.join(dirpath, name))
        else:
            for name in os.listdir(source_dir):
                full = os.path.join(source_dir, name)
                if os.path.isfile(full):
                    ext = os.path.splitext(name)[1].lower()
                    if ext in SUPPORTED_EXTENSIONS:
                        candidates.append(full)

        if settle_seconds > 0:
            settled_before = time.time() - settle_seconds
            candidates = [
                p for p in candidates if os.path.getmtime(p) <= settled_before
            ]

        files: List[str] = []
        rejected: List[str] = []
        for path in sorted(candidates):
            # A file symlink is followed at copy time: check where it really points.
            if self._is_under(os.path.realpath(path), root):
                files.append(path)
            else:
                rejected.append(path)
        return files, rejected

    async def _ingest_single_file(
        self,
        file_path: str,
        ged_dir: str,
        tenant_id: UUID,
        org_unit_id: UUID,
        owner_id: UUID,
        document_category_id: Optional[UUID],
        processing_mode: str = "process",
        run_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Import a single file: copy to storage, create Document, run rules, queue OCR.
        With ``run_id``, the file's line is committed in the same transaction.
        """
        filename = os.path.basename(file_path)
        file_size = os.path.getsize(file_path)
        mime_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"

        # 0. Same content already in the tenant: not imported again (rescan, copy).
        checksum = _sha256_of(file_path)
        existing = await self.db.execute(
            select(DocumentVersion)
            .join(Document, Document.id == DocumentVersion.document_id)
            .where(
                DocumentVersion.checksum_sha256 == checksum,
                Document.tenant_id == tenant_id,
                Document.deleted_at.is_(None),
            )
            .limit(1)
        )
        duplicate = existing.scalar_one_or_none()
        if duplicate is not None:
            # Same audit row as a refused upload: counted by the duplicates KPI.
            self.db.add(
                AuditLog(
                    tenant_id=tenant_id,
                    user_id=owner_id,
                    table_name="documents",
                    record_id=duplicate.document_id,
                    action="dup_detected",
                    new_data={
                        "checksum_sha256": checksum,
                        "attempted_filename": filename,
                        "during": "ingestion",
                    },
                )
            )
            if run_id is not None:
                await self._record(
                    run_id, file_path, "duplicate", document_id=duplicate.document_id
                )
            await self.db.commit()
            return {
                "duplicate_of": str(duplicate.document_id),
                "filename": filename,
                "source_path": file_path,
            }

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
        file_type = _derive_file_type(filename, mime_type)

        document = Document(
            title=title,
            file_path=relative_path,
            file_type=file_type,
            file_size=file_size,
            mime_type=mime_type,
            document_category_id=document_category_id,
            tags=["import-auto"],
            owner_id=owner_id,
            tenant_id=tenant_id,
            org_unit_id=org_unit_id,
            status="draft",
            processing_mode=processing_mode,
            extra_data={
                "source_path": file_path,
                "ingestion": "directory",
                # Not classified here: the pass after OCR classifies it with every rule.
                **ClassificationRuleEngine.classification_inputs(
                    source_scope="service",
                    source_user_id=owner_id,
                    filename=os.path.basename(file_path),
                    mime_type=mime_type,
                ),
            },
        )

        self.db.add(document)
        await self.db.flush()
        # First version carries the checksum, as on upload: later passes see the duplicate.
        version = DocumentVersion(
            document_id=document.id,
            version_number="1.0",
            file_path=relative_path,
            file_size=file_size,
            mime_type=mime_type,
            checksum_sha256=checksum,
            uploaded_by_id=owner_id,
            uploaded_at=datetime.now(timezone.utc),
        )
        self.db.add(version)
        await self.db.flush()
        document.current_version_id = version.id
        if run_id is not None:
            await self._record(run_id, file_path, "imported", document_id=document.id)
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
            "source_path": file_path,
        }
