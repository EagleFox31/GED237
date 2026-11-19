"""Chronometer of the volume test (item 8): import the batches of a load corpus, wait for the worker.

    python scripts/load_measure.py --root /data/ingest/load --parallel 1 --label calib-1

Runs in the probe service of docker-compose.load.yml (api image: httpx, asyncpg, redis).
1. Logs in as the measuring account (password from MEASURE_PASSWORD, never printed; the API runs in
   development so the OTP comes back in the response).
2. POST /documents/ingest-directory once per ``batch_*`` folder of ``--root``, ``--parallel`` at a time,
   straight to the api port. The call is synchronous: no client timeout, each request is timed.
3. Waits for the worker. Stop rule (protocol of item 8, agreed with I): the Celery queue is empty and the
   number of documents of the corpus carrying ``extra_data.ocr_engine`` has not moved for
   ``--settle-seconds``. A document classified "no rule" stays ``pending`` forever, so "zero pending"
   is not a stop rule. Every imported document without text at the end is a loss (worker failure).
4. Times the read side on the loaded base: first page of GET /documents/, with a common word and with
   one reference (``--read-repeats`` calls each, median and max, X-Total-Count when sent).
5. Stops at ``--cap-seconds`` (default 2 h 30) and publishes the rate seen and what is left.

Writes ``<out-dir>/<label>.json`` and ``<label>.txt`` (rates, per batch times, losses, classification
statuses overall and for the family without keyword).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
from collections import Counter
from pathlib import Path

import asyncpg
import httpx
import redis.asyncio as aioredis

sys.path.insert(0, str(Path(__file__).resolve().parent))

from load_dataset import FAMILIES, MANIFEST_NAME  # noqa: E402

REFERENCE = re.compile(r"LOAD-(\d{6})")
NO_KEYWORD_FAMILY = "sans_mot_cle"


async def login(client: httpx.AsyncClient, institution: str, matricule: str) -> str:
    password = os.environ.get("MEASURE_PASSWORD")
    if not password:
        sys.exit("MEASURE_PASSWORD is required")
    res = await client.post(
        "/auth/login",
        json={"institution": institution, "matricule": matricule, "password": password},
    )
    res.raise_for_status()
    body = res.json()
    if not body.get("otp"):
        sys.exit("the API did not echo the OTP: ENVIRONMENT must be development")
    res = await client.post(
        "/auth/verify-otp",
        json={"session_token": body["session_token"], "otp": body["otp"]},
    )
    res.raise_for_status()
    return res.json()["access_token"]


async def ingest_batch(
    client: httpx.AsyncClient, args, folder: Path, t0: float
) -> dict:
    # One login per batch: an access token may expire while earlier batches run.
    token = await login(client, args.institution, args.matricule)
    start = time.monotonic()
    res = await client.post(
        "/documents/ingest-directory",
        json={"directory_path": str(folder), "recursive": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    end = time.monotonic()
    row = {
        "batch": folder.name,
        "start_s": round(start - t0, 1),
        "seconds": round(end - start, 1),
        "http": res.status_code,
    }
    if res.status_code == 200:
        body = res.json()
        row.update(
            found=body["total_found"],
            imported=body["imported"],
            duplicates=body.get("duplicate_count", 0),
            errors=body["error_count"],
        )
    else:
        row["detail"] = res.text[:300]
    print(
        f"  {row['batch']}: {row.get('imported', 0)} imported in {row['seconds']} s (HTTP {row['http']})",
        flush=True,
    )
    return row


async def progress(
    db: asyncpg.Connection, queue: aioredis.Redis, prefix: str
) -> tuple[int, int, int]:
    total, with_text = await db.fetchrow(
        "SELECT count(*), count(*) FILTER (WHERE extra_data ? 'ocr_engine') FROM documents "
        "WHERE extra_data->>'source_path' LIKE $1",
        prefix + "%",
    )
    return total, with_text, await queue.llen("celery")


async def statuses(db: asyncpg.Connection, prefix: str) -> dict:
    rows = await db.fetch(
        "SELECT extra_data->>'source_path' AS path, classification_status AS status FROM documents "
        "WHERE extra_data->>'source_path' LIKE $1",
        prefix + "%",
    )
    overall, no_keyword = Counter(), Counter()
    for row in rows:
        overall[row["status"]] += 1
        match = REFERENCE.search(row["path"])
        if (
            match
            and FAMILIES[(int(match.group(1)) - 1) % len(FAMILIES)] == NO_KEYWORD_FAMILY
        ):
            no_keyword[row["status"]] += 1
    return {"overall": dict(overall), NO_KEYWORD_FAMILY: dict(no_keyword)}


# Read side once the corpus is in: first page of the list, a word found in almost every
# document (worst case for search + total), a reference found in one document.
READ_QUERIES = (
    ("liste", None),
    ("mot courant", "bordereau"),
    ("reference", "LOAD-000042"),
)


async def read_timings(client: httpx.AsyncClient, args) -> list[dict]:
    """Time GET /documents/ (first page of 100) for each query; X-Total-Count when the API sends it."""
    token = await login(client, args.institution, args.matricule)
    rows = []
    for name, q in READ_QUERIES:
        params = {"limit": 100} | ({"q": q} if q else {})
        times, status, count, total = [], None, None, None
        for _ in range(args.read_repeats):
            start = time.monotonic()
            res = await client.get(
                "/documents/",
                params=params,
                headers={"Authorization": f"Bearer {token}"},
            )
            times.append(time.monotonic() - start)
            status = res.status_code
            if status == 200:
                count, total = len(res.json()), res.headers.get("x-total-count")
        times.sort()
        rows.append(
            {
                "name": name,
                "q": q,
                "http": status,
                "returned": count,
                "total_header": total,
                "median_ms": round(times[len(times) // 2] * 1000),
                "max_ms": round(times[-1] * 1000),
            }
        )
    return rows


async def run(args) -> dict:
    root = Path(args.root)
    corpus = json.loads((root / MANIFEST_NAME).read_text(encoding="utf-8"))
    folders = sorted(
        p for p in root.iterdir() if p.is_dir() and p.name.startswith("batch_")
    )
    prefix = str(root).rstrip("/") + "/"
    db = await asyncpg.connect(
        os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    )
    queue = aioredis.from_url(os.environ["CELERY_BROKER_URL"])
    already, _, _ = await progress(db, queue, prefix)
    if already:
        sys.exit(
            f"{already} documents of {root} are already in the database: reset the stack first"
        )

    print(
        f"=== {args.label}: {corpus['files']} files in {len(folders)} batches, parallel {args.parallel} ===",
        flush=True,
    )
    t0 = time.monotonic()
    gate = asyncio.Semaphore(args.parallel)
    async with httpx.AsyncClient(
        base_url=args.api, timeout=httpx.Timeout(None, connect=10)
    ) as client:

        async def guarded(folder: Path) -> dict:
            async with gate:
                return await ingest_batch(client, args, folder, t0)

        batches = await asyncio.gather(*(guarded(f) for f in folders))
    ingest_s = time.monotonic() - t0
    imported = sum(b.get("imported", 0) for b in batches)

    samples, stable_since, last, capped = [], None, -1, False
    while True:
        total, with_text, queued = await progress(db, queue, prefix)
        now = time.monotonic() - t0
        samples.append(
            {
                "t_s": round(now, 1),
                "documents": total,
                "with_text": with_text,
                "queued": queued,
            }
        )
        if with_text != last:
            last, stable_since = with_text, now
        if queued == 0 and (
            with_text >= imported or now - stable_since >= args.settle_seconds
        ):
            break
        if now >= args.cap_seconds:
            capped = True
            break
        await asyncio.sleep(args.poll_seconds)
    # Last change of the text count: when the worker really finished (not when we noticed).
    done_s = stable_since if not capped else time.monotonic() - t0
    total, with_text, queued = await progress(db, queue, prefix)
    async with httpx.AsyncClient(
        base_url=args.api, timeout=httpx.Timeout(120, connect=10)
    ) as client:
        reads = await read_timings(client, args) if args.read_repeats > 0 else []
    result = {
        "label": args.label,
        "git_sha": os.environ.get("LOAD_GIT_SHA", "unknown"),
        "corpus": {k: corpus[k] for k in ("params", "files", "bytes", "sha256")},
        "parallel": args.parallel,
        "batches": batches,
        "ingest_seconds": round(ingest_s, 1),
        "total_seconds": round(done_s, 1),
        "worker_tail_seconds": round(max(0.0, done_s - ingest_s), 1),
        "imported": imported,
        "documents": total,
        "with_text": with_text,
        "queued_at_end": queued,
        "losses": corpus["files"] - with_text if not capped else None,
        "capped": capped,
        "rate_files_per_s": round(with_text / done_s, 1) if done_s else None,
        "ingest_rate_files_per_s": round(imported / ingest_s, 1) if ingest_s else None,
        "statuses": await statuses(db, prefix),
        "reads": reads,
        "samples": samples,
    }
    await db.close()
    await queue.aclose()
    return result


def report(r: dict) -> str:
    p = r["corpus"]["params"]
    lines = [
        f"Charge {r['label']} - main {r['git_sha']}",
        f"Corpus : {r['corpus']['files']} PDF texte, {p['size_kb'][0]}-{p['size_kb'][1]} Ko, "
        f"{r['corpus']['bytes'] / 2**20:.1f} Mo, {p['batches']} lots, sha256 {r['corpus']['sha256'][:12]}",
        f"Lots en parallele : {r['parallel']}",
        f"Import (requetes) : {r['imported']} importes en {r['ingest_seconds']} s ({r['ingest_rate_files_per_s']} fichiers/s)",
        f"Fin du worker : {r['total_seconds']} s au total, dont {r['worker_tail_seconds']} s apres la derniere requete",
        f"Debit de bout en bout : {r['rate_files_per_s']} fichiers/s (texte lu / temps total)",
        "Projection 100 000 : "
        + (
            f"{100_000 / r['rate_files_per_s'] / 60:.0f} min (seuil 20 min = 84 fichiers/s)"
            if r["rate_files_per_s"]
            else "n/a"
        ),
        f"Avec texte : {r['with_text']} / {r['corpus']['files']}  file restante : {r['queued_at_end']}",
        "Plafond atteint : reste a traiter "
        + str(r["corpus"]["files"] - r["with_text"])
        if r["capped"]
        else f"Pertes (importe sans texte ou manquant) : {r['losses']}",
        f"Statuts : {r['statuses']['overall']}",
        f"Statuts famille {NO_KEYWORD_FAMILY} : {r['statuses'][NO_KEYWORD_FAMILY]}",
        "Lots (nom, debut s, duree s, importes, doublons, erreurs, HTTP) :",
    ]
    lines += [
        f"  {b['batch']} {b['start_s']} {b['seconds']} {b.get('imported')} {b.get('duplicates')} {b.get('errors')} {b['http']}"
        for b in r["batches"]
    ]
    if r.get("reads"):
        lines.append(
            "Lecture GET /documents/ apres import (page de 100, mediane / max, total) :"
        )
        lines += [
            f"  {x['name']}{' q=' + x['q'] if x['q'] else ''} : {x['median_ms']} / {x['max_ms']} ms, "
            f"HTTP {x['http']}, {x['returned']} rendus, total {x['total_header'] or 'non envoye'}"
            for x in r["reads"]
        ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--root",
        required=True,
        help="load corpus (batch_* folders and load-manifest.json)",
    )
    parser.add_argument("--label", required=True, help="name of the result files")
    parser.add_argument(
        "--parallel", type=int, default=1, help="batches posted at the same time"
    )
    parser.add_argument(
        "--api", default=os.environ.get("MEASURE_API", "http://api:8000/api/v1")
    )
    parser.add_argument(
        "--institution", default=os.environ.get("MEASURE_INSTITUTION", "MINFI")
    )
    parser.add_argument(
        "--matricule", default=os.environ.get("MEASURE_MATRICULE", "MINFI001")
    )
    parser.add_argument("--settle-seconds", type=float, default=20)
    parser.add_argument("--poll-seconds", type=float, default=5)
    parser.add_argument(
        "--cap-seconds", type=float, default=9000, help="hard stop (default 2 h 30)"
    )
    parser.add_argument(
        "--read-repeats", type=int, default=5, help="timed reads per query, 0 = none"
    )
    parser.add_argument("--out-dir", default="/results/charge")
    args = parser.parse_args()
    result = asyncio.run(run(args))
    text = report(result)
    print(text)
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{args.label}.json").write_text(
        json.dumps(result, indent=2) + "\n", encoding="utf-8"
    )
    (out / f"{args.label}.txt").write_text(text + "\n", encoding="utf-8")
    lost = result["losses"]
    return 0 if lost == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
