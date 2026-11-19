"""Tests of scripts/check-config-parity.py (stdlib only).

Run: python scripts/test_check_config_parity.py
"""

import importlib.util
import shutil
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "check_config_parity", REPO / "scripts" / "check-config-parity.py"
)
parity = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(parity)

FILES = (
    parity.CONFIG,
    parity.COMPOSE,
    parity.ENV_EXAMPLE,
    parity.FRONT_DOCKERFILE,
    parity.EXCEPTIONS,
)

MINI_CONFIG = """
from pydantic import Field
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = "x"
    WATCH_STR: str = Field(default="", alias="WATCH")
    model_config = {}
"""

MINI_COMPOSE = """services:
  api:
    environment:
      SECRET_KEY: ${SECRET_KEY}  # comment
  worker:
    environment:
      - WATCH=${WATCH:-}
  frontend:
    build:
      args:
        VITE_X: ${VITE_X:-}
"""


class CheckConfigParity(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.root)

    def write(self, rel, text):
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def mini_repo(self, exceptions=""):
        self.write(parity.CONFIG, MINI_CONFIG)
        self.write(parity.COMPOSE, MINI_COMPOSE)
        self.write(parity.ENV_EXAMPLE, "SECRET_KEY=change-me\n# WATCH=[]\nVITE_X=\n")
        self.write(parity.FRONT_DOCKERFILE, "FROM node\nARG VITE_X\n")
        self.write("frontend/src/main.ts", "const x = import.meta.env.VITE_X;\n")
        self.write(parity.EXCEPTIONS, exceptions)

    def copy_repo(self):
        for rel in FILES:
            target = self.root / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(REPO / rel, target)
        shutil.copytree(
            REPO / parity.FRONTEND,
            self.root / parity.FRONTEND,
            ignore=shutil.ignore_patterns(*parity.SKIP_DIRS),
            dirs_exist_ok=True,
        )

    def test_repository_is_in_parity(self):
        self.assertEqual(parity.check(REPO), [])

    def test_mini_repo_is_in_parity(self):
        self.mini_repo()
        self.assertEqual(parity.check(self.root), [])

    def test_new_setting_without_compose_fails_naming_variable_and_file(self):
        """Named negative case (lesson 065): a setting added to the code only."""
        self.copy_repo()
        config = self.root / parity.CONFIG
        text = config.read_text(encoding="utf-8").replace(
            "    # Pagination\n",
            "    PARITY_PROBE_LIMIT: int = 3\n\n    # Pagination\n",
            1,
        )
        self.assertIn("PARITY_PROBE_LIMIT", text)
        config.write_text(text, encoding="utf-8")

        errors = parity.check(self.root)

        self.assertEqual(len(errors), 2, errors)
        self.assertIn("PARITY_PROBE_LIMIT", errors[0])
        self.assertIn(".env.example", errors[0])
        self.assertIn("PARITY_PROBE_LIMIT", errors[1])
        self.assertIn("docker-compose.yml", errors[1])

    def test_alias_is_the_checked_name(self):
        self.mini_repo()
        self.write(parity.ENV_EXAMPLE, "SECRET_KEY=change-me\nVITE_X=\n")
        errors = parity.check(self.root)
        self.assertEqual(len(errors), 1, errors)
        self.assertTrue(errors[0].startswith("WATCH:"), errors)

    def test_frontend_variable_without_build_arg_fails(self):
        self.mini_repo()
        self.write(parity.FRONT_DOCKERFILE, "FROM node\n")
        errors = parity.check(self.root)
        self.assertEqual(len(errors), 1, errors)
        self.assertIn("ARG VITE_X", errors[0])

    def test_exception_with_reason_covers_the_gap(self):
        self.mini_repo("WATCH | compose | set by the stack\n")
        self.write(parity.COMPOSE, MINI_COMPOSE.replace("      - WATCH=${WATCH:-}\n", ""))
        self.assertEqual(parity.check(self.root), [])

    def test_exception_without_reason_fails(self):
        self.mini_repo("WATCH | compose |\n")
        self.write(parity.COMPOSE, MINI_COMPOSE.replace("      - WATCH=${WATCH:-}\n", ""))
        errors = parity.check(self.root)
        self.assertTrue(any("expected `NAME | scope | reason`" in e for e in errors), errors)

    def test_exception_with_unknown_scope_fails(self):
        self.mini_repo("WATCH | everywhere | reason\n")
        errors = parity.check(self.root)
        self.assertTrue(any("scope must be one of" in e for e in errors), errors)

    def test_stale_exception_fails(self):
        self.mini_repo("SECRET_KEY | all | no longer needed\n")
        errors = parity.check(self.root)
        self.assertEqual(len(errors), 1, errors)
        self.assertIn("matches no gap any more", errors[0])


if __name__ == "__main__":
    unittest.main()
