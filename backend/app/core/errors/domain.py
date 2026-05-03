"""
Hiérarchie d'exceptions applicatives — base du contrat d'erreur GED237.

Deux messages volontairement séparés :
- user_message : public, lisible, orienté action, exposé au client.
- technical_detail : interne, log/support, JAMAIS exposé dans la réponse HTTP.

Cette séparation réduit le risque de fuite d'informations techniques (OWASP API
Security 2023 #7 Security Misconfiguration : éviter d'exposer stack-traces,
chemins, IDs internes ou messages d'ORM dans les réponses 4xx/5xx).
"""

from __future__ import annotations

from enum import Enum
from typing import Any, ClassVar, Mapping, Optional


class Severity(str, Enum):
    """Gradient de gravité destiné au rendu UI (toast, banner, modal bloquant)."""

    info = "info"
    warning = "warning"
    error = "error"
    critical = "critical"


class AppError(Exception):
    """
    Base : toute erreur métier de l'application doit dériver d'ici.

    Attributs de classe surchargeables par les sous-classes :
    - status_code : code HTTP par défaut.
    - default_error_code : code machine SCREAMING_SNAKE_CASE pour mapping frontend.
    - default_severity : niveau de gravité UI.
    - default_retryable : indique au client si une nouvelle tentative a du sens.
    - default_user_message : message public neutre, surchargeable à l'instanciation.
    """

    status_code: ClassVar[int] = 500
    default_error_code: ClassVar[str] = "INTERNAL_ERROR"
    default_severity: ClassVar[Severity] = Severity.error
    default_retryable: ClassVar[bool] = False
    default_user_message: ClassVar[str] = (
        "Une erreur technique est survenue. Veuillez réessayer ou contacter le support."
    )

    def __init__(
        self,
        user_message: Optional[str] = None,
        *,
        technical_detail: Optional[str] = None,
        error_code: Optional[str] = None,
        severity: Optional[Severity] = None,
        retryable: Optional[bool] = None,
        extras: Optional[Mapping[str, Any]] = None,
    ) -> None:
        self.user_message: str = user_message or self.default_user_message
        # Fallback explicite : signal qu'aucun détail technique n'a été fourni.
        # Évite de polluer les logs avec une copie du message public générique.
        self.technical_detail: str = technical_detail or "No technical detail provided."
        self.error_code: str = error_code or self.default_error_code
        self.severity: Severity = severity or self.default_severity
        self.retryable: bool = (
            self.default_retryable if retryable is None else retryable
        )
        # extras : usage interne logs uniquement.
        # NE JAMAIS y mettre password, token, payload complet, stack, requête SQL.
        self.extras: dict[str, Any] = dict(extras or {})

        super().__init__(self.technical_detail)

    def to_public_dict(self, correlation_id: Optional[str] = None) -> dict[str, Any]:
        """
        Payload sûr à renvoyer au client (utilisé par le handler HTTP).
        Ne contient volontairement ni technical_detail ni extras.
        """
        payload: dict[str, Any] = {
            "error_code": self.error_code,
            "message": self.user_message,
            "severity": self.severity.value,
            "retryable": self.retryable,
        }
        if correlation_id:
            payload["correlation_id"] = correlation_id
        return payload

    def to_log_dict(self, correlation_id: Optional[str] = None) -> dict[str, Any]:
        """Payload interne complet pour logs structurés."""
        return {
            "error_code": self.error_code,
            "user_message": self.user_message,
            "technical_detail": self.technical_detail,
            "severity": self.severity.value,
            "retryable": self.retryable,
            "status_code": self.status_code,
            "correlation_id": correlation_id,
            "extras": self.extras,
        }


# ─────────────────────────────────────────────────────────────────────
# Spécialisations
# ─────────────────────────────────────────────────────────────────────


class AppValidationError(AppError):
    """
    Données entrantes invalides ou incohérentes (formats, contraintes simples).
    Renommé AppValidationError pour éviter la collision avec pydantic.ValidationError.
    """

    status_code = 422
    default_error_code = "VALIDATION_ERROR"
    default_severity = Severity.warning
    default_user_message = "Les informations saisies sont invalides."


class AuthenticationError(AppError):
    """Identification absente ou échouée."""

    status_code = 401
    default_error_code = "AUTH_REQUIRED"
    default_severity = Severity.warning
    default_user_message = "Authentification requise. Veuillez vous reconnecter."


class AuthorizationError(AppError):
    """Utilisateur identifié mais non autorisé pour cette action."""

    status_code = 403
    default_error_code = "FORBIDDEN"
    default_severity = Severity.warning
    default_user_message = "Vous n'avez pas les droits nécessaires pour cette action."


class NotFoundError(AppError):
    """
    Ressource inexistante OU inaccessible dans le périmètre courant (multi-tenant).
    Utiliser aussi pour le hors-tenant : éviter de signaler l'existence d'une ressource
    appartenant à un autre tenant (anti-IDOR — OWASP API 2023 #1 Broken Object Level Auth).
    """

    status_code = 404
    default_error_code = "NOT_FOUND"
    default_severity = Severity.warning
    default_user_message = "La ressource demandée est introuvable."


class ConflictError(AppError):
    """Conflit d'état : doublon, version concurrente, verrou applicatif, etc."""

    status_code = 409
    default_error_code = "CONFLICT"
    default_severity = Severity.warning
    default_user_message = (
        "Cette opération entre en conflit avec l'état actuel des données."
    )


class BusinessRuleViolation(AppError):
    """
    Règle métier violée (à distinguer de AppValidationError) :
    requête bien formée, mais qui contredit une invariant métier
    (ex : « impossible de valider une demande sans pièce jointe obligatoire »).
    """

    status_code = 422
    default_error_code = "BUSINESS_RULE_VIOLATION"
    default_severity = Severity.warning
    default_user_message = "Cette action n'est pas autorisée dans l'état actuel."


class InvalidWorkflowStateError(ConflictError):
    """
    Action impossible à cause de l'état courant du workflow / du dossier
    (ex : « dossier déjà clôturé »). Préférer 409 à 422 ici car l'état est
    une ressource concurrente, pas un défaut de payload.
    """

    default_error_code = "INVALID_WORKFLOW_STATE"
    default_user_message = "Cette action est impossible dans l'état actuel du dossier."


class ExternalServiceError(AppError):
    """
    Dépendance externe indisponible ou en échec (Redis, S3, OCR, SMTP, etc.).
    retryable=True par défaut : l'incident est probablement transitoire.
    """

    status_code = 502
    default_error_code = "EXTERNAL_SERVICE_ERROR"
    default_severity = Severity.error
    default_retryable = True
    default_user_message = (
        "Un service externe est temporairement indisponible. "
        "Réessayez dans un instant."
    )
