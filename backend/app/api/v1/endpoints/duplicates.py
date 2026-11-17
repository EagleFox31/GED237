"""Duplicates view: list groups of identical documents, keep one, trash the others."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.documents import (
    ORG_UNIT_READ_ROLES,
    TENANT_WIDE_READ_ROLES,
    _audit_document_action,
    _can_trash_document,
    _ensure_not_locked_for_write,
    _role_code,
)
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.document import Document
from app.models.user import User
from app.schemas.duplicates import (
    DuplicateGroup,
    DuplicateResolution,
    DuplicateResolveRequest,
)
from app.services.duplicates import in_validation, list_groups, load_with_checksum

router = APIRouter()


def _visible(user: User) -> list:
    """Same visibility as GET /documents: tenant, own unit, or own documents."""
    filters = [Document.tenant_id == user.tenant_id]
    code = _role_code(user)
    if code in TENANT_WIDE_READ_ROLES:
        return filters
    if code in ORG_UNIT_READ_ROLES and user.org_unit_id:
        return [*filters, Document.org_unit_id == user.org_unit_id]
    return [*filters, Document.owner_id == user.id]


@router.get("", response_model=list[DuplicateGroup])
async def list_duplicate_groups(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Groups of visible active documents with the same content; ``X-Total-Count``
    is the number of groups."""
    total, groups = await list_groups(
        db, _visible(current_user), skip=skip, limit=limit
    )
    response.headers["X-Total-Count"] = str(total)
    return groups


@router.post("/resolve", response_model=DuplicateResolution)
async def resolve_duplicate_group(
    payload: DuplicateResolveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Keep ``keep_id``, send ``trash_ids`` to the recycle bin, all or nothing.

    Every document must be visible and have the same content as the one kept.
    A copy under validation is refused (409): finish or cancel the validation first.
    Documents already in the recycle bin are left as they are (safe retry).
    """
    found = await load_with_checksum(
        db, _visible(current_user), [payload.keep_id, *payload.trash_ids]
    )
    missing = [str(i) for i in (payload.keep_id, *payload.trash_ids) if i not in found]
    if missing:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "document_not_found",
                "message": f"{len(missing)} document(s) introuvable(s).",
            },
        )
    kept, checksum = found[payload.keep_id]
    if kept.deleted_at is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "kept_document_trashed",
                "message": "Le document à garder est dans la corbeille.",
            },
        )
    different = [
        str(i) for i in payload.trash_ids if checksum is None or found[i][1] != checksum
    ]
    if different:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "not_duplicate",
                "message": f"{len(different)} document(s) n'ont pas le même contenu que celui gardé.",
            },
        )

    to_trash = [
        found[i][0] for i in payload.trash_ids if found[i][0].deleted_at is None
    ]
    for document in to_trash:
        if not await _can_trash_document(current_user, document):
            raise HTTPException(status_code=403, detail="Privileges insuffisants")
        await _ensure_not_locked_for_write(document, current_user)
    busy = await in_validation(db, to_trash)
    if busy:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "document_in_validation",
                "message": f"{len(busy)} copie(s) en cours de validation : "
                "terminez ou annulez la validation avant de la mettre à la corbeille.",
            },
        )

    now = datetime.now(timezone.utc)
    for document in to_trash:
        document.deleted_at = now
        document.deleted_by = current_user.id
        db.add(
            _audit_document_action(
                user=current_user,
                document_id=document.id,
                action="document_trashed",
                details={
                    "reason": "duplicate",
                    "kept_document_id": str(kept.id),
                    "checksum_sha256": checksum,
                },
            )
        )
    await db.commit()
    trashed = {document.id for document in to_trash}
    return DuplicateResolution(
        kept_id=kept.id,
        trashed=[i for i in payload.trash_ids if i in trashed],
        already_trashed=[i for i in payload.trash_ids if i not in trashed],
    )
