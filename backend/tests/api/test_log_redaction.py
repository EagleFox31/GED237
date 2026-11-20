"""An "Open" link token travels in the URL path: it must never reach the logs.

uvicorn's access log writes every request path, and the error handlers
(``app.errors``) write ``request.url.path`` on a 500. Both pass through
SecretPathFilter, installed when ``app.main`` is imported.
"""

import logging

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.v1.endpoints import documents as documents_module
from app.core.observability.log_redaction import (
    REDACTED_LOGGERS,
    SecretPathFilter,
    install_log_redaction,
    redact_secret_paths,
)
from app.core.rate_limit import limiter
from app.main import app

# Not a real JWT (the secret scanner would flag one); the filter keys on the route.
FAKE_LINK = "segment-du-lien.0123456789abcdef.fin"
STREAM_PATH = f"/api/v1/documents/stream/{FAKE_LINK}"


def _all_logged_text(caplog) -> str:
    """Everything a handler could write: message, raw args and extras."""
    parts = [caplog.text]
    for record in caplog.records:
        parts.append(repr(vars(record)))
    return "\n".join(parts)


def test_redaction_keeps_the_route_and_hides_the_segment():
    assert (
        redact_secret_paths(f"GET {STREAM_PATH}?disposition=inline HTTP/1.1")
        == "GET /api/v1/documents/stream/***?disposition=inline HTTP/1.1"
    )
    # Other routes are left alone.
    assert redact_secret_paths("/api/v1/documents/abc/content") == (
        "/api/v1/documents/abc/content"
    )


def test_filters_are_installed_once_per_logger():
    install_log_redaction()
    install_log_redaction()
    for name in REDACTED_LOGGERS:
        filters = logging.getLogger(name).filters
        assert sum(isinstance(f, SecretPathFilter) for f in filters) == 1, name


@pytest.mark.asyncio
async def test_access_log_of_a_200_stream_hides_the_token(
    auth_client: AsyncClient, caplog
):
    """uvicorn writes this record after every request, the path in its args."""
    caplog.set_level(logging.INFO, logger="uvicorn.access")
    logging.getLogger("uvicorn.access").info(
        '%s - "%s %s HTTP/%s" %d', "127.0.0.1:50000", "GET", STREAM_PATH, "1.1", 200
    )

    logged = _all_logged_text(caplog)
    assert '"GET /api/v1/documents/stream/*** HTTP/1.1" 200' in caplog.text
    assert FAKE_LINK not in logged


def test_websocket_accept_line_hides_the_query_token(caplog):
    """uvicorn.error logs the notifications WebSocket with its ?token= query."""
    caplog.set_level(logging.INFO, logger="uvicorn.error")
    logging.getLogger("uvicorn.error").info(
        '%s - "WebSocket %s" [accepted]',
        ("127.0.0.1", 50000),
        f"/api/v1/notifications/ws?token={FAKE_LINK}&lang=fr",
    )

    assert (
        '"WebSocket /api/v1/notifications/ws?token=***&lang=fr" [accepted]'
        in caplog.text
    )
    assert FAKE_LINK not in _all_logged_text(caplog)


@pytest.mark.asyncio
async def test_error_log_of_a_500_stream_hides_the_token(monkeypatch, caplog):
    def _boom(token):
        raise RuntimeError("decoder down")

    monkeypatch.setattr(documents_module, "decode_document_access_token", _boom)
    caplog.set_level(logging.ERROR, logger="app.errors")

    # Starlette re-raises after sending the 500: keep the response instead.
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(STREAM_PATH)
    assert response.status_code == 500

    records = [r for r in caplog.records if r.name == "app.errors"]
    assert records, "the unhandled exception must still be logged"
    unhandled = [r for r in records if hasattr(r, "unhandled")]
    assert unhandled and unhandled[0].unhandled["path"] == (
        "/api/v1/documents/stream/***"
    )
    assert FAKE_LINK not in _all_logged_text(caplog)


@pytest.fixture
def fresh_limits():
    limiter.reset()
    yield
    limiter.reset()


@pytest.mark.asyncio
async def test_request_access_is_rate_limited(auth_client: AsyncClient, fresh_limits):
    """30 per minute and per IP: the 31st call is refused, whatever its outcome."""
    url = "/api/v1/documents/00000000-0000-0000-0000-000000000000/request-access"
    for _ in range(30):
        assert (await auth_client.post(url)).status_code == 404
    assert (await auth_client.post(url)).status_code == 429
