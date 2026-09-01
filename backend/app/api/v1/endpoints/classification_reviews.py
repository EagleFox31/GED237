from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import authorize_or_403
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.events.dispatcher import dispatcher
from app.models.user import User
from app.schemas.classification_review import (
    ClassificationReviewRead,
    ClassificationReviewResolvePayload,
    ClassificationReviewResolveResponse,
)
from app.services.classification_review_service import ClassificationReviewService
from app.services.storage.factory import get_storage_service

router = APIRouter()


def _delete_storage_paths(paths: list[str]) -> None:
    storage_service = get_storage_service()
    for path in paths:
        try:
            storage_service.delete_file(path)
        except Exception:
            continue


def _rollback_storage_renames(renames: list[tuple[str, str]]) -> None:
    storage_service = get_storage_service()
    for current_relative_path, previous_filename in renames:
        try:
            storage_service.rename_file(current_relative_path, previous_filename)
        except Exception:
            continue


@router.get("", response_model=list[ClassificationReviewRead])
async def list_classification_reviews(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_reviews", "read")
    service = ClassificationReviewService(db)
    return await service.list_open_reviews(tenant_id=current_user.tenant_id)


@router.post("/{review_id}/resolve", response_model=ClassificationReviewResolveResponse)
async def resolve_classification_review(
    review_id: UUID,
    payload: ClassificationReviewResolvePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_reviews", "update")

    service = ClassificationReviewService(db)
    outcome = await service.resolve_review(
        review_id=review_id,
        payload=payload,
        current_user=current_user,
    )
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        _delete_storage_paths(outcome.rollback_delete_paths)
        _rollback_storage_renames(outcome.rollback_renames)
        raise
    _delete_storage_paths(outcome.post_commit_delete_paths)
    await db.refresh(outcome.review)
    outcome.document = await service.reload_document(
        document_id=outcome.document.id,
        tenant_id=current_user.tenant_id,
    )

    if outcome.dispatch_payload:
        await dispatcher.dispatch("DOCUMENT_CREATED", outcome.dispatch_payload)
    if outcome.ocr_payload:
        from app.workers.tasks import process_document_ocr

        document_id, file_path, mime_type = outcome.ocr_payload
        try:
            process_document_ocr.delay(document_id, file_path, mime_type)
        except Exception:
            pass

    return service.build_resolve_response(outcome=outcome)
