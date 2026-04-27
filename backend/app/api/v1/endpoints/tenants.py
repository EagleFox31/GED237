# backend/app/api/v1/endpoints/tenants.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.authz import authorize_or_403, can_perform, AuthzContext
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantRead, TenantUpdate

router = APIRouter()

# Tenant systeme : heberge les super_admins, invisible aux autres roles,
# non-modifiable (ni desactivation ni suppression).
PLATFORM_TENANT_SHORT_NAME = "PLATFORM"


class TenantPublic(BaseModel):
    """Minimal tenant info exposed sans authentification (ecran de login)."""

    name: str
    short_name: str | None = None


@router.get("/public", response_model=List[TenantPublic])
async def read_tenants_public(db: AsyncSession = Depends(get_db)):
    """
    Liste publique des tenants actifs pour alimenter le selecteur
    d'institution de l'ecran de login. Aucune info sensible (id, settings,
    domain, etc.) n'est exposee.
    """
    result = await db.execute(
        select(Tenant.name, Tenant.short_name)
        .where(Tenant.is_active.is_(True))
        .order_by(Tenant.short_name.asc().nulls_last(), Tenant.name.asc())
    )
    return [
        TenantPublic(name=row.name, short_name=row.short_name) for row in result.all()
    ]


@router.post("/", response_model=TenantRead, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    tenant_in: TenantCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Crée un tenant. Super Admin uniquement."""
    await authorize_or_403(current_user, "tenants", "manage")
    # Le short_name PLATFORM est reserve au tenant systeme.
    if (tenant_in.short_name or "").upper() == PLATFORM_TENANT_SHORT_NAME:
        raise HTTPException(
            status_code=400,
            detail=f"Le sigle '{PLATFORM_TENANT_SHORT_NAME}' est reserve au tenant systeme.",
        )
    query = select(Tenant).filter(Tenant.domain == tenant_in.domain)
    if (await db.execute(query)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Domain already exists")
    db_tenant = Tenant(**tenant_in.dict())
    db.add(db_tenant)
    await db.commit()
    await db.refresh(db_tenant)
    return db_tenant


@router.get("/", response_model=List[TenantRead])
async def read_tenants(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Super Admin voit tous les tenants.
    Les autres ne voient que le leur.
    """
    await authorize_or_403(current_user, "tenants", "read")
    query = select(Tenant)
    # super_admin est exempté du filtre tenant dans la façade.
    # Pour tous les autres, on scope sur leur propre tenant.
    if not await can_perform(current_user, "tenants", "manage"):
        query = query.filter(Tenant.id == current_user.tenant_id)
        # Le tenant systeme PLATFORM n'est jamais visible aux roles non-super_admin.
        query = query.filter(Tenant.short_name != PLATFORM_TENANT_SHORT_NAME)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/{tenant_id}", response_model=TenantRead)
async def read_tenant(
    tenant_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Super Admin lit tous les tenants ; les autres seulement le leur."""
    await authorize_or_403(
        current_user,
        "tenants",
        "read",
        AuthzContext(tenant_id=tenant_id),
    )
    query = select(Tenant).filter(Tenant.id == tenant_id)
    tenant = (await db.execute(query)).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.patch("/{tenant_id}", response_model=TenantRead)
async def update_tenant(
    tenant_id: UUID,
    tenant_in: TenantUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Super Admin ou tenant_admin du tenant concerné peuvent modifier."""
    await authorize_or_403(
        current_user,
        "tenants",
        "update",
        AuthzContext(tenant_id=tenant_id),
    )
    query = select(Tenant).filter(Tenant.id == tenant_id)
    tenant = (await db.execute(query)).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    # Le tenant systeme PLATFORM ne peut etre ni desactive ni renomme.
    if tenant.short_name == PLATFORM_TENANT_SHORT_NAME:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Le tenant systeme PLATFORM ne peut etre modifie.",
        )
    for field, value in tenant_in.dict(exclude_unset=True).items():
        setattr(tenant, field, value)
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)
    return tenant
