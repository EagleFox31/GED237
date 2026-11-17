"""Périmètre effectif d'un rapport : institution, unité et récursivité.

Règle unique, partagée par toutes les routes ``/reports/*`` et appliquée à tous
les compteurs de leurs réponses :
- un super-administrateur (permission ``tenants manage``) peut viser une autre
  institution avec ``tenant_id`` ; tout autre utilisateur reste sur la sienne ;
- un collaborateur n'a pas accès aux rapports (403) ;
- un manager, un admin de service ou un lecteur est limité à sa propre unité ;
  sans unité demandée, il obtient son unité et ses sous-unités ;
- les autres rôles (admin de l'institution, auditeur) gardent l'unité et la
  récursivité demandées.
"""

from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.core.authz import can_perform
from app.models.user import User

# Rôles dont les rapports sont limités à leur propre unité et ses sous-unités.
ORG_UNIT_SCOPED_ROLES = frozenset({"manager", "unit_admin", "reader"})
# Rôles sans accès aux rapports, même s'ils lisent les indicateurs du tableau de bord.
REPORTS_DENIED_ROLES = frozenset({"collaborator"})


@dataclass(frozen=True)
class ReportScope:
    tenant_id: Optional[UUID]
    org_unit_id: Optional[UUID]
    recursive: bool


def _role_code(user: User) -> str:
    return (getattr(getattr(user, "role", None), "code", "") or "").lower()


def _forbidden(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


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
    if is_super:
        return ReportScope(effective_tenant, org_unit_id, recursive)

    role = _role_code(user)
    if role in REPORTS_DENIED_ROLES:
        raise _forbidden("Les rapports ne sont pas accessibles à votre profil.")
    if role not in ORG_UNIT_SCOPED_ROLES:
        return ReportScope(effective_tenant, org_unit_id, recursive)

    if user.org_unit_id is None:
        raise _forbidden("Portée organisationnelle invalide.")
    if org_unit_id is None:
        return ReportScope(effective_tenant, user.org_unit_id, True)
    if str(org_unit_id) != str(user.org_unit_id):
        raise _forbidden("Accès hors périmètre organisationnel refusé.")
    return ReportScope(effective_tenant, user.org_unit_id, recursive)
