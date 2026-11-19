"""Duplicates view: active documents whose current version has the same content.

Same content = same SHA-256 of the current version, the fingerprint already used to
refuse a duplicate upload. Resolving a group keeps one document and sends the others
to the recycle bin; nothing is deleted for good here (rule « corbeille seulement »).
The caller passes the visibility filters, so this module knows no role.
"""

from collections import defaultdict
from typing import Any, Iterable
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.workflow import WorkflowStep

CHECKSUM = DocumentVersion.checksum_sha256


def _with_checksum(*columns):
    return (
        select(*columns)
        .select_from(Document)
        .join(DocumentVersion, DocumentVersion.id == Document.current_version_id)
    )


def _member(document: Document) -> dict[str, Any]:
    owner, unit = document.owner, document.org_unit
    return {
        "id": document.id,
        "title": document.title,
        "status": document.status,
        "org_unit_id": document.org_unit_id,
        "org_unit_name": unit.name if unit else None,
        "owner_name": (owner.full_name or owner.matricule) if owner else None,
        "mime_type": document.mime_type,
        "file_size": document.file_size,
        "logical_space_path": document.logical_space_path,
        "created_at": document.created_at,
    }


async def list_groups(
    db: AsyncSession, filters: list, *, skip: int, limit: int
) -> tuple[int, list[dict[str, Any]]]:
    """Groups of at least two visible active documents with the same content.

    Largest group first, then the most recent; members oldest first, and the oldest
    (the original) is suggested as the one to keep.
    """
    active = [*filters, Document.deleted_at.is_(None), CHECKSUM.is_not(None)]
    keyed_sub = (
        _with_checksum(
            CHECKSUM.label("checksum"), Document.created_at.label("created_at")
        )
        .where(*active)
        .subquery()
    )
    grouped = (
        select(
            keyed_sub.c.checksum,
            func.count().label("size"),
            func.max(keyed_sub.c.created_at).label("latest"),
        )
        .group_by(keyed_sub.c.checksum)
        .having(func.count() >= 2)
        .subquery()
    )
    total = await db.scalar(select(func.count()).select_from(grouped))
    page = (
        await db.execute(
            select(grouped.c.checksum)
            .order_by(
                grouped.c.size.desc(), grouped.c.latest.desc(), grouped.c.checksum
            )
            .offset(skip)
            .limit(limit)
        )
    ).scalars()
    checksums = list(page)
    if not checksums:
        return int(total or 0), []

    rows = await db.execute(
        _with_checksum(Document, CHECKSUM)
        .where(*active, CHECKSUM.in_(checksums))
        .options(selectinload(Document.owner), selectinload(Document.org_unit))
        .order_by(Document.created_at, Document.id)
    )
    members: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for document, checksum in rows.all():
        members[checksum].append(_member(document))
    groups = [
        {
            "checksum": checksum,
            "count": len(members[checksum]),
            "suggested_keep_id": members[checksum][0]["id"],
            "documents": members[checksum],
        }
        for checksum in checksums
    ]
    return int(total or 0), groups


async def load_with_checksum(
    db: AsyncSession, filters: list, ids: Iterable[UUID], *, lock: bool = False
) -> dict[UUID, tuple[Document, str | None]]:
    """Visible documents (trashed included) with the checksum of their current version.

    ``lock`` holds the document rows until commit, taken in id order so two
    resolutions of the same group queue up instead of deadlocking: crossed
    choices (one keeps A and trashes B, the other keeps B and trashes A) would
    otherwise both pass and trash every copy.
    """
    query = (
        select(Document, CHECKSUM)
        .select_from(Document)
        .outerjoin(DocumentVersion, DocumentVersion.id == Document.current_version_id)
        .where(*filters, Document.id.in_(list(ids)))
    )
    if lock:
        query = (
            query.order_by(Document.id)
            .with_for_update(of=Document)
            .execution_options(populate_existing=True)
        )
    rows = await db.execute(query)
    return {document.id: (document, checksum) for document, checksum in rows.all()}


# A validation is under way: the document is in review, or one of its steps waits
# for someone (current step, or a step waiting for an assignee).
OPEN_STEP_STATUSES = ("current", "pending_assignment")


async def in_validation(db: AsyncSession, documents: Iterable[Document]) -> list[UUID]:
    """Ids of the documents a validation is under way on, in the order given.

    Trashing such a copy would pull it out from under its validators: the
    validation must be finished or cancelled first."""
    documents = list(documents)
    with_open_step = set(
        (
            await db.execute(
                select(WorkflowStep.document_id).where(
                    WorkflowStep.document_id.in_([d.id for d in documents]),
                    WorkflowStep.status.in_(OPEN_STEP_STATUSES),
                )
            )
        ).scalars()
    )
    return [
        d.id for d in documents if d.status == "in_review" or d.id in with_open_step
    ]
