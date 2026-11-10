"""Watched folders (lot 5): periodic directory ingestion, then the files are moved away.

Each configured folder (``INGEST_WATCH_FOLDERS``) is ingested with the same service and
the same path check as ``POST /documents/ingest-directory``. Imported files and files
already in the GED go to ``_traites/AAAA-MM-JJ/``, files in error to ``_erreurs/``: the
folder only holds what is still to be processed, and a second pass is a no-op.
"""

import json
import logging
import os
import shutil
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors.domain import IngestPathForbiddenError
from app.models.audit import AuditLog
from app.models.document_category import DocumentCategory
from app.models.org_unit import OrgUnit
from app.models.tenant import Tenant
from app.models.user import User
from app.services.ingestion import DirectoryIngestionService

logger = logging.getLogger(__name__)

PROCESSED_DIR = "_traites"
FAILED_DIR = "_erreurs"
EXCLUDED_DIRS = (PROCESSED_DIR, FAILED_DIR)
LAST_RUN_KEY = "ingest_watch:last_run"
LOCK_KEY = "ingest_watch:lock"


@dataclass
class FolderOutcome:
    path: str
    tenant_id: Optional[str] = None
    found: int = 0
    imported: int = 0
    skipped: int = 0
    errors: int = 0


@dataclass
class WatchTarget:
    path: str
    tenant_id: uuid.UUID
    org_unit_id: uuid.UUID
    owner_id: uuid.UUID
    document_category_id: Optional[uuid.UUID]
    recursive: bool
    processing_mode: str


def watch_enabled() -> bool:
    return (
        bool(settings.INGEST_WATCH_FOLDERS)
        and settings.INGEST_WATCH_INTERVAL_SECONDS > 0
    )


def folder_record_id(path: str) -> uuid.UUID:
    """Stable audit record id for a watched folder (no table row to point at)."""
    return uuid.uuid5(uuid.NAMESPACE_URL, f"ingest-watch:{path}")


def _overlaps(path: str, other: str) -> bool:
    """True when one real path is the other or contains it."""
    a, b = os.path.realpath(path), os.path.realpath(other)
    try:
        common = os.path.commonpath([a, b])
    except ValueError:  # different drives
        return False
    return common in (a, b)


def protected_dir_hit(path: str) -> Optional[str]:
    """The protected folder a watched path overlaps, if any."""
    return next(
        (d for d in settings.INGEST_WATCH_PROTECTED_DIRS if _overlaps(path, d)), None
    )


def _move_into(file_path: str, target_dir: str) -> None:
    os.makedirs(target_dir, exist_ok=True)
    base, ext = os.path.splitext(os.path.basename(file_path))
    destination = os.path.join(target_dir, base + ext)
    counter = 1
    while os.path.exists(destination):
        destination = os.path.join(target_dir, f"{base}_{counter}{ext}")
        counter += 1
    shutil.move(file_path, destination)


