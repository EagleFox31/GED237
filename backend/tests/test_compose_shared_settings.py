"""Every setting the api or the worker reads is wired, or knowingly left out.

The api and the worker run the same code, each with its own environment in the
compose files. A setting read by a service but absent from its environment
silently takes the code default: the scheduled reports (#180) and the quality
alerts (#183) were switched on for the worker while their api routes kept
answering 409; #165, #192 and #152 shipped settings no stack could change
(LESSON-2026-043).

What each service reads is taken from the code, so a new setting is checked
without editing this test: the reads of a Settings field (``settings.NAME``,
``cfg.NAME``) in every module the service loads, following the ``app`` imports from its entry point
(app/main.py for the api, app/workers/ for the worker).

Each such setting must be:
- passed in the environment of every compose file that fully defines the
  service (``build`` or ``image``), docker-compose.e2e.yml excepted;
- listed in backend/.env.example, the operator's reference;
unless EXEMPT gives the reason it is not.

Read line by line on purpose: no YAML parser is a backend dependency. A service
environment the parser cannot read (anchor, merge key, list form) fails the
test instead of passing unseen.
"""

import re
from pathlib import Path

from app.core.config import Settings

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
COMPOSE = ROOT / "docker-compose.yml"
ENV_EXAMPLE = BACKEND / ".env.example"
APP = BACKEND / "app"
CONFIG = APP / "core" / "config.py"
SERVICES = ("api", "worker")

# The e2e stack belongs to the QA test chain, which sets only what its
# scenarios need; its settings are checked by those scenarios, not here.
COMPOSE_NOT_CHECKED = {"docker-compose.e2e.yml"}

# Read by the code, not passed by the compose files: the code default is the
# wanted value in every stack. Kept in backend/.env.example unless said so.
EXEMPT_FROM_COMPOSE = {
    "ALGORITHM": "token signature; changing it invalidates every token",
    "ACCESS_TOKEN_EXPIRE_MINUTES": "session policy set in code",
    "REFRESH_TOKEN_EXPIRE_DAYS": "session policy set in code",
    "AUTH_REFRESH_RATE_LIMIT": "default fits the demo room (one refresh per session)",
    "AUTHZ_BACKEND": "policy.csv is the only source in the stacks",
    "AUTHZ_POLICY_DATABASE_URL": "used only with AUTHZ_BACKEND=sql or shadow",
    "AUTHZ_METRICS_BACKEND": "in-memory metrics in the stacks",
    "AUTHZ_METRICS_REDIS_URL": "used only with AUTHZ_METRICS_BACKEND=redis",
    "AUTHZ_METRICS_REDIS_PREFIX": "used only with AUTHZ_METRICS_BACKEND=redis",
    "DATABASE_POOL_SIZE": "pool sized in code for the stack caps",
    "DATABASE_MAX_OVERFLOW": "pool sized in code for the stack caps",
    "DEFAULT_TENANT_STORAGE_QUOTA_MB": "quota of a new tenant, changed per tenant",
    "MAX_UPLOAD_SIZE_MB": "100 MiB default, matched by nginx client_max_body_size",
    "SCHEMA_CHECK_MODE": "fail: a stack never starts on a stale schema",
}

# Settings derived from others: the env name an operator sets is the source.
DERIVED = {
    "MAX_UPLOAD_SIZE": "MAX_UPLOAD_SIZE_MB",
    "AUTHZ_EFFECTIVE_POLICY_DATABASE_URL": "AUTHZ_POLICY_DATABASE_URL",
}

TOP_LEVEL_KEY = re.compile(r"^[A-Za-z_][\w-]*:")
SERVICE_KEY = re.compile(r"^  ([A-Za-z_][\w-]*):\s*$")
SERVICE_FIELD = re.compile(r"^    ([A-Za-z_<][\w<-]*):\s*(.*?)\s*$")
ENV_ENTRY = re.compile(r"^      ([A-Z][A-Z0-9_]*):\s*(.*?)\s*$")
ENV_OTHER = re.compile(r"^      [^\s#]")
# Any upper-case attribute named after a field: settings.X, cfg.X, get_settings().X.
SETTING_READ = re.compile(r"\.([A-Z][A-Z0-9_]*)\b")
APP_IMPORT = re.compile(
    r"^\s*(?:from\s+(app(?:\.\w+)*)\s+import\s+(\([^)]*\)|[^\n]+)"
    r"|import\s+(app(?:\.\w+)*))",
    re.M,
)
ENV_EXAMPLE_NAME = re.compile(r"^#?\s*([A-Z][A-Z0-9_]*)=", re.M)

UNREADABLE = "<unreadable>"


def _services(text: str) -> dict[str, dict]:
    """Per service: its fields (``build``, ``image``…) and its environment.

    An environment given by anchor, merge key or list form is recorded under
    UNREADABLE so the caller can refuse it.
    """
    services: dict[str, dict] = {}
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
            services[current] = {"fields": set(), "environment": {}}
            continue
        if current is None:
            continue
        field = SERVICE_FIELD.match(line)
        if field:
            key, value = field.groups()
            services[current]["fields"].add(key)
            in_env = key == "environment"
            if in_env and value:
                services[current]["environment"][UNREADABLE] = value
            continue
        if not in_env:
            continue
        entry = ENV_ENTRY.match(line)
        if entry:
            services[current]["environment"][entry.group(1)] = entry.group(2).strip(
                "\"'"
            )
        elif ENV_OTHER.match(line):
            services[current]["environment"][UNREADABLE] = line.strip()
    return services


