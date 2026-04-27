# backend/app/api/v1/endpoints/analytics.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.authz import authorize_or_403
from app.models.user import User
from app.services.analytics.dashboard_facade import DashboardFacade

router = APIRouter()


@router.get("/tenant", response_model=Dict[str, Any])
async def get_tenant_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Métriques agrégées du tenant courant. Accessible aux managers et admins."""
    await authorize_or_403(current_user, "analytics.tenant", "read")
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
