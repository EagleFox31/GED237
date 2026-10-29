"""Fail when the impact map and the workflows disagree on gate names.

A job guarded by a gate that no surface emits is skipped forever while the CI Gate stays green.
Same script for the pre-commit hook and the CI job (`Workflow lint`).
"""

import json
import re
import sys
from pathlib import Path

IMPACT_MAP = Path(".github/appfactory-impact.json")
WORKFLOWS = Path(".github/workflows")
# Callers test needs.impact.outputs.gates; reusable workflows test their `gates` input.
CONSUMED = re.compile(r"contains\(fromJSON\((needs\.impact\.outputs|inputs)\.gates\), '([^']+)'\)")
# Default of a `gates:` workflow input: what a manual run or a caller without `with:` executes.
INPUT_DEFAULT = re.compile(r"^ +gates:\n(?: +(?!default:)\S.*\n)*? +default: '(\[[^']*\])'", re.MULTILINE)


def main() -> int:
    surfaces = json.loads(IMPACT_MAP.read_text(encoding="utf-8"))["surfaces"]
    declared = {gate for surface in surfaces.values() for gate in surface.get("gates", [])}
    consumed = set()
    errors = []

    for workflow in sorted(WORKFLOWS.glob("*.y*ml")):
        text = workflow.read_text(encoding="utf-8")
        uses = CONSUMED.findall(text)
        consumed.update(gate for _, gate in uses)
        local = {gate for source, gate in uses if source == "inputs"}
        if not local:
            continue
        defaults = INPUT_DEFAULT.findall(text)
        if not defaults:
            errors.append(f"{workflow.as_posix()}: input 'gates' has no default; manual runs would skip {sorted(local)}")
        for default in defaults:
            missing = local - set(json.loads(default))
            if missing:
                errors.append(f"{workflow.as_posix()}: default of input 'gates' lacks {sorted(missing)}; manual runs would skip them")

    for gate in sorted(consumed - declared):
        errors.append(f"gate '{gate}' is used in {WORKFLOWS.as_posix()} but no surface of {IMPACT_MAP.as_posix()} emits it: its job would never run")
    for gate in sorted(declared - consumed):
        errors.append(f"gate '{gate}' is declared in {IMPACT_MAP.as_posix()} but no workflow uses it: guard a job with it or remove it")

    for error in errors:
        print(f"check-impact-gates: {error}", file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
