"""
Module unifié de gestion des erreurs GED237.

Conformité :
- RFC 9457 (ex-7807) Problem Details for HTTP APIs : format de réponse standard.
- OWASP API Security 2023 #7 (Security Misconfiguration) : ne pas exposer de
  stack-trace, chemins, IDs internes ou messages d'ORM dans les réponses.
- Nielsen #9 : message lisible, indique le problème, suggère une action.
- ISO 25010 §Recoverability : correlation_id présent dans toute réponse pour
  permettre au support de retrouver la trace côté serveur.

Usage côté endpoint :

    from app.core.errors import NotFoundError
    raise NotFoundError(
        user_message="Document introuvable.",
        technical_detail=f"document_id={doc_id} not found in tenant {tenant_id}",
        error_code="DOC_NOT_FOUND",
    )

Le handler global produit la réponse RFC 9457 et logge le technical_detail.
"""

from app.core.errors.domain import (
    AppError,
    AppValidationError,
    AuthenticationError,
    AuthorizationError,
    BusinessRuleViolation,
    ConflictError,
    ExternalServiceError,
    InvalidWorkflowStateError,
    NotFoundError,
    Severity,
)
from app.core.errors.handlers import register_error_handlers
from app.core.errors.problem import ProblemDetail, build_problem_detail

__all__ = [
    "AppError",
    "AppValidationError",
    "AuthenticationError",
    "AuthorizationError",
    "BusinessRuleViolation",
    "ConflictError",
    "ExternalServiceError",
    "InvalidWorkflowStateError",
    "NotFoundError",
    "Severity",
    "ProblemDetail",
    "build_problem_detail",
    "register_error_handlers",
]
