# backend/app/core/authz/context.py
#
# Contexte d'autorisation passé à la façade authorize_or_403.
# Contient les attributs de la RESSOURCE (pas du user).
# Le user est toujours passé séparément.
from dataclasses import dataclass, field
from typing import Optional
from uuid import UUID


@dataclass
class AuthzContext:
    """
    Attributs contextuels de la ressource cible.

    tenant_id    : tenant propriétaire de la ressource
                   → vérifié pour l'isolation cross-tenant
    owner_id     : user propriétaire de la ressource
                   → vérifié pour les actions *_own
    org_unit_id  : unité org. de la ressource
                   → utilisé pour les checks org_unit scope (non Casbin)
    """

    tenant_id: Optional[UUID] = field(default=None)
    owner_id: Optional[UUID] = field(default=None)
    org_unit_id: Optional[UUID] = field(default=None)


def ctx_from_resource(resource) -> AuthzContext:
    """
    Construit un AuthzContext depuis n'importe quel objet SQLAlchemy
    qui a les attributs standards (tenant_id, owner_id, org_unit_id).
    Les attributs manquants restent None.
    """
    return AuthzContext(
        tenant_id=getattr(resource, "tenant_id", None),
        owner_id=getattr(resource, "owner_id", None),
        org_unit_id=getattr(resource, "org_unit_id", None),
    )
