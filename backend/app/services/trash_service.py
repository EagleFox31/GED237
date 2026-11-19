"""Permanent deletion of trashed documents (manual purge, bulk purge, retention).

One rule for every caller: the audit row and the database deletion are committed
first, the files are removed afterwards. A failed commit therefore never leaves a
document row pointing at missing files; a failed file removal leaves an orphan
file, which is logged and harmless.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Iterable, Optional, Sequence
from uuid import UUID

from fastapi import Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.services.audit_trail import audit_entry

logger = logging.getLogger(__name__)

PURGE_ACTION = "document_purged"
REASON_MANUAL = "manual"
REASON_BULK = "trash_emptied"
REASON_RETENTION = "trash_retention"

LOCK_KEY = "lock:trash-purge"
# A pass longer than this frees the lock anyway: a crashed worker never blocks the purge.
LOCK_TTL_SECONDS = 1800
# Upper bound of batches per pass: the rest waits for the next beat tick.
MAX_BATCHES_PER_PASS = 50
_RELEASE_LOCK = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
end
return 0
"""


class NotInTrashError(Exception):
    """Permanent deletion is only allowed for a document already in the trash."""


# Never purged, by hand, in bulk or by retention: a signed or archived document
# keeps its legal value in the trash, where it can only be restored.
PROTECTED_STATUSES = ("signed", "archived")
# The official register (report_issues) holds its own copies, no key to documents.


class ProtectedDocumentError(Exception):
    """A signed or archived document is never deleted for good."""


async def resolve_trash_tenant(user: Any, tenant_id: Optional[UUID]) -> UUID:
    """Institution whose trash a route reads or purges.

    Same rule as ``resolve_report_scope``: only a platform administrator
    (``tenants manage``) may name another institution with ``tenant_id``; for
    anyone else the parameter is ignored. Without it, everyone stays on their
    own institution (PLATFORM for a platform administrator, whose trash is
    empty): no call ever reaches several institutions at once.
    """
    # Deferred: the worker imports this module for retention and never needs authz.
    from app.core.authz import can_perform

    if tenant_id is not None and await can_perform(user, "tenants", "manage"):
        return tenant_id
    return user.tenant_id


def is_protected(document: Document) -> bool:
    return document.status in PROTECTED_STATUSES or document.archived_at is not None


def is_locked(document: Document, now: Optional[datetime] = None) -> bool:
    """True while an edit lock is active, whoever holds it."""
    now = now or datetime.now(timezone.utc)
    return bool(
        document.locked_by_user_id
        and document.lock_expires_at
        and document.lock_expires_at > now
    )


def assert_purgeable(document: Document) -> None:
    """Single gate before any permanent deletion (a legal hold will plug in here)."""
    if document.deleted_at is None:
        raise NotInTrashError(str(document.id))
    if is_protected(document):
        raise ProtectedDocumentError(str(document.id))


