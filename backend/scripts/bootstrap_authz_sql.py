#!/usr/bin/env python3
"""
Bootstrap or sync Casbin policies from CSV into the SQL adapter store.

Usage:
  python scripts/bootstrap_authz_sql.py                  # empty store only
  python scripts/bootstrap_authz_sql.py --force          # align SQL on the CSV exactly
  python scripts/bootstrap_authz_sql.py --sync --dry-run # list missing rules
  python scripts/bootstrap_authz_sql.py --sync           # insert missing rules

--sync is additive and idempotent: it inserts the policy.csv rules absent from
SQL and keeps every other rule (admin API changes included). A second run
inserts nothing. A policy.csv rule removed through the API comes back: review
the --dry-run list first.
"""

import argparse
import asyncio

from app.core.authz.casbin_enforcer import (
    bootstrap_sql_policies_from_csv,
    csv_sql_policy_drift,
    sync_sql_policies_from_csv,
)


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bootstrap or sync Casbin SQL policies from CSV."
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--force",
        action="store_true",
        help=(
            "Align SQL exactly on policy.csv: remove the other rules (API ones "
            "included), add the missing ones. Matching rows are left as they are."
        ),
    )
    mode.add_argument(
        "--sync",
        action="store_true",
        help="Insert only the CSV rules missing from SQL; keep all others.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="With --sync: list what would be inserted, write nothing.",
    )
    args = parser.parse_args()
    if args.dry_run and not args.sync:
        parser.error("--dry-run requires --sync")

    if args.sync:
        drift = await csv_sql_policy_drift()
        for kind in ("missing_p", "missing_g", "sql_only_p", "sql_only_g"):
            for rule in drift[kind]:
                print(f"{kind}: {', '.join(rule)}")
        count = await sync_sql_policies_from_csv(dry_run=args.dry_run)
        verb = "Would insert" if args.dry_run else "Inserted"
        print(f"{verb} policies: {count}")
        return

    count = await bootstrap_sql_policies_from_csv(force=args.force)
    print(f"Imported policies: {count}")


if __name__ == "__main__":
    asyncio.run(main())