class IngestWatchService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.ingestion = DirectoryIngestionService(db)

    async def run_once(self) -> list[FolderOutcome]:
        """One pass over every configured folder. A failing folder never stops the others."""
        outcomes: list[FolderOutcome] = []
        for entry in settings.INGEST_WATCH_FOLDERS:
            path = str(entry["path"])
            try:
                target = await self._resolve(entry)
                if target is None:
                    continue
                outcomes.append(await self._process(target))
            except Exception:
                await self.db.rollback()
                logger.exception("[IngestWatch] pass failed for %s", path)
                outcomes.append(FolderOutcome(path=path, errors=1))
        return outcomes

    async def _resolve(self, entry: dict[str, Any]) -> Optional[WatchTarget]:
        """Map the configured codes onto rows; any missing one skips the folder with a log."""
        path = str(entry["path"])
        try:
            self.ingestion.resolve_source_dir(path)
        except IngestPathForbiddenError:
            logger.warning(
                "[IngestWatch] %s ignored: outside INGEST_ALLOWED_ROOTS", path
            )
            return None
        protected = protected_dir_hit(path)
        if protected is not None:
            logger.warning(
                "[IngestWatch] %s ignored: overlaps %s (INGEST_WATCH_PROTECTED_DIRS), "
                "its files are imported by hand",
                path,
                protected,
            )
            return None

        # short_name is not unique: an ambiguous code never picks a tenant at random.
        tenants = (
            await self.db.scalars(
                select(Tenant)
                .where(Tenant.short_name == entry.get("tenant_code"))
                .limit(2)
            )
        ).all()
        if len(tenants) != 1:
            logger.warning(
                "[IngestWatch] %s ignored: tenant_code unknown or ambiguous", path
            )
            return None
        tenant = tenants[0]
        org_unit = await self.db.scalar(
            select(OrgUnit).where(
                OrgUnit.tenant_id == tenant.id,
                OrgUnit.code == entry.get("org_unit_code"),
            )
        )
        owner = await self.db.scalar(
            select(User).where(
                User.tenant_id == tenant.id, User.matricule == entry.get("matricule")
            )
        )
        if org_unit is None or owner is None:
            logger.warning(
                "[IngestWatch] %s ignored: unknown org_unit_code or matricule", path
            )
            return None

        category_id = None
        category_code = entry.get("document_category_code")
        if category_code:
            category = await self.db.scalar(
                select(DocumentCategory).where(
                    DocumentCategory.tenant_id == tenant.id,
                    DocumentCategory.code == category_code,
                )
            )
            if category is None:
                logger.warning(
                    "[IngestWatch] %s ignored: unknown document_category_code", path
                )
                return None
            category_id = category.id

        mode = entry.get("processing_mode", "process")
        return WatchTarget(
            path=path,
            tenant_id=tenant.id,
            org_unit_id=org_unit.id,
            owner_id=owner.id,
            document_category_id=category_id,
            recursive=bool(entry.get("recursive", True)),
            processing_mode=mode if mode in {"process", "archive"} else "process",
        )

    async def _process(self, target: WatchTarget) -> FolderOutcome:
        report = await self.ingestion.ingest(
            source_dir=target.path,
            tenant_id=target.tenant_id,
            org_unit_id=target.org_unit_id,
            owner_id=target.owner_id,
            recursive=target.recursive,
            document_category_id=target.document_category_id,
            processing_mode=target.processing_mode,
            exclude_dirs=EXCLUDED_DIRS,
            settle_seconds=settings.INGEST_WATCH_SETTLE_SECONDS,
        )
        source_dir, _root = self.ingestion.resolve_source_dir(target.path)
        today = datetime.now(timezone.utc).date().isoformat()
        processed_dir = os.path.join(source_dir, PROCESSED_DIR, today)
        for done in [*report.details, *report.duplicates]:
            _move_into(done["source_path"], processed_dir)
        for failed in report.errors:
            # Links pointing outside the roots are reported but never moved.
            if os.path.isfile(failed["file"]) and not os.path.islink(failed["file"]):
                _move_into(failed["file"], os.path.join(source_dir, FAILED_DIR))

        outcome = FolderOutcome(
            path=target.path,
            tenant_id=str(target.tenant_id),
            found=report.total_found,
            imported=report.imported,
            skipped=report.skipped,
            errors=len(report.errors),
        )
        if outcome.imported or outcome.errors:
            # Only passes that changed something: an idle folder writes nothing.
            self.db.add(
                AuditLog(
                    tenant_id=target.tenant_id,
                    user_id=target.owner_id,
                    table_name="ingest_watch",
                    record_id=folder_record_id(target.path),
                    action="watch_ingested",
                    new_data={
                        "path": target.path,
                        "imported": outcome.imported,
                        "skipped": outcome.skipped,
                        "errors": outcome.errors,
                    },
                )
            )
            await self.db.commit()
        return outcome


def last_run_payload(outcomes: list[FolderOutcome]) -> dict[str, Any]:
    return {
        "at": datetime.now(timezone.utc).isoformat(),
        "folders": [asdict(o) for o in outcomes],
    }


def status_for_tenant(
    last_run: Optional[dict[str, Any]], tenant_id: uuid.UUID, tenant_code: Optional[str]
) -> dict[str, Any]:
    """Status contract of GET /documents/ingest-watch/status, limited to one tenant."""
    has_folder = any(
        f.get("tenant_code") == tenant_code for f in settings.INGEST_WATCH_FOLDERS
    )
    payload: Optional[dict[str, Any]] = None
    if last_run:
        payload = {
            "at": last_run["at"],
            "folders": [
                {k: f[k] for k in ("path", "found", "imported", "skipped", "errors")}
                for f in last_run.get("folders", [])
                if f.get("tenant_id") == str(tenant_id)
            ],
        }
    return {
        "enabled": watch_enabled() and has_folder,
        "interval_seconds": settings.INGEST_WATCH_INTERVAL_SECONDS,
        "last_run": payload,
    }


# A pass longer than this frees the lock anyway: a crashed worker never blocks the watch.
LOCK_TTL_SECONDS = 1800
_RELEASE_LOCK = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
end
return 0
"""


async def run_watch_pass(
    session_factory: Callable[[], AsyncSession], redis_client: Any
) -> Optional[dict[str, Any]]:
    """Locked pass over the watched folders; stores and returns ``last_run``.

    Returns None without touching anything when another pass holds the lock
    (beat tick while a long pass is still running, or two workers with ``-B``).
    """
    token = uuid.uuid4().hex
    if not await redis_client.set(LOCK_KEY, token, nx=True, ex=LOCK_TTL_SECONDS):
        logger.info("[IngestWatch] pass skipped: another pass is running")
        return None
    try:
        async with session_factory() as db:
            outcomes = await IngestWatchService(db).run_once()
        payload = last_run_payload(outcomes)
        await redis_client.set(LAST_RUN_KEY, json.dumps(payload))
        return payload
    finally:
        await redis_client.eval(_RELEASE_LOCK, 1, LOCK_KEY, token)


async def read_last_run(redis_client: Any) -> Optional[dict[str, Any]]:
    raw = await redis_client.get(LAST_RUN_KEY)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except ValueError:
        return None
