"""Startup schema guard: the API refuses to boot on a database not at the Alembic head."""

import logging

import pytest
from pydantic import ValidationError

from app.core import schema_check
from app.core.config import Settings
from app.core.schema_check import (
    SchemaNotAtHeadError,
    SchemaStatus,
    current_revisions,
    enforce_schema_at_head,
    expected_heads,
)

HEADS = expected_heads()


@pytest.fixture
def db_revisions(monkeypatch):
    """Pretend the database is stamped with the given revisions."""

    def _set(*revisions: str) -> None:
        async def fake_current(_engine):
            return frozenset(revisions)

        monkeypatch.setattr(schema_check, "current_revisions", fake_current)

    return _set


def test_expected_heads_reads_the_migration_scripts():
    assert len(HEADS) == 1, "multiple Alembic heads: add a merge migration"


def test_status_compares_current_and_expected():
    assert SchemaStatus(current=HEADS, expected=HEADS).at_head
    assert not SchemaStatus(current=frozenset({"old"}), expected=HEADS).at_head
    assert not SchemaStatus(current=frozenset(), expected=HEADS).at_head


def test_describe_is_actionable():
    message = SchemaStatus(current=frozenset(), expected=frozenset({"abc"})).describe()
    assert "none" in message
    assert "abc" in message
    assert "alembic upgrade head" in message


async def test_fail_mode_raises_when_behind(db_revisions):
    db_revisions("old")
    with pytest.raises(SchemaNotAtHeadError, match="alembic upgrade head"):
        await enforce_schema_at_head(engine=None, mode="fail")


async def test_warn_mode_logs_and_continues(db_revisions, caplog):
    db_revisions()
    with caplog.at_level(logging.WARNING, logger=schema_check.__name__):
        status = await enforce_schema_at_head(engine=None, mode="warn")
    assert status is not None and not status.at_head
    assert "alembic upgrade head" in caplog.text


async def test_at_head_passes_in_fail_mode(db_revisions):
    db_revisions(*HEADS)
    status = await enforce_schema_at_head(engine=None, mode="fail")
    assert status is not None and status.at_head


async def test_off_mode_skips_the_database(monkeypatch):
    async def boom(_engine):
        raise AssertionError("database must not be queried")

    monkeypatch.setattr(schema_check, "current_revisions", boom)
    assert await enforce_schema_at_head(engine=None, mode="off") is None


async def test_current_revisions_reads_a_real_database(test_engine):
    revisions = await current_revisions(test_engine)
    assert isinstance(revisions, frozenset)


@pytest.mark.parametrize(
    "raw, expected", [(None, "fail"), (" WARN ", "warn"), ("off", "off")]
)
def test_setting_is_normalised(raw, expected):
    assert Settings(SCHEMA_CHECK_MODE=raw).SCHEMA_CHECK_MODE == expected


def test_setting_rejects_unknown_mode():
    with pytest.raises(ValidationError):
        Settings(SCHEMA_CHECK_MODE="strict")
