#!/usr/bin/env python3
"""C3 - search latency (gestion-projet/innovateur/protocole-mesures-criteres.md).

Plays every query of a frozen file 3 times (the first, cold run is kept) against GET /search/ and prints
the TSV (query, took_ms, end-to-end ms) plus the synthesis line. A query line is `text` or `text<TAB>k=v&k=v`
(filters of the endpoint; `org_unit=<CODE>` is resolved to org_unit_id). Without --threshold only values are printed.
"""
from __future__ import annotations

import argparse
import time
import urllib.parse
from pathlib import Path

from measure_lib import Api, add_common_args, emit

RUNS = 3


def p95(values: list[int]) -> int:
    ordered = sorted(values)
    return ordered[max(0, -(-95 * len(ordered) // 100) - 1)]  # nearest rank: 2nd highest of 30


def p50(values: list[int]) -> int:
    ordered = sorted(values)
    return ordered[(len(ordered) - 1) // 2]


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    add_common_args(p)
    p.add_argument("--queries", required=True, help="c3-queries.txt, one query per line")
    p.add_argument("--threshold-ms", type=int, default=None, help="GO if p95(took_ms) < threshold (protocol: 2000)")
    p.add_argument("--alert-max-ms", type=int, default=None, help="alert if the max on query 1 exceeds it (protocol: 4000)")
    a = p.parse_args()

    api = Api(a.api, a.institution, a.matricule)
    org_ids = {o["code"]: o["id"] for o in api.get("/org-units/")}
    queries = [ln for ln in Path(a.queries).read_text(encoding="utf-8").splitlines() if ln.strip() and not ln.startswith("#")]

    rows, took, e2e = ["query\trun\ttook_ms\te2e_ms\ttotal"], [], []
    first_query_max = 0
    for qi, line in enumerate(queries):
        text, _, extra = line.partition("\t")
        params = [("q", text), ("limit", "20")]
        for pair in filter(None, extra.split("&")):
            k, _, v = pair.partition("=")
            params.append(("org_unit_id", org_ids[v]) if k == "org_unit" else (k, v))
        route = "/search/?" + urllib.parse.urlencode(params)
        for run in range(1, RUNS + 1):
            t0 = time.perf_counter()
            res = api.get(route)
            ms = round((time.perf_counter() - t0) * 1000)
            took.append(round(float(res["took_ms"])))
            e2e.append(ms)
            if qi == 0:
                first_query_max = max(first_query_max, round(float(res["took_ms"])))
            rows.append(f"{text}\t{run}\t{res['took_ms']}\t{ms}\t{res.get('total_count', '')}")
    summary = (f"C3 took_ms p50={p50(took)} p95={p95(took)} max={max(took)} ; e2e p95={p95(e2e)} "
               f"({len(took)} mesures, max requete 1 = {first_query_max} ms)")
    if a.threshold_ms is not None:
        summary += f" ; seuil {a.threshold_ms} ms : {'GO' if p95(took) < a.threshold_ms else 'NO-GO'}"
    if a.alert_max_ms is not None and first_query_max > a.alert_max_ms:
        summary += f" ; ALERTE max requete 1 > {a.alert_max_ms} ms (verifier l'index GIN)"
    emit("\n".join(rows + [summary]), "c3", a.out_dir)


if __name__ == "__main__":
    main()
