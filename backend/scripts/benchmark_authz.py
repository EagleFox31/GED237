# backend/scripts/benchmark_authz.py
#!/usr/bin/env python3
"""
Quick AuthZ benchmark: CSV vs SQL enforcement latency.

This script runs N enforce() calls for both backends and prints p50/p95/p99 in ms.
It exits non-zero when SQL p99 exceeds threshold.

Usage:
  python scripts/benchmark_authz.py --iterations 1000 --sql-p99-max-ms 5 --sql-vs-csv-max-ratio 2.0
"""

from __future__ import annotations

import argparse
import statistics
import time
from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from casbin import Enforcer
from casbin_sqlalchemy_adapter import Adapter
from sqlalchemy import create_engine, text

from app.core.config import settings
from app.models.casbin_rule import CasbinRule


def _model_path() -> Path:
    return (
        Path(__file__).resolve().parent.parent / "app" / "core" / "authz" / "model.conf"
    )


def _policy_path() -> Path:
    return (
        Path(__file__).resolve().parent.parent / "app" / "core" / "authz" / "policy.csv"
    )


def _to_sync_sqlalchemy_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if url.startswith("sqlite+aiosqlite://"):
        return url.replace("sqlite+aiosqlite://", "sqlite://", 1)
    return url


def _percentile_ms(values_ms: list[float], p: float) -> float:
    if not values_ms:
        return 0.0
    rank = max(
        0, min(len(values_ms) - 1, int(round((p / 100.0) * (len(values_ms) - 1))))
    )
    return sorted(values_ms)[rank]


def _time_enforce(
    enforcer: Enforcer, iterations: int, args: tuple[str, str, str]
) -> list[float]:
    durations_ms: list[float] = []
    for _ in range(iterations):
        start = time.perf_counter()
        enforcer.enforce(*args)
        durations_ms.append((time.perf_counter() - start) * 1000.0)
    return durations_ms


def _print_stats(label: str, values_ms: list[float]) -> dict[str, float]:
    stats = {
        "p50_ms": _percentile_ms(values_ms, 50),
        "p95_ms": _percentile_ms(values_ms, 95),
        "p99_ms": _percentile_ms(values_ms, 99),
        "mean_ms": statistics.fmean(values_ms) if values_ms else 0.0,
    }
    print(
        f"{label}: p50={stats['p50_ms']:.3f}ms "
        f"p95={stats['p95_ms']:.3f}ms "
        f"p99={stats['p99_ms']:.3f}ms "
        f"mean={stats['mean_ms']:.3f}ms"
    )
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark AuthZ CSV vs SQL latency.")
    parser.add_argument(
        "--iterations",
        type=int,
        default=1000,
        help="Number of enforce() calls per backend.",
    )
    parser.add_argument(
        "--sql-p99-max-ms",
        type=float,
        default=5.0,
        help="Hard threshold for SQL p99 latency.",
    )
    parser.add_argument(
        "--sql-vs-csv-max-ratio",
        type=float,
        default=2.0,
        help="Maximum allowed SQL p99 / CSV p99 ratio.",
    )
    args = parser.parse_args()

    model_path = str(_model_path())
    policy_path = str(_policy_path())
    sample = ("manager", "documents", "read")

    csv_enforcer = Enforcer(model_path, policy_path)
    csv_enforcer.load_policy()
    csv_stats = _print_stats(
        "csv", _time_enforce(csv_enforcer, args.iterations, sample)
    )

    db_url = _to_sync_sqlalchemy_url(settings.AUTHZ_EFFECTIVE_POLICY_DATABASE_URL)
    engine = create_engine(db_url, future=True)
    try:
        CasbinRule.__table__.create(bind=engine, checkfirst=True)
        with engine.begin() as conn:
            # Keep table as-is if already populated, otherwise seed a minimal p-rule.
            count = conn.execute(text("SELECT COUNT(*) FROM casbin_rule")).scalar_one()
            if int(count) == 0:
                conn.execute(
                    text(
                        "INSERT INTO casbin_rule (ptype, v0, v1, v2) VALUES ('p', 'manager', 'documents', 'read')"
                    )
                )
    finally:
        engine.dispose()

    sql_adapter = Adapter(db_url)
    sql_enforcer = Enforcer(model_path, sql_adapter)
    sql_enforcer.load_policy()
    sql_stats = _print_stats(
        "sql", _time_enforce(sql_enforcer, args.iterations, sample)
    )

    sql_p99 = sql_stats["p99_ms"]
    csv_p99 = max(csv_stats["p99_ms"], 0.0001)
    ratio = sql_p99 / csv_p99
    print(f"ratio_sql_vs_csv_p99={ratio:.3f}")

    if sql_p99 > args.sql_p99_max_ms:
        raise SystemExit(f"FAIL: sql p99 {sql_p99:.3f}ms > {args.sql_p99_max_ms:.3f}ms")
    if ratio > args.sql_vs_csv_max_ratio:
        raise SystemExit(
            f"FAIL: sql/csv p99 ratio {ratio:.3f} > {args.sql_vs_csv_max_ratio:.3f}"
        )

    print("benchmark_ok")


if __name__ == "__main__":
    main()
