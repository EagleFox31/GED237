"""scripts/create_first_admin.py: first platform administrator on an empty platform.

Idempotent (a second run writes nothing and never asks for the password),
PLATFORM tenant reused when present, password never printed.
"""

import importlib.util
import io
import pathlib

import pytest
from sqlalchemy import func, select

from app.core.security import verify_password
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User

BACKEND = pathlib.Path(__file__).resolve().parents[1]
PASSWORD = "Premier-Admin-2026"


def _load():
    spec = importlib.util.spec_from_file_location(
        "create_first_admin", BACKEND / "scripts/create_first_admin.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def _super_admin_role(db):
    role = Role(code="super_admin", label="Super administrateur", hierarchy_level=0)
    db.add(role)
    await db.commit()
    return role


async def _count(db, model):
    return await db.scalar(select(func.count()).select_from(model))


@pytest.mark.asyncio
async def test_creates_the_first_admin_then_is_a_no_op(db_session):
    script = _load()
    await _super_admin_role(db_session)

    created = await script.ensure_first_admin(
        db_session, matricule="ADMIN001", password=lambda: PASSWORD
    )
    assert created.created is True

    user = (
        await db_session.execute(select(User).where(User.matricule == "ADMIN001"))
    ).scalar_one()
    tenant = await db_session.get(Tenant, user.tenant_id)
    assert tenant.short_name == "PLATFORM"
    assert user.org_unit_id is None
    assert user.must_change_password is True
    assert user.password_hash != PASSWORD
    assert verify_password(PASSWORD, user.password_hash)

    def must_not_ask():
        raise AssertionError("password asked although an admin exists")

    again = await script.ensure_first_admin(
        db_session, matricule="OTHER001", password=must_not_ask
    )
    assert again.created is False
    assert again.matricule == "ADMIN001"
    assert await _count(db_session, User) == 1
    assert await _count(db_session, Tenant) == 1


@pytest.mark.asyncio
async def test_reuses_an_existing_platform_tenant(db_session):
    script = _load()
    await _super_admin_role(db_session)
    platform = Tenant(name="Plateforme", short_name="PLATFORM", domain="p.example")
    db_session.add(platform)
    await db_session.commit()

    await script.ensure_first_admin(
        db_session, matricule="ADMIN001", password=lambda: PASSWORD
    )
    user = (await db_session.execute(select(User))).scalar_one()
    assert user.tenant_id == platform.id
    assert await _count(db_session, Tenant) == 1


@pytest.mark.asyncio
async def test_actionable_errors_and_nothing_written(db_session):
    script = _load()
    with pytest.raises(script.FirstAdminError, match="alembic upgrade head"):
        await script.ensure_first_admin(
            db_session, matricule="ADMIN001", password=lambda: PASSWORD
        )

    await _super_admin_role(db_session)
    with pytest.raises(script.FirstAdminError, match="trop court"):
        await script.ensure_first_admin(
            db_session, matricule="ADMIN001", password=lambda: "court"
        )
    assert await _count(db_session, User) == 0
    assert await _count(db_session, Tenant) == 0


class _Stdin(io.StringIO):
    def __init__(self, tty):
        super().__init__()
        self._tty = tty

    def isatty(self):
        return self._tty


def test_read_password_sources():
    script = _load()
    env = {script.PASSWORD_ENV: PASSWORD}
    assert script.read_password(environ=env, stdin=_Stdin(False)) == PASSWORD

    # No variable and no terminal: stop with the way out, never hang on input().
    with pytest.raises(script.FirstAdminError, match=script.PASSWORD_ENV):
        script.read_password(environ={}, stdin=_Stdin(False))

    typed = iter([PASSWORD, PASSWORD])
    assert (
        script.read_password(
            environ={}, stdin=_Stdin(True), prompt=lambda _label: next(typed)
        )
        == PASSWORD
    )

    mismatch = iter([PASSWORD, PASSWORD + "x"])
    with pytest.raises(script.FirstAdminError, match="diffèrent"):
        script.read_password(
            environ={}, stdin=_Stdin(True), prompt=lambda _label: next(mismatch)
        )


@pytest.mark.asyncio
async def test_password_is_never_printed(db_session, monkeypatch, capsys):
    script = _load()
    await _super_admin_role(db_session)

    class _Session:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, *exc):
            return False

    import app.core.database as database

    monkeypatch.setattr(database, "AsyncSessionLocal", lambda: _Session())
    monkeypatch.setenv(script.PASSWORD_ENV, PASSWORD)

    assert await script.main(["--matricule", "ADMIN001"]) == 0
    assert await script.main(["--matricule", "ADMIN001"]) == 0
    out = capsys.readouterr()
    assert "[OK]" in out.out and "[SKIP]" in out.out
    assert PASSWORD not in out.out + out.err
