"""Keep credentials passed in a URL out of the server logs.

uvicorn writes the full path with its query string: ``"GET ...?ticket=..."`` on
``uvicorn.access`` and ``"WebSocket ...?ticket=..." [accepted]`` on ``uvicorn.error``.
The notifications socket ticket is single use and short lived, but a log line is
kept far longer than that: its value is replaced before the record is written.
"""

import logging
import re

SECRET_QUERY_PARAMS = ("ticket", "token")
MASK = "[masked]"
_SECRET_IN_QUERY = re.compile(
    r"([?&](?:%s)=)[^&\s\"']+" % "|".join(SECRET_QUERY_PARAMS)
)
UVICORN_LOGGERS = ("uvicorn.access", "uvicorn.error")


def redact_query_secrets(text: str) -> str:
    return _SECRET_IN_QUERY.sub(r"\1" + MASK, text)


class QuerySecretFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        redacted = redact_query_secrets(message)
        if redacted != message:
            record.msg, record.args = redacted, ()
        return True


def install_query_secret_filter(logger_names=UVICORN_LOGGERS) -> None:
    """Idempotent: a logger never gets the filter twice."""
    for name in logger_names:
        target = logging.getLogger(name)
        if not any(isinstance(f, QuerySecretFilter) for f in target.filters):
            target.addFilter(QuerySecretFilter())
