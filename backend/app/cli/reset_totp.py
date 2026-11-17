"""Reset an authenticator app from the server (DEC-2026-004, lost phone).

For the account nobody can reset from the screen: the last super_admin with an
app. Anyone else is reset by a superior in the application (user record).
Run after an in-person check, in the api container:

    docker compose exec api python -m app.cli.reset_totp \\
        --institution MINFI --matricule SA001 --operator SA002

``--operator`` is the matricule of the active super_admin who checked the holder
in person (``--operator-institution`` when not the holder's institution); any
other account is refused. The operator is the holder only as a break-glass:
when no other active super_admin exists (otherwise that one resets the holder
in the application); the audit entry then says ``self: true``. Without ``--apply`` it only shows what it would do.
With ``--apply`` it removes the app, writes the audit entry in the operator's
name (``via: ops-script``) and e-mails the holder.
"""

import argparse
import asyncio
import sys
from typing import Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.core.exceptions import AuthenticationError
from app.models.role import Role
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
        "--operator",
        required=True,
        help="matricule of the active super_admin who checked the holder in person",
    )
    parser.add_argument(
        "--operator-institution", help="the operator's, if not the holder's institution"
    )
    parser.add_argument(
        "--apply", action="store_true", help="remove the app (default: show only)"
    )
    return parser.parse_args(argv)


async def _operator(db: AsyncSession, args: argparse.Namespace) -> Optional[User]:
    """The active super_admin named by --operator, else None."""
    try:
        tenant = await AuthService()._resolve_tenant(
            db, args.operator_institution or args.institution
        )
    except AuthenticationError:
        return None
    found = await db.execute(
        select(User)
        .join(User.role)
        .options(selectinload(User.role))
        .where(
            User.tenant_id == tenant.id,
            User.matricule == args.operator,
            User.is_active.is_(True),
            Role.code == totp.SUPER_ADMIN,
        )
    )
    return found.scalar_one_or_none()


async def _other_active_super_admins(db: AsyncSession, holder: User) -> int:
    found = await db.execute(
        select(func.count())
        .select_from(User)
        .join(User.role)
        .where(
            User.id != holder.id,
            User.is_active.is_(True),
            Role.code == totp.SUPER_ADMIN,
        )
    )
    return int(found.scalar_one())


async def run(db: AsyncSession, args: argparse.Namespace, out=print) -> int:
    """0: done or nothing to do; 1: account not found; 2: operator refused."""
    operator = await _operator(db, args)
    if operator is None:
        out(
            f"Operator refused: {args.operator} is not an active super_admin "
            f"({args.operator_institution or args.institution})"
        )
        return 2
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
    if operator.id == user.id:
        others = await _other_active_super_admins(db, user)
        if others:
            out(
                f"Operator refused: {args.operator} is the holder and {others} other "
                "active super_admin(s) can reset this account in the application"
            )
            return 2
        out(
            "Break-glass: the operator is the holder and the only active "
            "super_admin; the audit entry records a self reset."
        )
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
    await totp.reset(db, user, actor=operator, via=totp.VIA_OPS_SCRIPT)
    out("App removed. The holder enrols a new one at the next login.")
    return 0


async def _main(args: argparse.Namespace) -> int:
    async with AsyncSessionLocal() as db:
        return await run(db, args)


def main(argv: Optional[Sequence[str]] = None) -> int:
    return asyncio.run(_main(parse_args(argv)))


if __name__ == "__main__":
    sys.exit(main())
