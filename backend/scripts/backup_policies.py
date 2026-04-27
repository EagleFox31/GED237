# backend/scripts/backup_policies.py
#!/usr/bin/env python3
"""
Backup AuthZ policies before cutover.

Creates a timestamped backup directory containing:
- policy.csv (file source)
- casbin_rule.json (SQL source)
- authz_policy_version.json

Usage:
  python scripts/backup_policies.py
  python scripts/backup_policies.py --output-dir ./backups/authz
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import create_engine, text

from app.core.config import settings


def _to_sync_sqlalchemy_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if url.startswith("sqlite+aiosqlite://"):
        return url.replace("sqlite+aiosqlite://", "sqlite://", 1)
    return url


def _policy_csv_path() -> Path:
    return (
        Path(__file__).resolve().parent.parent / "app" / "core" / "authz" / "policy.csv"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backup AuthZ policy sources (CSV + SQL)."
    )
    parser.add_argument(
        "--output-dir",
        default=str(Path(__file__).resolve().parent.parent / "backups" / "authz"),
        help="Base directory for backups.",
    )
    args = parser.parse_args()

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = Path(args.output_dir) / f"authz_backup_{timestamp}"
    backup_dir.mkdir(parents=True, exist_ok=True)

    csv_path = _policy_csv_path()
    csv_backup = backup_dir / "policy.csv"
    shutil.copy2(csv_path, csv_backup)

    db_url = _to_sync_sqlalchemy_url(settings.AUTHZ_EFFECTIVE_POLICY_DATABASE_URL)
    engine = create_engine(db_url, future=True)
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS authz_policy_version ("
                    "id INTEGER PRIMARY KEY, "
                    "version BIGINT NOT NULL)"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO authz_policy_version (id, version) "
                    "SELECT 1, 1 "
                    "WHERE NOT EXISTS (SELECT 1 FROM authz_policy_version WHERE id = 1)"
                )
            )
            casbin_rows = (
                conn.execute(
                    text(
                        "SELECT ptype, v0, v1, v2, v3, v4, v5 "
                        "FROM casbin_rule ORDER BY ptype, v0, v1, v2, v3, v4, v5"
                    )
                )
                .mappings()
                .all()
            )
            version_rows = (
                conn.execute(
                    text("SELECT id, version FROM authz_policy_version ORDER BY id")
                )
                .mappings()
                .all()
            )
    finally:
        engine.dispose()

    (backup_dir / "casbin_rule.json").write_text(
        json.dumps([dict(row) for row in casbin_rows], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    (backup_dir / "authz_policy_version.json").write_text(
        json.dumps([dict(row) for row in version_rows], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    (backup_dir / "metadata.json").write_text(
        json.dumps(
            {
                "created_at_utc": timestamp,
                "authz_backend": settings.AUTHZ_BACKEND,
                "policy_database_url": db_url,
                "files": [
                    "policy.csv",
                    "casbin_rule.json",
                    "authz_policy_version.json",
                ],
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    print(str(backup_dir))


if __name__ == "__main__":
    main()
