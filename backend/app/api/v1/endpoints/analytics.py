# backend/app/api/v1/endpoints/analytics.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from app.api.v1.endpoints.documents import TENANT_WIDE_READ_ROLES, _role_code
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.authz import authorize_or_403
from app.models.user import User
from app.services.analytics.dashboard_facade import DashboardFacade
from app.services.analytics.trends import compute_trends

router = APIRouter()


@router.get("/tenant", response_model=Dict[str, Any])
async def get_tenant_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Métriques agrégées de toute l'institution : rôles d'administration et
    auditeur. Le manager a /analytics/manager, limité à son unité."""
    await authorize_or_403(current_user, "analytics.tenant", "read")
    if _role_code(current_user) not in TENANT_WIDE_READ_ROLES:
        raise HTTPException(status_code=403, detail="Privileges insuffisants")
    facade = DashboardFacade(db)
    return await facade.get_tenant_metrics(str(current_user.tenant_id))


@router.get("/platform", response_model=Dict[str, Any])
async def get_platform_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Métriques globales de la plateforme. Super Admin uniquement."""
    await authorize_or_403(current_user, "analytics.platform", "read")
    facade = DashboardFacade(db)
    return await facade.get_platform_metrics()


@router.get("/trends", response_model=Dict[str, Any])
async def get_trends(
    scope: str = "mine",
    weeks: int = Query(12, ge=4, le=26),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Courbes hebdomadaires (dépôts, visas) : institution, unité ou soi-même."""
    await authorize_or_403(current_user, "analytics.tenant", "read")
    if scope == "tenant":
        if _role_code(current_user) not in TENANT_WIDE_READ_ROLES:
            raise HTTPException(status_code=403, detail="Privileges insuffisants")
    elif scope == "unit":
        if not current_user.org_unit_id:
            raise HTTPException(status_code=403, detail="Aucune unité rattachée")
    elif scope != "mine":
        raise HTTPException(status_code=403, detail="Portée non autorisée")
    return await compute_trends(
        db,
        scope=scope,
        weeks=weeks,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        org_unit_id=current_user.org_unit_id,
    )


@router.get("/manager", response_model=Dict[str, Any])
async def get_manager_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analytics de l'unité du manager."""
    await authorize_or_403(current_user, "analytics.tenant", "read")
    facade = DashboardFacade(db)
    return await facade.get_manager_metrics(
        str(current_user.tenant_id),
        str(current_user.org_unit_id) if current_user.org_unit_id else None,
    )
