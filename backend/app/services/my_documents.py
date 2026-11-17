"""My documents: favourites, recently opened and documents shared with me.

What a user may see follows the rule of ``GET /documents``: admins and auditors
read the whole institution, managers and readers their own unit, everyone else
their own documents. A document whose current workflow step is assigned to the
user is visible too, as on ``GET /workflows/pending``. Documents in the trash
are never listed.

« Partagés » follows the PO decision of 17/11: documents assigned to me or
visible to me, without a sharing table.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    case,
    delete,
    exists,
    func,
    literal,
    or_,
    select,
    true,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.core.config import settings
from app.models.document import Document
from app.models.my_documents import DocumentFavorite, DocumentRecentAccess
from app.models.user import User
from app.models.workflow import WorkflowStep

logger = logging.getLogger(__name__)

# Same role sets as GET /documents (endpoints/documents.py).
TENANT_WIDE_READ_ROLES = {"super_admin", "tenant_admin", "unit_admin", "auditor"}
ORG_UNIT_READ_ROLES = {"manager", "reader"}

ShareReason = Literal["assigned", "visible"]


def _role_code(user: User) -> str:
    return (getattr(user.role, "code", "") or "").lower()


def readable_clause(user: User) -> ColumnElement[bool]:
    code = _role_code(user)
    if code in TENANT_WIDE_READ_ROLES:
        return true()
    if code in ORG_UNIT_READ_ROLES and user.org_unit_id:
        return Document.org_unit_id == user.org_unit_id
    return Document.owner_id == user.id


def _assigned_document_ids(user: User):
    return select(WorkflowStep.document_id).where(
        WorkflowStep.assigned_to == user.id, WorkflowStep.status == "current"
    )


def visible_clause(user: User) -> ColumnElement[bool]:
    return or_(readable_clause(user), Document.id.in_(_assigned_document_ids(user)))


def _active(user: User) -> list:
    return [Document.tenant_id == user.tenant_id, Document.deleted_at.is_(None)]


def _is_favorite(user: User):
    # Own alias: the favourites listing already joins document_favorites, which
    # would otherwise be auto-correlated away and leave the subquery without FROM.
    favorite = aliased(DocumentFavorite)
    return exists().where(
        favorite.user_id == user.id,
        favorite.document_id == Document.id,
    )


def _options():
    return (selectinload(Document.document_category), selectinload(Document.owner))


def _item(
    document: Document,
    *,
    is_favorite: bool,
    marked_at: Optional[datetime] = None,
    reason: Optional[str] = None,
) -> dict:
    owner = document.owner
    return {
        "id": document.id,
        "title": document.title,
        "status": document.status,
        "org_unit_id": document.org_unit_id,
        "document_category_id": document.document_category_id,
        "category_name": document.category_name,
        "owner_name": (owner.full_name or owner.matricule) if owner else None,
        "created_at": document.created_at,
        "updated_at": document.updated_at,
        "is_favorite": bool(is_favorite),
        "marked_at": marked_at,
        "reason": reason,
    }


async def ensure_visible(db: AsyncSession, user: User, document_id: UUID) -> None:
    """LookupError if the document is absent or trashed, PermissionError if hidden."""
    found = await db.scalar(
        select(visible_clause(user))
        .select_from(Document)
        .where(Document.id == document_id, *_active(user))
    )
    if found is None:
        raise LookupError("Document not found")
    if not found:
        raise PermissionError("Not enough privileges to access this document")


async def add_favorite(db: AsyncSession, user: User, document_id: UUID) -> None:
    """Idempotent: marking a favourite twice keeps one row."""
    await ensure_visible(db, user, document_id)
    await db.execute(
        pg_insert(DocumentFavorite)
        .values(user_id=user.id, document_id=document_id, tenant_id=user.tenant_id)
        .on_conflict_do_nothing(index_elements=["user_id", "document_id"])
    )
    await db.commit()


async def remove_favorite(db: AsyncSession, user: User, document_id: UUID) -> None:
    """Idempotent: removing an absent favourite is a no-op."""
    await db.execute(
        delete(DocumentFavorite).where(
            DocumentFavorite.user_id == user.id,
            DocumentFavorite.document_id == document_id,
        )
    )
    await db.commit()


async def _marked_page(
    db: AsyncSession, user: User, table, marked_column, *, skip: int, limit: int
) -> tuple[int, list[dict]]:
    where = [
        *_active(user),
        visible_clause(user),
        table.user_id == user.id,
        table.tenant_id == user.tenant_id,
    ]
    on = table.document_id == Document.id
    total = await db.scalar(
        select(func.count()).select_from(Document).join(table, on).where(*where)
    )
    rows = await db.execute(
        select(Document, marked_column, _is_favorite(user))
        .join(table, on)
        .where(*where)
        .options(*_options())
        .order_by(marked_column.desc(), Document.id.desc())
        .offset(skip)
        .limit(limit)
    )
    return int(total or 0), [
        _item(document, is_favorite=favorite, marked_at=marked)
        for document, marked, favorite in rows.all()
    ]


async def list_favorites(db: AsyncSession, user: User, *, skip: int, limit: int):
    return await _marked_page(
        db, user, DocumentFavorite, DocumentFavorite.created_at, skip=skip, limit=limit
    )


async def list_recent(db: AsyncSession, user: User, *, skip: int, limit: int):
    return await _marked_page(
        db,
        user,
        DocumentRecentAccess,
        DocumentRecentAccess.accessed_at,
        skip=skip,
        limit=limit,
    )


async def clear_recent(db: AsyncSession, user: User) -> None:
    await db.execute(
        delete(DocumentRecentAccess).where(DocumentRecentAccess.user_id == user.id)
    )
    await db.commit()


async def record_access(db: AsyncSession, user: User, document_id: UUID) -> None:
    """Remember that the user opened the document; no-op while tracking is off.

    Never breaks the read it follows: a failure is logged and rolled back.
    Only the latest RECENT_DOCUMENTS_MAX_PER_USER documents are kept.
    """
    if not settings.RECENT_DOCUMENTS_TRACKING_ENABLED:
        return
    keep = (
        select(DocumentRecentAccess.document_id)
        .where(DocumentRecentAccess.user_id == user.id)
        .order_by(
            DocumentRecentAccess.accessed_at.desc(),
            DocumentRecentAccess.document_id.desc(),
        )
        .limit(settings.RECENT_DOCUMENTS_MAX_PER_USER)
    )
    try:
        async with db.begin_nested():
            await db.execute(
                pg_insert(DocumentRecentAccess)
                .values(
                    user_id=user.id, document_id=document_id, tenant_id=user.tenant_id
                )
                .on_conflict_do_update(
                    index_elements=["user_id", "document_id"],
                    set_={
                        "accessed_at": func.clock_timestamp(),
                        "access_count": DocumentRecentAccess.access_count + 1,
                    },
                )
            )
            await db.execute(
                delete(DocumentRecentAccess).where(
                    DocumentRecentAccess.user_id == user.id,
                    DocumentRecentAccess.document_id.not_in(keep.scalar_subquery()),
                )
            )
        await db.commit()
    except SQLAlchemyError:
        logger.warning("recent document tracking failed", exc_info=True)


async def list_shared(
    db: AsyncSession,
    user: User,
    *,
    reason: Optional[ShareReason],
    skip: int,
    limit: int,
) -> tuple[int, list[dict]]:
    """Documents of others that I can see; the assigned ones come first."""
    assigned = Document.id.in_(_assigned_document_ids(user))
    where = [
        *_active(user),
        or_(Document.owner_id.is_(None), Document.owner_id != user.id),
        or_(readable_clause(user), assigned),
    ]
    if reason == "assigned":
        where.append(assigned)
    elif reason == "visible":
        where.append(~assigned)
    reason_column = case((assigned, literal("assigned")), else_=literal("visible"))
    total = await db.scalar(select(func.count(Document.id)).where(*where))
    rows = await db.execute(
        select(Document, reason_column, _is_favorite(user))
        .where(*where)
        .options(*_options())
        .order_by(
            case((assigned, 0), else_=1),
            Document.updated_at.desc(),
            Document.id.desc(),
        )
        .offset(skip)
        .limit(limit)
    )
    return int(total or 0), [
        _item(document, is_favorite=favorite, reason=why)
        for document, why, favorite in rows.all()
    ]
