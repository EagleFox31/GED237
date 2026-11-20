"""A setting read by both the api and the worker reaches both, with one value.

The api and the worker run the same code, each with its own environment in
docker-compose.yml. A flag passed to the worker only is silently false in the
api: the scheduled reports (#180) and the quality alerts (#183) were switched
on for the worker while their api routes kept answering 409 (LESSON-2026-043).

"Read by both" is taken from the code, so a new shared flag is checked without
editing this test: a ``settings.NAME`` read under app/workers/ and elsewhere
under app/.

Read line by line on purpose: no YAML parser is a backend dependency.
"""

import re
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
COMPOSE = BACKEND.parent / "docker-compose.yml"
APP = BACKEND / "app"
SERVICES = ("api", "worker")

TOP_LEVEL_KEY = re.compile(r"^[A-Za-z_][\w-]*:")
SERVICE_KEY = re.compile(r"^  ([A-Za-z_][\w-]*):\s*$")
SERVICE_FIELD = re.compile(r"^    [A-Za-z_][\w-]*:")
ENV_ENTRY = re.compile(r"^      ([A-Z][A-Z0-9_]*):\s*(.*?)\s*$")
SETTING_READ = re.compile(r"\bsettings\.([A-Z][A-Z0-9_]*)\b")


def _environments(text: str) -> dict[str, dict[str, str]]:
    environments: dict[str, dict[str, str]] = {}
    in_services = False
    current = None
    in_env = False
    for line in text.splitlines():
        if TOP_LEVEL_KEY.match(line):
            in_services = line.startswith("services:")
            current, in_env = None, False
            continue
        if not in_services:
            continue
        service = SERVICE_KEY.match(line)
        if service:
            current, in_env = service.group(1), False
            environments[current] = {}
            continue
        if SERVICE_FIELD.match(line):
            in_env = line.strip() == "environment:"
            continue
        entry = ENV_ENTRY.match(line)
        if in_env and current and entry:
            environments[current][entry.group(1)] = entry.group(2).strip("\"'")
    return environments


def _settings_read(paths) -> set[str]:
    return {
        name
        for path in paths
        for name in SETTING_READ.findall(path.read_text(encoding="utf-8"))
    }


def _read_by_api_and_worker() -> set[str]:
    workers = APP / "workers"
    by_worker = _settings_read(workers.rglob("*.py"))
    by_api = _settings_read(p for p in APP.rglob("*.py") if workers not in p.parents)
    return by_worker & by_api


def test_parser_reads_each_service_environment():
    sample = (
        "x-common: &c\n"
        "  A: 1\n"
        "services:\n"
        "  api:\n"
        "    image: x\n"
        "    environment:\n"
        "      FLAG_ENABLED: ${FLAG_ENABLED:-false}\n"
        '      URL: "redis://r"\n'
        "    depends_on:\n"
        "      OTHER: x\n"
        "  worker:\n"
        "    environment:\n"
        "      URL: redis://r\n"
        "volumes:\n"
        "  data:\n"
    )
    assert _environments(sample) == {
        "api": {"FLAG_ENABLED": "${FLAG_ENABLED:-false}", "URL": "redis://r"},
        "worker": {"URL": "redis://r"},
    }


def test_the_shared_settings_are_found_in_the_code():
    shared = _read_by_api_and_worker()
    # Known anchors: if they vanish, the detection broke, not the compose.
    assert {"DATABASE_URL", "SCHEDULED_REPORTS_ENABLED"} <= shared, shared


def test_a_setting_read_by_api_and_worker_is_passed_to_both_alike():
    environments = _environments(COMPOSE.read_text(encoding="utf-8"))
    assert set(SERVICES) <= set(environments), "api or worker renamed: update this test"
    api, worker = (environments[name] for name in SERVICES)
    wrong = {
        name: (api.get(name), worker.get(name))
        for name in sorted(_read_by_api_and_worker())
        if (name in api or name in worker) and api.get(name) != worker.get(name)
    }
    assert not wrong, (
        "docker-compose.yml: pass these to api and worker with the same value "
        f"(api, worker): {wrong}"
    )
