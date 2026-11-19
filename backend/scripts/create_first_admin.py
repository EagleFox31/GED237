"""Create the first platform administrator on an empty platform.

Idempotent: if a ``super_admin`` account already exists, nothing is written.
The account lives in the system tenant ``PLATFORM`` (created if missing, same
values as ``seed_db.py``) and must change its password at first login.

Password: ``FIRST_ADMIN_PASSWORD`` if set, otherwise typed twice at a hidden
prompt. It is never printed nor logged.

Usage (stack started, see DOCS/exploitation/premier-administrateur.md):
    docker compose exec api python scripts/create_first_admin.py --matricule ADMIN001
Without a terminal, the variable is read with ``read -rs`` and passed by name only
(``-e FIRST_ADMIN_PASSWORD``), never written on the command line: see the doc.

Exit codes: 0 created or already present, 2 unusable input or schema not ready.
"""

import argparse
import asyncio
import getpass
import os
import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.exc import IntegrityError  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.models.role import Role  # noqa: E402
from app.models.tenant import Tenant  # noqa: E402
from app.models.user import User  # noqa: E402

PLATFORM_SHORT_NAME = "PLATFORM"
PLATFORM_NAME = "Plateforme E-Dossier"
PLATFORM_DOMAIN = "platform.edossier.cm"
SUPER_ADMIN_ROLE = "super_admin"
PASSWORD_ENV = "FIRST_ADMIN_PASSWORD"
# Same floor as the password change form (ChangePasswordRequest.new_password).
MIN_PASSWORD_LENGTH = 8


class FirstAdminError(Exception):
    """Input or schema problem, with the message an operator can act on."""


@dataclass(frozen=True)
class FirstAdminResult:
    created: bool
    matricule: str


def check_password(password: str) -> str:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise FirstAdminError(
            f"mot de passe trop court : {MIN_PASSWORD_LENGTH} caractères minimum"
        )
    return password


async def ensure_first_admin(
    db,
    *,
    matricule: str,
    password: Callable[[], str],
    email: str | None = None,
    first_name: str = "Administrateur",
    last_name: str = "Plateforme",
) -> FirstAdminResult:
    """Create the first super_admin unless one exists. Commits only when it writes.

    ``password`` is called only when an account is really created, so a second
    run never prompts.
    """
    role = (
        await db.execute(select(Role).where(Role.code == SUPER_ADMIN_ROLE))
    ).scalar_one_or_none()
    if role is None:
        raise FirstAdminError(
            "rôle super_admin absent : appliquer d'abord les migrations "
            "(alembic upgrade head)"
        )

    existing = (
        await db.execute(select(User).where(User.role_id == role.id).limit(1))
    ).scalar_one_or_none()
    if existing is not None:
        return FirstAdminResult(created=False, matricule=existing.matricule)

    secret = check_password(password())
    platform = (
        await db.execute(select(Tenant).where(Tenant.short_name == PLATFORM_SHORT_NAME))
    ).scalar_one_or_none()
    if platform is None:
        platform = Tenant(
            name=PLATFORM_NAME,
            short_name=PLATFORM_SHORT_NAME,
            domain=PLATFORM_DOMAIN,
            is_active=True,
        )
        db.add(platform)
        await db.flush()

    db.add(
        User(
            tenant_id=platform.id,
            org_unit_id=None,
            role_id=role.id,
            matricule=matricule,
            email=email,
            first_name=first_name,
            last_name=last_name,
            password_hash=hash_password(secret),
            is_active=True,
            must_change_password=True,
        )
    )
    try:
        await db.commit()
    except IntegrityError:
        # Matricule taken in PLATFORM or e-mail taken anywhere: nothing is kept.
        await db.rollback()
        raise FirstAdminError(
            "matricule ou e-mail déjà utilisé : relancer avec un autre --matricule "
            "ou --email"
        ) from None
    return FirstAdminResult(created=True, matricule=matricule)


def read_password(environ=os.environ, stdin=sys.stdin, prompt=getpass.getpass) -> str:
    """Password from the environment, else from a hidden prompt typed twice."""
    from_env = environ.get(PASSWORD_ENV)
    if from_env:
        return check_password(from_env)
    if not stdin.isatty():
        raise FirstAdminError(
            f"aucun mot de passe : définir {PASSWORD_ENV} ou lancer la commande "
            "dans un terminal (docker compose run sans -T)"
        )
    first = check_password(prompt("Mot de passe du premier administrateur : "))
    if prompt("Confirmer le mot de passe : ") != first:
        raise FirstAdminError("les deux saisies diffèrent")
    return first


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Crée le premier administrateur de la plateforme (sans effet s'il existe)."
    )
    parser.add_argument("--matricule", default="ADMIN001")
    parser.add_argument("--email", default=None)
    parser.add_argument("--first-name", default="Administrateur")
    parser.add_argument("--last-name", default="Plateforme")
    return parser.parse_args(argv)


async def main(argv=None) -> int:
    from app.core.database import AsyncSessionLocal

    args = parse_args(argv)
    try:
        async with AsyncSessionLocal() as db:
            result = await ensure_first_admin(
                db,
                matricule=args.matricule,
                password=read_password,
                email=args.email,
                first_name=args.first_name,
                last_name=args.last_name,
            )
    except FirstAdminError as exc:
        print(f"[ERREUR] {exc}", file=sys.stderr)
        return 2

    if result.created:
        print(
            f"[OK] Premier administrateur créé : institution {PLATFORM_SHORT_NAME}, "
            f"matricule {result.matricule}. Changement du mot de passe demandé "
            "à la première connexion."
        )
    else:
        print(
            f"[SKIP] Un administrateur de la plateforme existe déjà "
            f"(matricule {result.matricule}) : rien n'a été modifié."
        )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
