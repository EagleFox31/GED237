"""The migration graph is a single line: unique revision ids, one head, no cycle.

Runs without a database, so the local suite catches a reused revision id that would
otherwise only surface when ``alembic upgrade`` runs (LESSON-2026-070).
"""

import re
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

BACKEND = Path(__file__).resolve().parents[1]
_REVISION = re.compile(
    r"^revision(?:\s*:\s*str)?\s*=\s*[\"']([^\"']+)[\"']", re.MULTILINE
)


def _script_directory() -> ScriptDirectory:
    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "alembic"))
    return ScriptDirectory.from_config(config)


def test_revision_ids_are_unique():
    seen: dict[str, str] = {}
    for path in sorted((BACKEND / "alembic" / "versions").glob("*.py")):
        match = _REVISION.search(path.read_text(encoding="utf-8"))
        assert match, f"no revision id in {path.name}"
        revision = match.group(1)
        assert revision not in seen, f"{revision}: {seen.get(revision)} and {path.name}"
        seen[revision] = path.name


def test_single_head_without_cycle():
    # walk_revisions raises on a cycle; get_heads lists every branch tip.
    script = _script_directory()
    list(script.walk_revisions())
    assert len(script.get_heads()) == 1, script.get_heads()
