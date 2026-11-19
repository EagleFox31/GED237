"""Every long-running service of the delivered stack comes back after a reboot.

docker-compose.yml is what runs at the client: a service without a ``restart``
policy stays down after the host restarts (the frontend did, until rc.1).
One-shot jobs (migrations, seed) must not restart.

Read line by line on purpose: no YAML parser is a backend dependency.
"""

import os
import re
from pathlib import Path

import pytest

COMPOSE = Path(__file__).resolve().parents[2] / "docker-compose.yml"
ONE_SHOT_SERVICES = {"migrate", "seed"}
RESTARTING_POLICIES = {"unless-stopped", "always"}

TOP_LEVEL_KEY = re.compile(r"^[A-Za-z_][\w-]*:")
SERVICE_KEY = re.compile(r"^  ([A-Za-z_][\w-]*):\s*$")
RESTART_KEY = re.compile(r"""^    restart:\s*["']?([^"'\s#]+)""")


def _restart_policies(text: str) -> dict[str, str | None]:
    policies: dict[str, str | None] = {}
    in_services = False
    current = None
    for line in text.splitlines():
        if TOP_LEVEL_KEY.match(line):
            in_services = line.startswith("services:")
            current = None
            continue
        if not in_services:
            continue
        service = SERVICE_KEY.match(line)
        if service:
            current = service.group(1)
            policies[current] = None
            continue
        restart = RESTART_KEY.match(line)
        if restart and current:
            policies[current] = restart.group(1)
    return policies


def test_parser_reads_services_and_policies():
    sample = (
        "services:\n"
        "  api:\n"
        "    image: x\n"
        "    restart: unless-stopped\n"
        "  job:\n"
        '    restart: "no"\n'
        "  web:\n"
        "    image: y\n"
        "volumes:\n"
        "  data:\n"
    )
    assert _restart_policies(sample) == {
        "api": "unless-stopped",
        "job": "no",
        "web": None,
    }


def _compose_policies() -> dict[str, str | None]:
    # A runner that mounts only backend/ has no docker-compose.yml: skip there.
    # CI checks out the whole repository, so a missing file still fails it.
    if not COMPOSE.is_file() and not os.environ.get("CI"):
        pytest.skip(
            f"{COMPOSE} is not mounted (backend/ only): "
            "run from the repository root to check the restart policies"
        )
    return _restart_policies(COMPOSE.read_text(encoding="utf-8"))


def test_long_running_services_restart_after_a_reboot():
    policies = _compose_policies()
    assert ONE_SHOT_SERVICES <= set(
        policies
    ), "migrate or seed renamed: update this test"
    missing = {
        name: policy
        for name, policy in policies.items()
        if name not in ONE_SHOT_SERVICES and policy not in RESTARTING_POLICIES
    }
    assert (
        not missing
    ), f"docker-compose.yml: add 'restart: unless-stopped' to {sorted(missing)}"


def test_one_shot_jobs_do_not_restart():
    policies = _compose_policies()
    assert {name: policies[name] for name in ONE_SHOT_SERVICES} == {
        name: "no" for name in ONE_SHOT_SERVICES
    }
