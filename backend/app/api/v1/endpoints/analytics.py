# backend/app/api/v1/endpoints/analytics.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from app.api.v1.endpoints.documents import (
    TENANT_WIDE_READ_ROLES,
    UNIT_TREE_READ_ROLES,
    _role_code,
)
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.authz import authorize_or_403
from app.models.user import User
from app.services.analytics.dashboard_facade import DashboardFacade
from app.services.reports_scope import unit_subtree_ids

# Same figures for every role; unit_admin gets them for its unit tree only.
TENANT_ANALYTICS_ROLES = TENANT_WIDE_READ_ROLES | UNIT_TREE_READ_ROLES

router = APIRouter()


@router.get("/tenant", response_model=Dict[str, Any])
async def get_tenant_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Métriques agrégées de toute l'institution : rôles d'administration et
    auditeur ; l'admin de service les reçoit pour son unité et ses sous-unités
    (mêmes clés). Le manager a /analytics/manager, limité à son unité."""
    await authorize_or_403(current_user, "analytics.tenant", "read")
    if _role_code(current_user) not in TENANT_ANALYTICS_ROLES:
        raise HTTPException(status_code=403, detail="Privileges insuffisants")
    units = None
    if _role_code(current_user) in UNIT_TREE_READ_ROLES:
        # No unit: the subtree is empty, every figure is 0.
        units = unit_subtree_ids(current_user.org_unit_id)
    facade = DashboardFacade(db)
    return await facade.get_tenant_metrics(str(current_user.tenant_id), units=units)


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
