# backend/app/api/v1/endpoints/categories.py
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.authz import authorize_or_403, ctx_from_resource
from app.models.user import User
from app.models.document_category import DocumentCategory
from app.schemas.document_category import (
    DocumentCategoryCreate,
    DocumentCategoryUpdate,
    DocumentCategoryResponse,
)

router = APIRouter()


@router.get("/", response_model=List[DocumentCategoryResponse])
async def get_document_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    include_inactive: bool = False,
):
    """Liste les catégories du tenant courant."""
    await authorize_or_403(current_user, "categories", "read")
    stmt = select(DocumentCategory).where(
        DocumentCategory.tenant_id == current_user.tenant_id
    )
    if not include_inactive:
        stmt = stmt.where(DocumentCategory.is_active.is_(True))
    stmt = stmt.order_by(DocumentCategory.name.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "/", response_model=DocumentCategoryResponse, status_code=status.HTTP_201_CREATED
)
async def create_document_category(
    category_in: DocumentCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crée une catégorie. Réservé aux admins."""
    await authorize_or_403(current_user, "categories", "create")

    # Normalisation du code
    import re

    normalized_code = category_in.code.strip().lower()
    normalized_code = re.sub(r"[^a-z0-9_]", "_", normalized_code)

    stmt = select(DocumentCategory).where(
        DocumentCategory.tenant_id == current_user.tenant_id,
        DocumentCategory.code == normalized_code,
    )
    if (await db.execute(stmt)).scalars().first():
        raise HTTPException(
            status_code=400,
            detail=f"A category with the code '{normalized_code}' already exists.",
        )

    db_cat = DocumentCategory(
        tenant_id=current_user.tenant_id,
        code=normalized_code,
        name=category_in.name,
        description=category_in.description,
        is_active=category_in.is_active,
    )
    db.add(db_cat)
    await db.commit()
    await db.refresh(db_cat)
    return db_cat


@router.put("/{category_id}", response_model=DocumentCategoryResponse)
async def update_document_category_full(
    category_id: uuid.UUID,
    category_in: DocumentCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Modifie une catégorie (PUT). Réservé aux admins.

    Note de compatibilité:
    ce PUT accepte actuellement un schéma partiel (`DocumentCategoryUpdate`),
    et se comporte donc comme un update partiel.
    Le PATCH est l'endpoint sémantiquement recommandé.
    """
    return await _update_category_logic(category_id, category_in, db, current_user)


@router.patch("/{category_id}", response_model=DocumentCategoryResponse)
async def patch_document_category(
    category_id: uuid.UUID,
    category_in: DocumentCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Modifie partiellement une catégorie (PATCH). Réservé aux admins."""
    return await _update_category_logic(
        category_id, category_in, db, current_user, partial=True
    )


async def _update_category_logic(
    category_id: uuid.UUID,
    category_in: DocumentCategoryUpdate,
    db: AsyncSession,
    current_user: User,
    partial: bool = False,
):
    stmt = select(DocumentCategory).where(
        DocumentCategory.id == category_id,
        DocumentCategory.tenant_id == current_user.tenant_id,
    )
    db_cat = (await db.execute(stmt)).scalars().first()
    if not db_cat:
        raise HTTPException(status_code=404, detail="Category not found")

    await authorize_or_403(
        current_user, "categories", "update", ctx_from_resource(db_cat)
    )

    update_data = category_in.model_dump(exclude_unset=partial)
    for field, value in update_data.items():
        setattr(db_cat, field, value)

    await db.commit()
    await db.refresh(db_cat)
    return db_cat


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document_category(
    category_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Désactive (soft delete) une catégorie. Réservé aux admins."""
    stmt = select(DocumentCategory).where(
        DocumentCategory.id == category_id,
        DocumentCategory.tenant_id == current_user.tenant_id,
    )
    db_cat = (await db.execute(stmt)).scalars().first()
    if not db_cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await authorize_or_403(
        current_user, "categories", "delete", ctx_from_resource(db_cat)
    )
    db_cat.is_active = False
    await db.commit()
    return None
