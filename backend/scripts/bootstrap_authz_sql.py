#!/usr/bin/env python3
"""
Bootstrap Casbin policies from CSV into SQL adapter store.

Usage:
  python scripts/bootstrap_authz_sql.py
  python scripts/bootstrap_authz_sql.py --force
"""

import argparse
import asyncio

from app.core.authz.casbin_enforcer import bootstrap_sql_policies_from_csv


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bootstrap Casbin SQL policies from CSV."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Clear SQL policies before import.",
    )
    args = parser.parse_args()

    count = await bootstrap_sql_policies_from_csv(force=args.force)
    print(f"Imported policies: {count}")


if __name__ == "__main__":
    asyncio.run(main())