def _environments(text: str) -> dict[str, dict[str, str]]:
    return {name: s["environment"] for name, s in _services(text).items()}


def _module_file(module: str):
    path = BACKEND.joinpath(*module.split("."))
    for candidate in (path.with_suffix(".py"), path / "__init__.py"):
        if candidate.exists():
            return candidate
    return None


def _loaded_files(entry_points) -> set[Path]:
    """Files reached from the entry points through ``app`` imports."""
    seen: set[Path] = set()
    todo = list(entry_points)
    while todo:
        path = todo.pop()
        if path in seen:
            continue
        seen.add(path)
        for match in APP_IMPORT.finditer(path.read_text(encoding="utf-8")):
            module = match.group(1) or match.group(3)
            parts = module.split(".")
            candidates = [".".join(parts[:i]) for i in range(1, len(parts) + 1)]
            if match.group(2):
                names = match.group(2).strip("()").replace("\n", " ").split(",")
                candidates += [
                    f"{module}.{name.split(' as ')[0].strip()}"
                    for name in names
                    if name.strip() and not name.strip().startswith("#")
                ]
            for candidate in candidates:
                found = _module_file(candidate)
                if found and found not in seen:
                    todo.append(found)
    return seen


def _env_names() -> dict[str, str]:
    """Attribute read in the code -> variable an operator sets."""
    names: dict[str, str] = {}
    for name, field in Settings.model_fields.items():
        names[name] = field.alias or name
        if field.alias:
            names[field.alias] = field.alias
    names.update(DERIVED)
    return names


def _settings_read(paths) -> set[str]:
    names = _env_names()
    return {
        names[attribute]
        for path in paths
        if path != CONFIG  # where the fields are defined, not read
        for attribute in SETTING_READ.findall(path.read_text(encoding="utf-8"))
        if attribute in names
    }


def _read_by_service() -> dict[str, set[str]]:
    workers = list((APP / "workers").rglob("*.py"))
    return {
        "api": _settings_read(_loaded_files([APP / "main.py"])),
        "worker": _settings_read(_loaded_files(workers)),
    }


def _read_by_api_and_worker() -> set[str]:
    read = _read_by_service()
    return read["api"] & read["worker"]


def _compose_files() -> list[Path]:
    return sorted(
        p for p in ROOT.glob("docker-compose*.yml") if p.name not in COMPOSE_NOT_CHECKED
    )


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
    assert _services(sample)["api"]["fields"] == {"image", "environment", "depends_on"}


def test_parser_flags_an_environment_it_cannot_read():
    sample = (
        "services:\n"
        "  api:\n"
        "    environment: *common\n"
        "  worker:\n"
        "    environment:\n"
        "      <<: *common\n"
        "  beat:\n"
        "    environment:\n"
        "      - URL=redis://r\n"
    )
    assert all(UNREADABLE in env for env in _environments(sample).values())


def test_the_settings_read_are_found_in_the_code():
    read = _read_by_service()
    # Known anchors: if they vanish, the detection broke, not the compose.
    assert {"DATABASE_URL", "INGEST_WATCH_FOLDERS"} <= _read_by_api_and_worker()
    assert {"ALLOWED_ORIGINS", "RECENT_DOCUMENTS_TRACKING_ENABLED"} <= read["api"]
    assert "INGEST_WATCH_FOLDERS" in read["worker"]


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


def test_each_setting_a_service_reads_is_passed_by_every_compose_file():
    read = _read_by_service()
    missing: dict[str, list[str]] = {}
    checked = 0
    for path in _compose_files():
        for name, service in _services(path.read_text(encoding="utf-8")).items():
            if name not in SERVICES or not service["fields"] & {"build", "image"}:
                continue
            checked += 1
            environment = service["environment"]
            assert UNREADABLE not in environment, (
                f"{path.name} {name}: environment not readable by this test "
                f"({environment[UNREADABLE]}); write it as NAME: value lines"
            )
            gaps = sorted(read[name] - set(environment) - set(EXEMPT_FROM_COMPOSE))
            if gaps:
                missing[f"{path.name} {name}"] = gaps
    assert checked >= len(SERVICES), "no compose file defines api and worker"
    assert not missing, (
        "Pass these settings in the service environment, or add them to "
        f"EXEMPT_FROM_COMPOSE with the reason: {missing}"
    )


def test_each_setting_read_is_listed_in_the_env_example():
    listed = set(ENV_EXAMPLE_NAME.findall(ENV_EXAMPLE.read_text(encoding="utf-8")))
    read = set().union(*_read_by_service().values())
    assert not sorted(
        read - listed
    ), f"backend/.env.example: document these settings: {sorted(read - listed)}"


def test_exemptions_stay_current():
    read = set().union(*_read_by_service().values())
    stale = sorted(set(EXEMPT_FROM_COMPOSE) - read)
    assert not stale, f"EXEMPT_FROM_COMPOSE: no longer read, remove {stale}"
