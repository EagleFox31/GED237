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
    parity.BACKEND_ENV_EXAMPLE,
    parity.NGINX_LOCATIONS,
)
MINI_ENV = "SECRET_KEY=change-me\n# WATCH=[]\nVITE_X=\nMAX_UPLOAD_SIZE_MB=10\n"

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
        self.write(parity.ENV_EXAMPLE, MINI_ENV)
        self.write(parity.FRONT_DOCKERFILE, "FROM node\nARG VITE_X\n")
        self.write("frontend/src/main.ts", "const x = import.meta.env.VITE_X;\n")
        self.write(parity.EXCEPTIONS, exceptions)
        self.write(parity.NGINX_LOCATIONS, "location /api/ {\n    client_max_body_size 11M;\n}\n")

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
        self.write(parity.ENV_EXAMPLE, MINI_ENV.replace("# WATCH=[]\n", ""))
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

    # Upload cap: nginx must stay at least 1 MB above every declared MAX_UPLOAD_SIZE_MB.

    def replace_in(self, rel, old, new):
        path = self.root / rel
        text = path.read_text(encoding="utf-8")
        self.assertIn(old, text)
        path.write_text(text.replace(old, new, 1), encoding="utf-8")

    def assert_single_upload_error(self, *fragments):
        errors = parity.check(self.root)
        self.assertEqual(len(errors), 1, errors)
        self.assertTrue(errors[0].startswith(str(parity.NGINX_LOCATIONS)), errors)
        for fragment in fragments:
            self.assertIn(fragment, errors[0])

    def test_settings_default_is_read_from_the_code(self):
        self.assertEqual(parity.settings_upload_default(REPO / parity.CONFIG), 100 * parity.MIB)

    def test_nginx_at_1m_fails_naming_the_file_and_the_fix(self):
        """Named negative case: the production regression that made nginx answer 413."""
        self.copy_repo()
        self.replace_in(parity.NGINX_LOCATIONS, "client_max_body_size 101M;", "client_max_body_size 1M;")
        self.assert_single_upload_error("is 1 MB", "at least 101M")

    def test_nginx_equal_to_the_cap_fails_without_envelope_margin(self):
        self.mini_repo()
        self.replace_in(parity.NGINX_LOCATIONS, "11M", "10M")
        self.assert_single_upload_error("at least 11M")

    def test_nginx_in_gigabytes_passes(self):
        self.mini_repo()
        self.replace_in(parity.NGINX_LOCATIONS, "11M", "1G")
        self.assertEqual(parity.check(self.root), [])

    def test_missing_nginx_file_gives_a_clear_message(self):
        self.mini_repo()
        (self.root / parity.NGINX_LOCATIONS).unlink()
        self.assert_single_upload_error("file not found")

    def test_compose_default_above_nginx_fails(self):
        self.copy_repo()
        self.replace_in(parity.COMPOSE, "${MAX_UPLOAD_SIZE_MB:-100}", "${MAX_UPLOAD_SIZE_MB:-200}")
        self.assert_single_upload_error("docker-compose.yml", "allows 200 MB")

    def test_backend_env_example_above_nginx_fails(self):
        self.copy_repo()
        self.replace_in(parity.BACKEND_ENV_EXAMPLE, "MAX_UPLOAD_SIZE_MB=100", "MAX_UPLOAD_SIZE_MB=150")
        self.assert_single_upload_error("backend/.env.example", "allows 150 MB")

    def test_no_declared_cap_fails(self):
        self.mini_repo()
        self.write(parity.ENV_EXAMPLE, MINI_ENV.replace("MAX_UPLOAD_SIZE_MB=10\n", ""))
        errors = parity.check(self.root)
        self.assertEqual(len(errors), 1, errors)
        self.assertIn("no upload cap declared", errors[0])


if __name__ == "__main__":
    unittest.main()
