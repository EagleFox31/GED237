"""« Mes documents »: favourites, recently opened and shared with me."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.my_documents import MyDocument
from app.services import my_documents as service

router = APIRouter()

TOTAL_COUNT_HEADER = "X-Total-Count"
# Lets the frontend tell "nothing opened yet" from "not remembered at all".
RECENT_TRACKING_HEADER = "X-Recent-Tracking-Enabled"
PAGE_MAX = 200


def _page(response: Response, total: int, items: list) -> list:
    response.headers[TOTAL_COUNT_HEADER] = str(total)
    return items


@router.get("/favorites", response_model=List[MyDocument])
async def list_favorites(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=PAGE_MAX),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total, items = await service.list_favorites(
        db, current_user, skip=skip, limit=limit
    )
    return _page(response, total, items)


@router.put("/favorites/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_favorite(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await service.add_favorite(db, current_user, document_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/favorites/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.remove_favorite(db, current_user, document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/recent", response_model=List[MyDocument])
async def list_recent(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=PAGE_MAX),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total, items = await service.list_recent(db, current_user, skip=skip, limit=limit)
    response.headers[RECENT_TRACKING_HEADER] = (
        "true" if settings.RECENT_DOCUMENTS_TRACKING_ENABLED else "false"
    )
    return _page(response, total, items)


@router.delete("/recent", status_code=status.HTTP_204_NO_CONTENT)
async def clear_recent(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await service.clear_recent(db, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/shared", response_model=List[MyDocument])
async def list_shared(
    response: Response,
    reason: Optional[service.ShareReason] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=PAGE_MAX),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total, items = await service.list_shared(
        db, current_user, reason=reason, skip=skip, limit=limit
    )
    return _page(response, total, items)
