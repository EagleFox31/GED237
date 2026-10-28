"""Error contract: public payloads never leak technical details (OWASP API7)."""

import json

import pytest
from starlette.requests import Request

from app.core.errors.domain import (
    AppError,
    ConflictError,
    ExternalServiceError,
    InvalidWorkflowStateError,
    NotFoundError,
    Severity,
)
from app.core.errors.handlers import (
    app_error_handler,
    legacy_edossier_handler,
    unhandled_exception_handler,
)
from app.core.exceptions import EDossierException

SECRET = "SELECT * FROM users WHERE password_hash = 'x'"


def make_request(path: str = "/api/v1/documents/42") -> Request:
    return Request({"type": "http", "method": "GET", "path": path, "headers": []})


def body_of(response) -> dict:
    return json.loads(response.body)


def test_app_error_defaults_and_overrides():
    error = AppError()
    assert error.status_code == 500
    assert error.error_code == "INTERNAL_ERROR"
    assert error.severity is Severity.error
    assert error.retryable is False
    assert error.technical_detail == "No technical detail provided."

    custom = NotFoundError(
        "Dossier introuvable.",
        technical_detail=SECRET,
        error_code="DOSSIER_NOT_FOUND",
        severity=Severity.warning,
        retryable=True,
        extras={"document_id": "42"},
    )
    assert custom.status_code == 404
    assert custom.user_message == "Dossier introuvable."
    assert custom.error_code == "DOSSIER_NOT_FOUND"
    assert custom.retryable is True
    assert str(custom) == SECRET

    public = custom.to_public_dict(correlation_id="cid-1")
    assert public == {
        "error_code": "DOSSIER_NOT_FOUND",
        "message": "Dossier introuvable.",
        "severity": "warning",
        "retryable": True,
        "correlation_id": "cid-1",
    }
    assert "correlation_id" not in custom.to_public_dict()

    log = custom.to_log_dict(correlation_id="cid-1")
    assert log["technical_detail"] == SECRET
    assert log["status_code"] == 404


def test_error_subclass_hierarchy():
    assert issubclass(InvalidWorkflowStateError, ConflictError)
    assert InvalidWorkflowStateError().status_code == 409
    assert InvalidWorkflowStateError().error_code == "INVALID_WORKFLOW_STATE"
    assert ExternalServiceError().status_code == 502


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "error",
    [
        NotFoundError("Introuvable.", technical_detail=SECRET),
        AppError(technical_detail=SECRET),
    ],
)
async def test_app_error_handler_hides_technical_detail(error):
    response = await app_error_handler(make_request(), error)
    assert response.status_code == error.status_code
    assert response.media_type == "application/problem+json"
    payload = body_of(response)
    assert payload["error_code"] == error.error_code
    assert payload["detail"] == error.user_message
    assert payload["instance"] == "/api/v1/documents/42"
    assert SECRET not in response.body.decode()


@pytest.mark.asyncio
async def test_legacy_and_unhandled_handlers_return_problem_details():
    legacy = await legacy_edossier_handler(
        make_request(), EDossierException("Ancien format.", status_code=400)
    )
    assert legacy.status_code == 400
    assert body_of(legacy)["error_code"] == "LEGACY_ERROR"
    assert body_of(legacy)["severity"] == "warning"

    crash = await unhandled_exception_handler(make_request(), RuntimeError(SECRET))
    assert crash.status_code == 500
    assert body_of(crash)["error_code"] == "INTERNAL_ERROR"
    assert body_of(crash)["retryable"] is True
    assert SECRET not in crash.body.decode()
