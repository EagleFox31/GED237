#!/usr/bin/env python3
"""C2 - classification rate (gestion-projet/innovateur/protocole-mesures-criteres.md).

Reads the "files" list of a demo manifest (expected.files: path, status, orgUnit, domain, activity, year)
and compares it with the documents the API holds. Prints the C2 block and the list of deviations.
Without --threshold it only prints values; with it, a GO / NO-GO line is added.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from measure_lib import Api, add_common_args, code_maps, emit, pct


def destination(doc: dict, maps: dict) -> dict:
    return {
        "orgUnit": maps["org"].get(doc.get("classification_target_org_unit_id")),
        "domain": maps["dom"].get(doc.get("classification_domain_id")),
        "activity": maps["act"].get(doc.get("classification_activity_id")),
        "year": doc.get("classification_year"),
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    add_common_args(p)
    p.add_argument("--manifest", required=True, help="demo-manifest.json (expected.files)")
    p.add_argument("--match", choices=["path", "title"], default="path",
                   help="join key: documents.source_relative_path (default) or title")
    p.add_argument("--threshold", type=float, default=None, help="C2 GO threshold in %% (protocol: 95)")
    a = p.parse_args()

    files = json.loads(Path(a.manifest).read_text(encoding="utf-8"))["expected"]["files"]
    api = Api(a.api, a.institution, a.matricule)
    maps = code_maps(api)
    docs = api.get_all("/documents/")
    key = "source_relative_path" if a.match == "path" else "title"
    by_key = {d.get(key): d for d in docs if d.get(key)}

    dup = [f for f in files if f["status"] == "duplicate"]
    nr = [f for f in files if f["status"] == "needs_review"]
    covered = [f for f in files if f["status"] == "classified"]
    good, bad, unclassified, deviations = 0, 0, 0, []
    for f in covered:
        label = f.get("path") or f.get("title")
        d = by_key.get(f.get(a.match))
        if d is None:
            unclassified += 1
            deviations.append(f"ABSENT      {label}")
        elif d["classification_status"] != "classified":
            unclassified += 1
            deviations.append(f"NON CLASSE  {label} (statut {d['classification_status']})")
        else:
            got, diffs = destination(d, maps), []
            for k in ("orgUnit", "domain", "activity", "year"):
                if f.get(k) is not None and got[k] != f[k]:
                    diffs.append(f"{k}: attendu {f[k]} obtenu {got[k]}")
            if diffs:
                bad += 1
                deviations.append(f"MAUVAISE DESTINATION  {label}({'; '.join(diffs)})")
            else:
                good += 1
    den = len(covered)
    raw_den = len(files) - len(dup)
    lines = [
        f"C2  total_seed={len(files)} exclus_doublons={len(dup)} exclus_attendus_needs_review={len(nr)} denominateur={den}",
        f"    classes_bonne_destination={good} classes_mauvaise_destination={bad} non_classes_couverts={unclassified}",
        f"    C2 = {good}/{den} = {pct(good, den)}   C2b (brut, hors doublons) = {good}/{raw_den} = {pct(good, raw_den)}",
    ]
    if a.threshold is not None and den:
        lines.append(f"    seuil {a.threshold:.1f} % : {'GO' if 100 * good / den >= a.threshold else 'NO-GO'}")
    lines.append(f"ECARTS ({len(deviations)})")
    lines += [f"  {d}" for d in deviations] or ["  aucun"]
    emit("\n".join(lines), "c2", a.out_dir)


if __name__ == "__main__":
    main()
