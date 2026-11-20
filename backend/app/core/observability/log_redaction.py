"""Keep bearer secrets carried in URL paths out of the logs.

An "Open" link (GET /api/v1/documents/stream/<token>) carries its token in the
path: uvicorn's access log and the error handlers (``app.errors``, which log
``request.url.path``) would otherwise write it in clear. The filter rewrites the
record before any handler formats it.
"""

import logging
import re
from typing import Any

# URL parts that are credentials; group 1 is kept. One pattern per carrier:
# the "Open" link token in its path, and the access token of the notifications
# WebSocket in its query (uvicorn.error logs 'WebSocket <path?query> [accepted]').
_SECRET_PATH_SEGMENTS = (
    re.compile(r"(/documents/stream/)[^/?#\s\"']+"),
    re.compile(r"([?&]token=)[^&#\s\"']+"),
)
REDACTED = "***"

# Loggers that write request paths. uvicorn.access: one line per request;
# uvicorn.error: protocol errors; app.errors: app/core/errors/handlers.py.
REDACTED_LOGGERS = ("uvicorn.access", "uvicorn.error", "app.errors")


def redact_secret_paths(text: str) -> str:
    for pattern in _SECRET_PATH_SEGMENTS:
        text = pattern.sub(rf"\g<1>{REDACTED}", text)
    return text


def _redact(value: Any) -> Any:
    if isinstance(value, str):
        return redact_secret_paths(value)
    if isinstance(value, dict):
        return {key: _redact(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return type(value)(_redact(item) for item in value)
    return value


class SecretPathFilter(logging.Filter):
    """Redacts secret path segments in the message, its arguments and the extras."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = _redact(record.msg)
        if record.args:
            record.args = _redact(record.args)
        for key, value in list(vars(record).items()):
            if key not in ("msg", "args") and isinstance(value, (str, dict, list)):
                setattr(record, key, _redact(value))
        return True


def install_log_redaction() -> None:
    """Idempotent: one SecretPathFilter per logger, however often it is called."""
    for name in REDACTED_LOGGERS:
        target = logging.getLogger(name)
        if not any(isinstance(f, SecretPathFilter) for f in target.filters):
            target.addFilter(SecretPathFilter())
