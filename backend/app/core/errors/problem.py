"""
Builder de réponse HTTP au format RFC 9457 « Problem Details for HTTP APIs ».

Surcouche au-dessus de AppError.to_public_dict() pour produire une réponse
conforme à la norme : champs `type`, `title`, `status`, `detail`, `instance`,
augmentés des extensions GED237 (`error_code`, `severity`, `retryable`,
`correlation_id`).
"""

from __future__ import annotations

from typing import Any, Optional

from app.core.errors.domain import AppError, Severity

# URN générique pour les types d'erreur GED237.
# RFC 9457 §4.1 : un URI relatif est valide si une `base_uri` est fournie ;
# on utilise un URN stable indépendant de l'host pour rester portable.
_TYPE_URN_PREFIX = "urn:ged237:error:"


def build_problem_detail(
    *,
    error: Optional[AppError] = None,
    status_code: int,
    user_message: str,
    error_code: str,
    severity: Severity = Severity.error,
    retryable: bool = False,
    correlation_id: Optional[str] = None,
    instance: Optional[str] = None,
    extras_public: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Construit un objet RFC 9457.

    Args:
        error: AppError source (facultatif ; quand fourni, on dérive automatiquement
               les champs).
        status_code: code HTTP de la réponse.
        user_message: message public (rendu dans `detail`).
        error_code: code machine SCREAMING_SNAKE_CASE.
        severity: gravité UI.
        retryable: indique au client si une nouvelle tentative a du sens.
        correlation_id: identifiant de corrélation (X-Request-ID).
        instance: URI/path identifiant l'occurrence (ex: chemin de la requête).
        extras_public: paires clé/valeur additionnelles SAFE pour le client
                       (ex: {"field": "email"} pour une erreur de validation).
                       Ne jamais y placer d'info sensible.
    """
    title = _title_from_status(status_code)
    payload: dict[str, Any] = {
        # Champs RFC 9457 standard
        "type": f"{_TYPE_URN_PREFIX}{error_code.lower()}",
        "title": title,
        "status": status_code,
        "detail": user_message,
        # Extensions applicatives GED237 (nommage stable, contractuel pour le frontend)
        "error_code": error_code,
        "severity": severity.value,
        "retryable": retryable,
    }
    if instance:
        payload["instance"] = instance
    if correlation_id:
        payload["correlation_id"] = correlation_id
    if extras_public:
        # Aplati au top-level pour rester ergonomique côté client.
        # Nom préfixé pour éviter collision avec champs RFC.
        for key, value in extras_public.items():
            if key in payload:
                continue
            payload[key] = value
    return payload


def _title_from_status(status_code: int) -> str:
    """Titre court standard, indépendant de la locale (cf. RFC 9110)."""
    return _STATUS_TITLES.get(status_code, "Error")


_STATUS_TITLES: dict[int, str] = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    409: "Conflict",
    415: "Unsupported Media Type",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
}


# Type alias exporté pour annotation côté handler.
ProblemDetail = dict[str, Any]
