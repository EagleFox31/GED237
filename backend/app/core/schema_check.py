"""Startup guard: the database schema must be at the Alembic head.

Without it, a missing migration surfaces as an ``UndefinedTableError`` on the
first user request (HTTP 500, shown client-side as a network error) instead of
failing at boot. See LESSON-2026-001 in ``DOCS/engineering/lessons-learned.md``.
"""

import logging
from dataclasses import dataclass
from pathlib import Path

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger(__name__)

ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


class SchemaNotAtHeadError(RuntimeError):
    """Raised at startup when the database revision differs from the code."""


@dataclass(frozen=True)
class SchemaStatus:
    current: frozenset[str]
    expected: frozenset[str]

    @property
    def at_head(self) -> bool:
        return self.current == self.expected

    def describe(self) -> str:
        current = (
            ", ".join(sorted(self.current)) or "none (alembic_version empty or missing)"
        )
        expected = ", ".join(sorted(self.expected))
        return (
            f"Database schema is not at the Alembic head (current: {current}; "
            f"expected: {expected}). Run `alembic upgrade head` against this "
            "database, then restart the API."
        )


def expected_heads(ini_path: Path = ALEMBIC_INI) -> frozenset[str]:
    script = ScriptDirectory.from_config(Config(str(ini_path)))
    return frozenset(script.get_heads())


async def current_revisions(engine: AsyncEngine) -> frozenset[str]:
    async with engine.connect() as conn:
        heads = await conn.run_sync(
            lambda sync_conn: MigrationContext.configure(sync_conn).get_current_heads()
        )
    return frozenset(heads)


async def get_schema_status(
    engine: AsyncEngine, ini_path: Path = ALEMBIC_INI
) -> SchemaStatus:
    return SchemaStatus(
        current=await current_revisions(engine), expected=expected_heads(ini_path)
    )


async def enforce_schema_at_head(engine: AsyncEngine, mode: str) -> SchemaStatus | None:
    """Apply ``SCHEMA_CHECK_MODE``: ``fail`` raises, ``warn`` logs, ``off`` skips."""
    if mode == "off":
        return None
    status = await get_schema_status(engine)
    if status.at_head:
        logger.info(
            "Database schema at Alembic head (%s)", ", ".join(sorted(status.expected))
        )
    elif mode == "fail":
        raise SchemaNotAtHeadError(status.describe())
    else:
        logger.warning(status.describe())
    return status
