"""
Handlers FastAPI qui convertissent toute exception en réponse RFC 9457
(application/problem+json) tout en logguant le détail technique côté serveur.

Chaque erreur exposée au client embarque un `correlation_id` (= X-Request-ID)
permettant au support de retrouver la trace correspondante (ISO/IEC 25010
Recoverability + Nielsen #9 : aider l'utilisateur à diagnostiquer/communiquer
un incident).
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError, HTTPException as FastAPIHTTPException
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors.domain import (
    AppError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    Severity,
)
from app.core.errors.problem import build_problem_detail
from app.core.exceptions import EDossierException
from app.core.observability.request_id import get_request_id

logger = logging.getLogger("app.errors")

PROBLEM_JSON_MEDIA_TYPE = "application/problem+json"


def _correlation_id() -> str | None:
    return get_request_id()


def _problem_response(payload: dict[str, Any], status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=payload,
        media_type=PROBLEM_JSON_MEDIA_TYPE,
    )


# ─────────────────────────────────────────────────────────────────────
# AppError : exceptions métier de l'application
# ─────────────────────────────────────────────────────────────────────


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    cid = _correlation_id()
    log_payload = exc.to_log_dict(correlation_id=cid)
    log_payload["path"] = request.url.path
    log_payload["method"] = request.method
    if exc.status_code >= 500:
        logger.error("AppError", extra={"app_error": log_payload}, exc_info=exc)
    else:
        logger.info("AppError", extra={"app_error": log_payload})

    payload = build_problem_detail(
        error=exc,
        status_code=exc.status_code,
        user_message=exc.user_message,
        error_code=exc.error_code,
        severity=exc.severity,
        retryable=exc.retryable,
        correlation_id=cid,
        instance=str(request.url.path),
    )
    return _problem_response(payload, exc.status_code)


# ─────────────────────────────────────────────────────────────────────
# EDossierException (legacy) : ancienne hiérarchie, on la wrappe en RFC 9457
# pour que le frontend voie un format unique. À retirer à terme.
# ─────────────────────────────────────────────────────────────────────


async def legacy_edossier_handler(
    request: Request, exc: EDossierException
) -> JSONResponse:
    cid = _correlation_id()
    logger.info(
        "LegacyEDossierException",
        extra={
            "legacy_error": {
                "message": exc.message,
                "status_code": exc.status_code,
                "path": request.url.path,
                "correlation_id": cid,
            }
        },
    )
    payload = build_problem_detail(
        status_code=exc.status_code,
        user_message=exc.message,
        error_code="LEGACY_ERROR",
        severity=Severity.warning if exc.status_code < 500 else Severity.error,
        retryable=False,
        correlation_id=cid,
        instance=str(request.url.path),
    )
    return _problem_response(payload, exc.status_code)


# ─────────────────────────────────────────────────────────────────────
# HTTPException FastAPI / Starlette : on uniformise au format Problem
# ─────────────────────────────────────────────────────────────────────


def _normalize_http_detail(detail: Any, status_code: int) -> tuple[str, str]:
    """Preserve safe semantic codes from legacy structured HTTPException details.

    Older endpoints still raise ``HTTPException(detail={"error": ..., "message": ...})``.
    RFC 9457 requires ``detail`` to remain a string, so we translate only those two
    public fields into the canonical top-level ``detail`` and ``error_code`` fields.
    Other keys are deliberately not exposed because they may contain internal IDs.
    """
    fallback_code = _http_status_to_error_code(status_code)
    if isinstance(detail, str):
        return detail, fallback_code

    if not isinstance(detail, dict):
        return "Erreur.", fallback_code

    raw_message = detail.get("message")
    user_message = (
        raw_message.strip()
        if isinstance(raw_message, str) and raw_message.strip()
        else "Erreur."
    )

    raw_error = detail.get("error")
    if not isinstance(raw_error, str) or not raw_error.strip():
        return user_message, fallback_code

    candidate = raw_error.strip().upper().replace("-", "_").replace(" ", "_")
    if len(candidate) > 64 or not candidate.replace("_", "").isalnum():
        return user_message, fallback_code

    return user_message, candidate


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    cid = _correlation_id()
    detail, code = _normalize_http_detail(exc.detail, exc.status_code)
    severity = Severity.warning if exc.status_code < 500 else Severity.error

    if exc.status_code >= 500:
        logger.error(
            "HTTPException",
            extra={
                "http_exception": {
                    "status_code": exc.status_code,
                    "detail": str(exc.detail),
                    "path": request.url.path,
                    "correlation_id": cid,
                }
            },
            exc_info=exc,
        )

    payload = build_problem_detail(
        status_code=exc.status_code,
        user_message=detail,
        error_code=code,
        severity=severity,
        retryable=False,
        correlation_id=cid,
        instance=str(request.url.path),
    )
    return _problem_response(payload, exc.status_code)


# ─────────────────────────────────────────────────────────────────────
# Pydantic / FastAPI RequestValidationError : 422 structurée
# ─────────────────────────────────────────────────────────────────────


async def request_validation_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    cid = _correlation_id()
    # On expose les erreurs par champ (loc + msg + type) — safe par construction
    # car ne contient ni stack ni info interne. Limite à 20 entrées pour borner la taille.
    raw_errors = exc.errors()
    safe_errors = [
        {
            "field": ".".join(str(p) for p in err.get("loc", [])),
            "message": err.get("msg", ""),
            "type": err.get("type", ""),
        }
        for err in raw_errors[:20]
    ]
    logger.info(
        "RequestValidationError",
        extra={
            "validation": {
                "errors": raw_errors,
                "path": request.url.path,
                "correlation_id": cid,
            }
        },
    )
    payload = build_problem_detail(
        status_code=422,
        user_message="Les informations envoyées sont invalides.",
        error_code="VALIDATION_ERROR",
        severity=Severity.warning,
        retryable=False,
        correlation_id=cid,
        instance=str(request.url.path),
        extras_public={"errors": safe_errors},
    )
    return _problem_response(payload, 422)


async def pydantic_validation_handler(
    request: Request, exc: PydanticValidationError
) -> JSONResponse:
    # Pydantic ValidationError remontant hors d'un endpoint (ex: serializer interne)
    return await request_validation_handler(
        request,
        RequestValidationError(errors=exc.errors()),  # type: ignore[arg-type]
    )


# ─────────────────────────────────────────────────────────────────────
# Fallback : toute exception non gérée → 500 propre, sans fuite de détails
# ─────────────────────────────────────────────────────────────────────


async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    cid = _correlation_id()
    logger.exception(
        "UnhandledException",
        extra={
            "unhandled": {
                "type": exc.__class__.__name__,
                "path": request.url.path,
                "method": request.method,
                "correlation_id": cid,
            }
        },
    )
    payload = build_problem_detail(
        status_code=500,
        user_message=(
            "Une erreur technique est survenue. "
            "Référez le code ci-dessous au support si le problème persiste."
        ),
        error_code="INTERNAL_ERROR",
        severity=Severity.critical,
        retryable=True,
        correlation_id=cid,
        instance=str(request.url.path),
    )
    return _problem_response(payload, 500)


# ─────────────────────────────────────────────────────────────────────
# Mapping HTTP status → error_code pour les HTTPException brutes
# ─────────────────────────────────────────────────────────────────────


_STATUS_CODES: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "AUTH_REQUIRED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    415: "UNSUPPORTED_MEDIA_TYPE",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
    500: "INTERNAL_ERROR",
    502: "EXTERNAL_SERVICE_ERROR",
    503: "SERVICE_UNAVAILABLE",
    504: "GATEWAY_TIMEOUT",
}


def _http_status_to_error_code(status_code: int) -> str:
    return _STATUS_CODES.get(status_code, "ERROR")


# ─────────────────────────────────────────────────────────────────────
# Enregistrement
# ─────────────────────────────────────────────────────────────────────


def register_error_handlers(app: FastAPI) -> None:
    """À appeler dans main.py après la création de l'instance FastAPI."""
    # Spécifiques d'abord (FastAPI privilégie le handler le plus spécifique)
    app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(EDossierException, legacy_edossier_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, request_validation_handler)  # type: ignore[arg-type]
    app.add_exception_handler(PydanticValidationError, pydantic_validation_handler)  # type: ignore[arg-type]
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(FastAPIHTTPException, http_exception_handler)  # type: ignore[arg-type]
    # Fallback global
    app.add_exception_handler(Exception, unhandled_exception_handler)