async def stage_purge(
    db: AsyncSession,
    document: Document,
    *,
    actor_id: Optional[UUID],
    reason: str,
    details: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> list[str]:
    """Add the audit row and the deletion to the session; return the file paths.

    The caller commits, then hands the paths to :func:`remove_files`.
    """
    assert_purgeable(document)
    result = await db.execute(
        select(DocumentVersion.file_path).where(
            DocumentVersion.document_id == document.id
        )
    )
    paths = [path for path in result.scalars().all() if path]
    if document.file_path:
        paths.append(document.file_path)

    db.add(
        audit_entry(
            tenant_id=document.tenant_id,
            user_id=actor_id,
            table_name="documents",
            record_id=document.id,
            action=PURGE_ACTION,
            details={"reason": reason, **(details or {})},
            request=request,
        )
    )
    await db.delete(document)
    return paths


def remove_files(storage: Any, paths: Iterable[str]) -> int:
    """Best-effort removal after the commit. Returns the number of orphans left."""
    orphans = 0
    for path in dict.fromkeys(paths):
        try:
            removed = storage.delete_file(path)
        except Exception as exc:  # noqa: BLE001 - the rows are gone, never fail here
            logger.warning(
                "[Trash] file removal failed (%s): %s", type(exc).__name__, path
            )
            orphans += 1
            continue
        if removed is False:
            logger.warning("[Trash] file not removed, orphan left: %s", path)
            orphans += 1
    return orphans


async def purge_many(
    db: AsyncSession,
    storage: Any,
    documents: Sequence[Document],
    *,
    actor_id: Optional[UUID],
    reason: str,
    details: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> int:
    """Purge the given trashed documents in one transaction. Returns the count."""
    paths: list[str] = []
    for document in documents:
        paths.extend(
            await stage_purge(
                db,
                document,
                actor_id=actor_id,
                reason=reason,
                details=details,
                request=request,
            )
        )
    if not documents:
        return 0
    await db.commit()
    remove_files(storage, paths)
    return len(documents)


def trashed_query(
    tenant_id: Optional[UUID],
    *,
    document_ids: Optional[Sequence[UUID]] = None,
    deleted_before: Optional[datetime] = None,
    skip_edit_locked: bool = False,
    now: Optional[datetime] = None,
):
    """Purgeable trashed documents, oldest first: never a protected one.

    ``tenant_id`` None: every tenant (worker only)."""
    query = select(Document).where(
        Document.deleted_at.is_not(None),
        Document.status.not_in(PROTECTED_STATUSES),
        Document.archived_at.is_(None),
    )
    if tenant_id is not None:
        query = query.where(Document.tenant_id == tenant_id)
    if document_ids is not None:
        query = query.where(Document.id.in_(document_ids))
    if deleted_before is not None:
        query = query.where(Document.deleted_at < deleted_before)
    if skip_edit_locked:
        now = now or datetime.now(timezone.utc)
        query = query.where(
            or_(
                Document.locked_by_user_id.is_(None),
                Document.lock_expires_at.is_(None),
                Document.lock_expires_at <= now,
            )
        )
    return query.order_by(Document.deleted_at.asc(), Document.id.asc())


async def count_matching(db: AsyncSession, query) -> int:
    """Documents a :func:`trashed_query` still matches (``remaining`` of a bulk purge)."""
    result = await db.execute(
        select(func.count()).select_from(query.order_by(None).subquery())
    )
    return int(result.scalar_one() or 0)


async def purge_expired(
    db: AsyncSession, storage: Any, *, retention_days: int, batch_size: int
) -> int:
    """One batch of the retention purge. Rows held by another transaction are skipped."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        trashed_query(
            None,
            deleted_before=now - timedelta(days=retention_days),
            skip_edit_locked=True,
            now=now,
        )
        .limit(batch_size)
        .with_for_update(skip_locked=True, of=Document)
    )
    documents = result.scalars().all()
    return await purge_many(
        db,
        storage,
        documents,
        actor_id=None,
        reason=REASON_RETENTION,
        details={"retention_days": retention_days},
    )


async def run_retention_pass(
    session_factory: Callable[[], AsyncSession],
    redis_client: Any,
    storage: Any,
    *,
    retention_days: int,
    batch_size: int,
) -> Optional[int]:
    """Locked retention pass. Returns the purged count, or None when it did not run.

    ``retention_days`` <= 0 disables the purge: nothing is read, not even Redis.
    """
    if retention_days <= 0:
        return None
    token = uuid.uuid4().hex
    if not await redis_client.set(LOCK_KEY, token, nx=True, ex=LOCK_TTL_SECONDS):
        logger.info("[Trash] retention pass skipped: another pass is running")
        return None
    purged = 0
    try:
        for _ in range(MAX_BATCHES_PER_PASS):
            async with session_factory() as db:
                done = await purge_expired(
                    db, storage, retention_days=retention_days, batch_size=batch_size
                )
            purged += done
            if done < batch_size:
                break
        logger.info("[Trash] retention pass purged %s document(s)", purged)
        return purged
    finally:
        await redis_client.eval(_RELEASE_LOCK, 1, LOCK_KEY, token)
