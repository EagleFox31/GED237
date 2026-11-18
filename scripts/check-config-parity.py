"""Fail when a setting exists in the code but never reaches the Docker containers.

The api and worker services of docker-compose.yml have an explicit `environment` block:
a variable of `.env` reaches a container only if the compose file names it. A `VITE_*`
variable is frozen at build time: it needs an `ARG` in frontend/Dockerfile and a
`build.args` entry in the compose file.

Checks (static, nothing is imported):
- each `Settings` field of backend/app/core/config.py is in the root `.env.example` and in
  the `environment` block of the `api` or `worker` service;
- each `import.meta.env.VITE_*` read by the frontend is in the root `.env.example`, is an
  `ARG` of frontend/Dockerfile and a `build.args` entry of the `frontend` service.

Deliberate gaps go in scripts/config-parity-exceptions.txt, one line each:
`NAME | scope | reason`, scope = env-example, compose or all. A line without a reason,
or one that no longer matches a gap, fails the check.

Usage: python scripts/check-config-parity.py [--root DIR]
Same script for the pre-commit hook and the CI job.
"""

import argparse
import ast
import re
import sys
from pathlib import Path

CONFIG = Path("backend/app/core/config.py")
COMPOSE = Path("docker-compose.yml")
ENV_EXAMPLE = Path(".env.example")
FRONT_DOCKERFILE = Path("frontend/Dockerfile")
FRONTEND = Path("frontend")
EXCEPTIONS = Path("scripts/config-parity-exceptions.txt")

SCOPES = {"env-example", "compose", "all"}
BACKEND_SERVICES = ("api", "worker")
VITE_READ = re.compile(r"import\.meta\.env\.(VITE_[A-Z0-9_]+)")
ENV_LINE = re.compile(r"^#?\s*([A-Z][A-Z0-9_]*)=", re.MULTILINE)
ARG_LINE = re.compile(r"^\s*ARG\s+([A-Z][A-Z0-9_]*)", re.MULTILINE)
SKIP_DIRS = {"node_modules", "dist", "e2e", "test-results", "playwright-report"}


def settings_variables(path: Path) -> list[str]:
    """Environment names of the Settings fields (the alias when one is set)."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == "Settings":
            break
    else:
        raise SystemExit(f"{path}: class Settings not found")

    names = []
    for item in node.body:
        if not (isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name)):
            continue
        if item.target.id == "model_config":
            continue
        name = item.target.id
        if isinstance(item.value, ast.Call):
            for keyword in item.value.keywords:
                if keyword.arg == "alias" and isinstance(keyword.value, ast.Constant):
                    name = keyword.value.value
        names.append(name)
    return names


def compose_keys(path: Path) -> dict[str, dict[str, set[str]]]:
    """{service: {"environment": {...}, "args": {...}}} for a plain compose file."""
    services: dict[str, dict[str, set[str]]] = {}
    in_services = False
    service = None
    block = None  # ("environment" | "args", indent of its items)
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.split(" #", 1)[0].rstrip() if not raw.lstrip().startswith("#") else ""
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip())
        text = line.strip()
        if indent == 0:
            in_services = text == "services:"
            service = block = None
            continue
        if not in_services:
            continue
        if indent == 2 and text.endswith(":"):
            service = text[:-1]
            services[service] = {"environment": set(), "args": set()}
            block = None
            continue
        if service is None:
            continue
        if block and indent > block[1]:
            item = text[2:] if text.startswith("- ") else text
            key = re.split(r"[=:]", item, maxsplit=1)[0].strip().strip("\"'")
            if key:
                services[service][block[0]].add(key)
            continue
        block = None
        if text == "environment:":
            block = ("environment", indent)
        elif text == "args:":
            block = ("args", indent)
    return services


def frontend_variables(root: Path) -> list[str]:
    found = set()
    for path in (root / FRONTEND).rglob("*"):
        if path.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue
        if SKIP_DIRS.intersection(path.relative_to(root / FRONTEND).parts):
            continue
        found.update(VITE_READ.findall(path.read_text(encoding="utf-8", errors="ignore")))
    return sorted(found)


def read_exceptions(path: Path) -> tuple[dict[tuple[str, str], str], list[str]]:
    exceptions: dict[tuple[str, str], str] = {}
    errors = []
    if not path.exists():
        return exceptions, errors
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [part.strip() for part in line.split("|")]
        if len(parts) != 3 or not parts[2]:
            errors.append(f"{path}:{number}: expected `NAME | scope | reason`, got: {line}")
            continue
        name, scope, reason = parts
        if scope not in SCOPES:
            errors.append(f"{path}:{number}: scope must be one of {sorted(SCOPES)}: {line}")
            continue
        exceptions[(name, scope)] = reason
    return exceptions, errors


def check(root: Path) -> list[str]:
    exceptions, errors = read_exceptions(root / EXCEPTIONS)
    used: set[tuple[str, str]] = set()

    def exempt(name: str, scope: str) -> bool:
        for key in ((name, scope), (name, "all")):
            if key in exceptions:
                used.add(key)
                return True
        return False

    env_example = set(ENV_LINE.findall((root / ENV_EXAMPLE).read_text(encoding="utf-8")))
    compose = compose_keys(root / COMPOSE)
    backend_env = set().union(
        *(compose.get(s, {}).get("environment", set()) for s in BACKEND_SERVICES)
    )

    for name in settings_variables(root / CONFIG):
        if name not in env_example and not exempt(name, "env-example"):
            errors.append(
                f"{name}: Settings field missing from {ENV_EXAMPLE} "
                f"(add `{name}=<default>` with a comment, or an exception with its reason)"
            )
        if name not in backend_env and not exempt(name, "compose"):
            errors.append(
                f"{name}: Settings field not passed to the containers: add "
                f"`{name}: ${{{name}:-<default>}}` to the environment of the api and/or "
                f"worker service in {COMPOSE}"
            )

    front_args = compose.get("frontend", {}).get("args", set())
    docker_args = set(ARG_LINE.findall((root / FRONT_DOCKERFILE).read_text(encoding="utf-8")))
    for name in frontend_variables(root):
        if name not in env_example and not exempt(name, "env-example"):
            errors.append(f"{name}: read by the frontend, missing from {ENV_EXAMPLE}")
        if (name not in docker_args or name not in front_args) and not exempt(name, "compose"):
            errors.append(
                f"{name}: read by the frontend, needs `ARG {name}` in {FRONT_DOCKERFILE} "
                f"and `{name}` under build.args of the frontend service in {COMPOSE}"
            )

    for key in sorted(set(exceptions) - used):
        errors.append(
            f"{EXCEPTIONS}: `{key[0]} | {key[1]}` matches no gap any more: remove the line"
        )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args()
    errors = check(args.root)
    for error in errors:
        print(f"config parity: {error}")
    if errors:
        print(f"config parity: {len(errors)} gap(s), see scripts/check-config-parity.py")
        return 1
    print("config parity: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
