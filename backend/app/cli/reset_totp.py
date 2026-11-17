"""Reset an authenticator app from the server (DEC-2026-004, lost phone).

For the account nobody can reset from the screen: the last super_admin with an
app. Anyone else is reset by a superior in the application (user record).
Run after an in-person check, in the api container:

    docker compose exec api python -m app.cli.reset_totp \\
        --institution MINFI --matricule SA001 --operator "Nom de l'exploitant"

Without ``--apply`` it only shows what it would do. With ``--apply`` it removes
the app, writes the audit entry (``by: ops:<operator>``) and e-mails the holder.
"""

import argparse
import asyncio
import sys
from typing import Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.core.exceptions import AuthenticationError
from app.models.user import User
from app.services import totp
from app.services.auth_service import AuthService


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m app.cli.reset_totp",
        description="Reset an account's authenticator app (lost phone).",
    )
    parser.add_argument("--institution", required=True, help="as typed at login")
    parser.add_argument("--matricule", required=True)
    parser.add_argument(
        "--operator", required=True, help="who checked the holder in person"
    )
    parser.add_argument(
        "--apply", action="store_true", help="remove the app (default: show only)"
    )
    return parser.parse_args(argv)


async def run(db: AsyncSession, args: argparse.Namespace, out=print) -> int:
    """0: done or nothing to do; 1: account not found."""
    try:
        tenant = await AuthService()._resolve_tenant(db, args.institution)
    except AuthenticationError:
        out(f"Institution not found: {args.institution}")
        return 1
    found = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.tenant_id == tenant.id, User.matricule == args.matricule)
    )
    user = found.scalar_one_or_none()
    if user is None:
        out(f"Account not found: {args.matricule} ({tenant.name})")
        return 1
    record = await totp.get_record(db, user.id)
    role = user.role.code if user.role else "?"
    state = (
        "none"
        if record is None
        else ("confirmed" if record.confirmed_at else "pending")
    )
    out(f"{user.full_name} ({user.matricule}, {role}, {tenant.name}): app {state}")
    if record is None:
        out("Nothing to reset.")
        return 0
    if not args.apply:
        out("Dry run: add --apply to remove the app.")
        return 0
    await totp.reset(db, user, actor=None, operator=args.operator)
    out("App removed. The holder enrols a new one at the next login.")
    return 0


async def _main(args: argparse.Namespace) -> int:
    async with AsyncSessionLocal() as db:
        return await run(db, args)


def main(argv: Optional[Sequence[str]] = None) -> int:
    return asyncio.run(_main(parse_args(argv)))


if __name__ == "__main__":
    sys.exit(main())
