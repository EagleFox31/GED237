"""Production guard on SECRET_KEY (#413): no placeholder, no short key."""

import secrets

import pytest

from app.core.config import Settings, check_production_secret_key

PLACEHOLDERS = [
    Settings.model_fields["SECRET_KEY"].default,  # code default
    "dev-secret-key-change-in-production",  # docker-compose.yml and .env.example
    "your-secret-key-change-this-in-production",  # backend/.env.example
    "DEV-SECRET-KEY-" + "x" * 40,  # any key built on the placeholder
]


@pytest.mark.parametrize("key", PLACEHOLDERS)
def test_placeholders_are_refused_in_production(key):
    with pytest.raises(RuntimeError) as excinfo:
        check_production_secret_key("production", key)
    assert "openssl rand -hex 32" in str(excinfo.value)
    assert key not in str(excinfo.value)


def test_short_key_is_refused_in_production():
    with pytest.raises(RuntimeError):
        check_production_secret_key("production", secrets.token_hex(15))  # 30 chars


def test_random_key_is_accepted_in_production():
    check_production_secret_key("production", secrets.token_hex(32))


@pytest.mark.parametrize("environment", ["development", "test", "staging"])
@pytest.mark.parametrize("key", PLACEHOLDERS + ["short"])
def test_other_environments_are_unchanged(environment, key):
    check_production_secret_key(environment, key)
