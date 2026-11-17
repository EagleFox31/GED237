"""Périmètre effectif d'un rapport : institution, unité et récursivité.

Règle unique, partagée par toutes les routes de rapports :
- un super-administrateur (permission ``tenants manage``) peut viser une autre
  institution avec ``tenant_id`` ; tout autre utilisateur reste sur la sienne ;
- un manager ou un lecteur est limité à sa propre unité ; sans unité demandée,
  il obtient son unité et ses sous-unités ;
- les autres rôles gardent l'unité et la récursivité demandées.
"""

from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.core.authz import can_perform
from app.core.tenant_guard import assert_org_unit_scope
from app.models.user import User

# Rôles dont les rapports sont limités à leur propre unité.
ORG_UNIT_SCOPED_ROLES = frozenset({"manager", "reader"})


@dataclass(frozen=True)
class ReportScope:
    tenant_id: Optional[UUID]
    org_unit_id: Optional[UUID]
    recursive: bool


def _role_code(user: User) -> str:
    return (getattr(getattr(user, "role", None), "code", "") or "").lower()


async def resolve_report_scope(
    user: User,
    *,
    tenant_id: Optional[UUID] = None,
    org_unit_id: Optional[UUID] = None,
    recursive: bool = False,
) -> ReportScope:
    """Calcule le périmètre réellement appliqué, ou lève 403 s'il est interdit."""
    is_super = await can_perform(user, "tenants", "manage")
    effective_tenant = tenant_id if (is_super and tenant_id) else user.tenant_id

    if is_super or _role_code(user) not in ORG_UNIT_SCOPED_ROLES:
        return ReportScope(effective_tenant, org_unit_id, recursive)

    if user.org_unit_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Portée organisationnelle invalide.",
        )
    if org_unit_id is None:
        return ReportScope(effective_tenant, user.org_unit_id, True)
    assert_org_unit_scope(org_unit_id, user)
    return ReportScope(effective_tenant, user.org_unit_id, recursive)
