#!/usr/bin/env python3
"""Real counters vs the `expected` section of a manifest (jeu-donnees-demo.md section 5, step 4).

Checks what the API can show: domains, activities, classificationRules, inactiveRules, documents
(classified = live + trash; toReview = open classification reviews, no document), byOrgUnit (classified per target unit),
trash (titles), versions (title -> count). Keys the API cannot answer (imports, locks, live) are listed
as NOT COVERED rather than skipped silently. Prints one line per check with the real value; exit 1 on any mismatch
unless --no-fail (values-only mode).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from measure_lib import Api, add_common_args, code_maps, emit

NOT_COVERED = ("imports", "locks", "live")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    add_common_args(p)
    p.add_argument("--manifest", required=True)
    p.add_argument("--no-fail", action="store_true", help="print values, always exit 0")
    a = p.parse_args()

    expected = json.loads(Path(a.manifest).read_text(encoding="utf-8"))["expected"]
    api = Api(a.api, a.institution, a.matricule)
    maps = code_maps(api)
    live = api.get_all("/documents/")
    trash = api.get_all("/documents/trash")
    docs = live + trash
    lines, bad = [], 0

    def check(name: str, want, got) -> None:
        nonlocal bad
        ok = want == got
        bad += not ok
        lines.append(f"{'OK  ' if ok else 'ECART'} {name}: attendu={want} reel={got}")

    def contains(name: str, want: list, got: set) -> None:
        nonlocal bad
        missing = sorted(set(want) - got)
        bad += bool(missing)
        lines.append(f"{'OK  ' if not missing else 'ECART'} {name}: attendus={len(want)} manquants={missing}")

    if "domains" in expected:
        contains("domains", expected["domains"], set(maps["dom"].values()))
    if "activities" in expected:
        contains("activities", expected["activities"], set(maps["act"].values()))
    rules = {r["code"]: r for r in api.get("/classification-rules/rules")}
    if "classificationRules" in expected:
        contains("classificationRules", expected["classificationRules"], set(rules))
    if "inactiveRules" in expected:
        check("inactiveRules", sorted(expected["inactiveRules"]), sorted(c for c, r in rules.items() if not r["is_active"]))
    # D1 contract: classified = documents created (live + trash); toReview = open classification reviews
    # (no document). Units of another tenant are invisible to this account, so their reviews are not expected.
    visible = set(maps["org"].values())
    foreign = sum(c["toReview"] for u, c in expected.get("byOrgUnit", {}).items() if u not in visible)
    reviews = [r for r in api.get_all("/classification-reviews") if r.get("review_status") == "open"]
    if "documents" in expected:
        e = expected["documents"]
        real = {"classified": sum(d["classification_status"] == "classified" for d in docs),
                "toReview": len(reviews)}
        real["total"] = real["classified"] + real["toReview"]
        want = {**e, "toReview": e["toReview"] - foreign}
        want["total"] = e["total"] - foreign
        for k, v in want.items():
            check(f"documents.{k}" + (f" (hors {foreign} revues d'un autre tenant)" if k != "classified" and foreign else ""), v, real.get(k))
    for unit, e in expected.get("byOrgUnit", {}).items():
        if unit not in visible:
            lines.append(f"OK   byOrgUnit.{unit}: invisible pour ce compte (isolation tenant)")
            continue
        ds = [d for d in docs if maps["org"].get(d.get("classification_target_org_unit_id")) == unit]
        check(f"byOrgUnit.{unit}.classified (unite cible)", e["classified"], len(ds))
    if "trash" in expected:
        check("trash", sorted(expected["trash"]), sorted(d["title"] for d in trash))
    titles = {d["title"]: d for d in docs}
    for title, count in expected.get("versions", {}).items():
        d = titles.get(title)
        got = len(api.get(f"/documents/{d['id']}/versions")) if d else "document absent"
        check(f"versions[{title}]", count, got)
    for k in NOT_COVERED:
        if k in expected:
            lines.append(f"NON COUVERT {k}: pas d'endpoint de lecture (voir la base ou le rapport d'import)")
    lines.append(f"COMPTEURS {len(lines) - sum(ln.startswith('NON') for ln in lines)} controles, {bad} ecart(s)")
    emit("\n".join(lines), "compteurs", a.out_dir)
    if bad and not a.no_fail:
        sys.exit(1)


if __name__ == "__main__":
    main()
