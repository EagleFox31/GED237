# backend/app/core/tenant_guard.py
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.models.user import User


def assert_same_tenant(resource_tenant_id: Optional[UUID], user: User) -> None:
    """
    Ensure a resource belongs to the same tenant as the current user.
    """
    if resource_tenant_id is None:
        return
    if str(resource_tenant_id) != str(user.tenant_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès cross-tenant refusé.",
        )


def assert_org_unit_scope(resource_org_unit_id: Optional[UUID], user: User) -> None:
    """
    Ensure org-unit scoped users only access resources in their own unit.
    """
    role_code = (getattr(getattr(user, "role", None), "code", "") or "").lower()
    if role_code not in {"manager", "reader"}:
        return
    if resource_org_unit_id is None or user.org_unit_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Portée organisationnelle invalide.",
        )
    if str(resource_org_unit_id) != str(user.org_unit_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès hors périmètre organisationnel refusé.",
        )
