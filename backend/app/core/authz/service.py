# backend/app/core/authz/service.py
#
# Façade d'autorisation unique pour GED237.
#
# RÈGLE ABSOLUE : aucun endpoint ne parle à Casbin directement.
# Tout passe par authorize_or_403() ou can_perform().
#
# Flux interne :
#   1. Casbin check   → role a-t-il la permission (resource, action) ?
#   2. Tenant check   → la ressource appartient-elle au tenant du user ?
#   3. Context check  → si action *_own, le user est-il le propriétaire ?
#   4. Audit deny     → log structuré si refus sur action sensible
import logging
from typing import Optional

from fastapi import HTTPException, status

from app.core.authz.casbin_enforcer import enforce_permission
from app.core.authz.context import AuthzContext
from app.core.authz.metrics import record_authz_decision
from app.core.observability.request_id import get_request_id
from app.models.user import User

logger = logging.getLogger(__name__)

# Actions qui exigent une vérification de propriété côté façade.
# Casbin valide le TYPE de permission, la façade valide le CONTEXTE réel.
_OWN_ACTIONS = frozenset(
    {
        "read_own",
        "update_own",
        "delete_own",
        "trash_own",
    }
)

# Actions sensibles dont le refus doit être audité.
_SENSITIVE_ACTIONS = frozenset(
    {
        "delete",
        "delete_own",
        "manage",
        "assign",
        "resolve_review",
    }
)


async def authorize_or_403(
    user: User,
    resource: str,
    action: str,
    ctx: Optional[AuthzContext] = None,
) -> None:
    """
    Point d'entrée unique pour toute décision d'autorisation.

    Paramètres
    ----------
    user     : utilisateur authentifié (current_user FastAPI)
    resource : ressource cible (ex. "documents", "categories")
    action   : action demandée (ex. "create", "read_own", "manage")
    ctx      : contexte de la ressource (tenant_id, owner_id, org_unit_id)

    Lève HTTP 403 si l'accès est refusé.
    Ne retourne rien si l'accès est accordé.
    """
    await _authorize(user, resource, action, ctx=ctx, audit=True)


async def can_perform(
    user: User,
    resource: str,
    action: str,
    ctx: Optional[AuthzContext] = None,
) -> bool:
    """
    Version booléenne de authorize_or_403.
    Ne lève pas d'exception — utile pour conditionner l'UI ou les filtres.
    """
    try:
        # Silent check: no authz logs/metrics for pre-check paths (UI filters, branching).
        await _authorize(user, resource, action, ctx=ctx, audit=False)
        return True
    except HTTPException:
        return False


# ── Helpers privés ────────────────────────────────────────────────────────────


def _get_role(user: User) -> str:
    """Extrait le code de rôle depuis l'objet User SQLAlchemy."""
    try:
        return user.role.code
    except AttributeError:
        logger.error("[Casbin] user.role.code inaccessible pour user=%s", user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Impossible de résoudre le rôle utilisateur.",
        )


async def _authorize(
    user: User,
    resource: str,
    action: str,
    ctx: Optional[AuthzContext],
    *,
    audit: bool,
) -> None:
    role = _get_role(user)

    # ── 1. Casbin RBAC check ──────────────────────────────────────────────
    # Délègue le backend effectif (csv/sql/shadow) à casbin_enforcer.
    allowed = await enforce_permission(role, resource, action)
    if not allowed:
        if audit:
            _audit_deny(user, resource, action, "rbac_denied")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Action '{action}' sur '{resource}' refusée " f"pour le rôle '{role}'."
            ),
        )

    if ctx is not None:
        # ── 2. Isolation tenant ───────────────────────────────────────────
        # Le super_admin est explicitement exempté du check tenant
        # (il gère plusieurs tenants par définition).
        if ctx.tenant_id is not None and role != "super_admin":
            if str(ctx.tenant_id) != str(user.tenant_id):
                if audit:
                    _audit_deny(user, resource, action, "cross_tenant")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Accès cross-tenant refusé.",
                )

        # ── 3. Vérification de propriété pour les actions *_own ───────────
        if action in _OWN_ACTIONS and ctx.owner_id is not None:
            if str(ctx.owner_id) != str(user.id):
                if audit:
                    _audit_deny(user, resource, action, "ownership_denied")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Vous n'êtes pas propriétaire de cette ressource.",
                )

    if audit:
        _audit_allow(user, resource, action)


def _audit_deny(
    user: User,
    resource: str,
    action: str,
    reason: str,
) -> None:
    """
    Log structuré sur refus d'autorisation.

    Niveaux :
    - WARNING  : tentatives cross-tenant et refus sur actions sensibles
                 (delete, manage, assign, resolve_review) — incidents à surveiller
    - INFO     : refus RBAC standard (rôle insuffisant) — bruit normal en prod
    """
    uid = getattr(user, "id", "?")
    tid = getattr(user, "tenant_id", "?")
    role = getattr(getattr(user, "role", None), "code", "?")
    request_id = get_request_id() or "-"
    record_authz_decision(
        allowed=False,
        role=str(role),
        resource=resource,
        action=action,
        tenant_id=str(tid),
        reason=reason,
    )

    if reason in ("cross_tenant",) or action in _SENSITIVE_ACTIONS:
        logger.warning(
            "[AUTHZ_DENY] request_id=%s user_id=%s tenant_id=%s role=%s resource=%s action=%s reason=%s",
            request_id,
            uid,
            tid,
            role,
            resource,
            action,
            reason,
        )
    else:
        logger.info(
            "[AUTHZ_DENY] request_id=%s user_id=%s tenant_id=%s role=%s resource=%s action=%s reason=%s",
            request_id,
            uid,
            tid,
            role,
            resource,
            action,
            reason,
        )


def _audit_allow(
    user: User,
    resource: str,
    action: str,
) -> None:
    uid = getattr(user, "id", "?")
    tid = getattr(user, "tenant_id", "?")
    role = getattr(getattr(user, "role", None), "code", "?")
    request_id = get_request_id() or "-"
    record_authz_decision(
        allowed=True,
        role=str(role),
        resource=resource,
        action=action,
        tenant_id=str(tid),
        reason="authorized",
    )
    if action in _SENSITIVE_ACTIONS:
        logger.info(
            "[AUTHZ_ALLOW] request_id=%s user_id=%s tenant_id=%s role=%s resource=%s action=%s",
            request_id,
            uid,
            tid,
            role,
            resource,
            action,
        )
