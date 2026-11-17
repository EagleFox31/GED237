"""List the accounts that must use the authenticator app but have no e-mail address.

DEC-2026-004: a role listed in ``AUTH_TOTP_REQUIRED_ROLES`` reaches enrolment only
after the e-mail code. Without an address the account could never sign in once
the app is on. Run before setting ``AUTH_TOTP_ENABLED=true``, in the api
container:

    docker compose exec api python -m app.cli.admins_without_email

Read only. Exit code 0: none; 1: at least one account to fix (give it an
address on its user record).
"""

import asyncio
import sys

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.services import totp


async def run(db: AsyncSession, out=print) -> int:
    accounts = await totp.required_without_email(db)
    if not accounts:
        out("Every account that must use the app has an e-mail address.")
        return 0
    out(f"{len(accounts)} account(s) without an e-mail address:")
    for user in accounts:
        role = user.role.code if user.role else "?"
        tenant = user.tenant.short_name if user.tenant else "?"
        out(f"- {user.matricule} ({role}, {tenant}): {user.full_name}")
    return 1


async def _main() -> int:
    async with AsyncSessionLocal() as db:
        return await run(db)


def main() -> int:
    return asyncio.run(_main())


if __name__ == "__main__":
    sys.exit(main())
