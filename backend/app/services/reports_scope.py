"""Périmètre effectif d'un rapport : institution, unité et récursivité.

Règle unique, partagée par toutes les routes ``/reports/*`` et appliquée à tous
les compteurs de leurs réponses :
- un super-administrateur (permission ``tenants manage``) peut viser une autre
  institution avec ``tenant_id`` ; tout autre utilisateur reste sur la sienne ;
- un collaborateur n'a pas accès aux rapports (403) ;
- l'admin de l'institution et l'auditeur voient toute l'institution : ils
  gardent l'unité et la récursivité demandées ;
- tout autre rôle (manager, admin de service, lecteur, rôle ajouté plus tard)
  est limité à sa propre unité et à ses sous-unités : sans unité demandée, il
  obtient son unité et ses sous-unités ; il peut viser l'une d'elles ; une unité
  hors de son arbre est refusée (403).

Le sous-arbre se lit sur ``org_units.parent_id``, seule relation tenue à jour :
la table ``org_unit_closure`` n'est alimentée par aucun chemin de l'application.
Les listes de documents, la recherche, les statistiques et les imports
réutilisent ``unit_subtree_ids`` et ``is_within_unit_tree``.
"""

from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import can_perform
from app.models.org_unit import OrgUnit
from app.models.user import User

# Rôles qui voient toute l'institution. Liste fermée : un rôle absent est
# limité à son unité (on n'élargit jamais un périmètre par défaut).
INSTITUTION_WIDE_ROLES = frozenset({"tenant_admin", "auditor"})
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


def unit_subtree_ids(root_id: UUID) -> Select:
    """Ids of ``root_id`` and of every unit below it, as a subquery."""
    tree = select(OrgUnit.id).where(OrgUnit.id == root_id).cte(recursive=True)
    # UNION, not UNION ALL: a cycle in parent_id stops instead of looping.
    tree = tree.union(select(OrgUnit.id).where(OrgUnit.parent_id == tree.c.id))
    return select(tree.c.id)


async def is_within_unit_tree(db: AsyncSession, unit_id: UUID, root_id: UUID) -> bool:
    """``unit_id`` is ``root_id`` or one of its sub-units."""
    if str(unit_id) == str(root_id):
        return True
    found = await db.execute(
        select(OrgUnit.id).where(
            OrgUnit.id == unit_id, OrgUnit.id.in_(unit_subtree_ids(root_id))
        )
    )
    return found.first() is not None


async def resolve_report_scope(
    user: User,
    db: AsyncSession,
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
    if role in INSTITUTION_WIDE_ROLES:
        return ReportScope(effective_tenant, org_unit_id, recursive)

    if user.org_unit_id is None:
        raise _forbidden("Portée organisationnelle invalide.")
    if org_unit_id is None:
        return ReportScope(effective_tenant, user.org_unit_id, True)
    if not await is_within_unit_tree(db, org_unit_id, user.org_unit_id):
        raise _forbidden("Accès hors périmètre organisationnel refusé.")
    return ReportScope(effective_tenant, org_unit_id, recursive)
