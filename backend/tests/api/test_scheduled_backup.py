"""Scheduled backup (post-rc1 lot 13): slot, retention, alert, version guard,
and a real restore of what it writes."""

import hashlib
import os
import shutil
import subprocess  # nosec B404 - test helper, fixed argv
import tarfile
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import select, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.security import hash_password
from app.models.backup_run import BackupRun
from app.models.notification import Notification
from app.models.role import Role
from app.models.user import User
from app.services import scheduled_backup as sb

# Real time: finished_at is written by the database clock.
NOW = datetime.now(timezone.utc).replace(microsecond=0)
SLOT = sb.local_slot(NOW).isoformat()


@pytest.fixture
def factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
def backup_env(monkeypatch, tmp_path):
    storage = tmp_path / "storage"
    (storage / "t1" / "2026").mkdir(parents=True)
    (storage / "t1" / "2026" / "a.pdf").write_bytes(b"%PDF-1.4 a")
    (storage / "b.txt").write_bytes(b"bonjour")
    monkeypatch.setattr(settings, "SCHEDULED_BACKUP_ENABLED", True)
    monkeypatch.setattr(settings, "SCHEDULED_BACKUP_DIR", str(tmp_path / "backups"))
    monkeypatch.setattr(settings, "STORAGE_TYPE", "local")
    monkeypatch.setattr(settings, "STORAGE_PATH", str(storage))
    return tmp_path


def _fake_writer(calls):
    async def _write(session_factory, root, now):
        calls.append(now)
        name = f"ged237-{now:%Y%m%dT%H%M%SZ}"
        (root / name).mkdir(parents=True)
        return name, 0

    return _write


# --- pure rules ------------------------------------------------------------


def test_retention_keeps_seven_days_and_four_older_weeks():
    today = date(2026, 12, 1)  # a Tuesday
    slots = [today - timedelta(days=n) for n in range(60)]
    kept = sb.keep_slots(slots, daily=7, weekly=4)
    daily = {today - timedelta(days=n) for n in range(7)}
    assert daily <= kept
    older = sorted(kept - daily, reverse=True)
    assert len(older) == 4
    assert len({d.isocalendar()[:2] for d in older}) == 4
    assert len(kept) == 11


def test_local_slot_is_the_douala_date():
    assert sb.local_slot(datetime(2026, 12, 1, 23, 30, tzinfo=timezone.utc)) == date(
        2026, 12, 2
    )


def test_version_guard_refuses_a_different_major():
    sb.check_pg_dump_matches(15, 15)
    with pytest.raises(sb.BackupError, match="postgresql-client-15"):
        sb.check_pg_dump_matches(17, 15)


# --- runs --------------------------------------------------------------------


@pytest.mark.asyncio
async def test_same_day_runs_back_up_once(backup_env, factory, monkeypatch):
    calls = []
    monkeypatch.setattr(sb, "_write_backup", _fake_writer(calls))
    first = await sb.run_scheduled_backup(factory, now=NOW)
    second = await sb.run_scheduled_backup(factory, now=NOW + timedelta(minutes=1))
    assert first["status"] == "succeeded"
    assert second["status"] == "skipped"
    assert len(calls) == 1
    async with factory() as db:
        runs = (await db.execute(select(BackupRun))).scalars().all()
    assert [(r.status, r.attempts) for r in runs] == [("succeeded", 1)]


@pytest.mark.asyncio
async def test_failed_run_alerts_super_admins_and_is_retried(
    backup_env, factory, monkeypatch, db_seed
):
    async with factory() as db:
        db.add(Role(id=91, code="super_admin", label="Super admin", hierarchy_level=0))
        await db.flush()
        admin = User(
            id=uuid.uuid4(),
            tenant_id=db_seed["tenant_id"],
            role_id=91,
            matricule="SADMBKP",
            email="sadm.bkp@testministry.gov.cm",
            first_name="Super",
            last_name="Admin",
            password_hash=hash_password("testpassword123"),
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        admin_id = admin.id

    async def _broken(session_factory, root, now):
        raise sb.BackupError("disque plein")

    monkeypatch.setattr(sb, "_write_backup", _broken)
    failed = await sb.run_scheduled_backup(factory, now=NOW)
    assert failed == {"status": "failed", "slot": SLOT, "error": "disque plein"}
    async with factory() as db:
        notes = (await db.execute(select(Notification))).scalars().all()
        status = await sb.backup_status(db, now=NOW)
    assert [(n.user_id, n.event_type) for n in notes] == [(admin_id, "BACKUP_FAILED")]
    assert status["alert"] == "failed"
    assert status["last_run"]["error"] == "disque plein"

    calls = []
    monkeypatch.setattr(sb, "_write_backup", _fake_writer(calls))
    retried = await sb.run_scheduled_backup(factory, now=NOW + timedelta(minutes=1))
    assert retried["status"] == "succeeded"
    async with factory() as db:
        run = (await db.execute(select(BackupRun))).scalar_one()
        status = await sb.backup_status(db, now=NOW + timedelta(hours=2))
    assert (run.status, run.attempts, run.error) == ("succeeded", 2, None)
    assert status["alert"] is None


@pytest.mark.asyncio
async def test_version_guard_fails_the_run_before_any_dump(
    backup_env, factory, monkeypatch
):
    monkeypatch.setattr(sb, "_pg_dump_major", lambda: 99)
    result = await sb.run_scheduled_backup(factory, now=NOW)
    assert result["status"] == "failed"
    assert "versions majeures différentes" in result["error"]
    root = Path(settings.SCHEDULED_BACKUP_DIR)
    assert list(root.iterdir()) == []  # the partial directory is gone


@pytest.mark.asyncio
async def test_retention_deletes_only_its_own_old_backups(
    backup_env, factory, monkeypatch
):
    root = Path(settings.SCHEDULED_BACKUP_DIR)
    manual = root / "ged237-20250101T000000Z"
    manual.mkdir(parents=True)
    async with factory() as db:
        for n in range(1, 40):
            day = NOW - timedelta(days=n)
            name = f"ged237-{day:%Y%m%dT%H%M%SZ}"
            (root / name).mkdir()
            db.add(
                BackupRun(
                    slot=sb.local_slot(day),
                    status="succeeded",
                    started_at=day,
                    finished_at=day,
                    path=name,
                )
            )
        await db.commit()

    monkeypatch.setattr(sb, "_write_backup", _fake_writer([]))
    result = await sb.run_scheduled_backup(factory, now=NOW)

    assert result["status"] == "succeeded"
    left = sorted(p.name for p in root.iterdir())
    assert manual.name in left
    assert len(left) == 1 + 11  # manual + 7 daily + 4 weekly
    async with factory() as db:
        pruned = (
            (
                await db.execute(
                    select(BackupRun).where(BackupRun.pruned_at.is_not(None))
                )
            )
            .scalars()
            .all()
        )
    assert len(pruned) == 40 - 11


@pytest.mark.asyncio
async def test_status_alerts(factory, monkeypatch):
    async with factory() as db:
        monkeypatch.setattr(settings, "SCHEDULED_BACKUP_ENABLED", False)
        assert (await sb.backup_status(db, now=NOW))["alert"] is None
        monkeypatch.setattr(settings, "SCHEDULED_BACKUP_ENABLED", True)
        assert (await sb.backup_status(db, now=NOW))["alert"] == "stale"
        old = NOW - timedelta(hours=30)
        db.add(
            BackupRun(
                slot=old.date(), status="succeeded", started_at=old, finished_at=old
            )
        )
        await db.commit()
        assert (await sb.backup_status(db, now=NOW))["alert"] == "stale"
        assert (await sb.backup_status(db, now=old + timedelta(hours=1)))[
            "alert"
        ] is None


@pytest.mark.asyncio
async def test_status_route_is_for_the_super_admin_only(admin_client, client_as):
    response = await admin_client.get("/api/v1/backups/status")
    assert response.status_code == 200
    assert response.json()["enabled"] is False
    async with client_as("tenant_admin") as client:
        assert (await client.get("/api/v1/backups/status")).status_code == 403


def test_beat_has_no_backup_entry_by_default():
    from app.workers.celery_app import celery_app

    assert "scheduled-backup" not in (celery_app.conf.beat_schedule or {})


# --- real backup and restore -------------------------------------------------


def _tool(name):
    path = shutil.which(name)
    if path is None:
        if os.getenv("CI"):
            pytest.fail(f"{name} is required in CI for the restore test")
        pytest.skip(f"{name} not installed")
    return path


@pytest.mark.asyncio
async def test_backup_restores_with_the_same_counts_and_files(
    backup_env, factory, monkeypatch, db_seed, test_engine
):
    pg_dump, pg_restore = _tool("pg_dump"), _tool("pg_restore")
    monkeypatch.setattr(settings, "SCHEDULED_BACKUP_PG_DUMP", pg_dump)
    # The version guard runs for real: the CI puts a client of the server's
    # major first on PATH (backend.yml). Elsewhere a mismatched client skips.
    async with test_engine.connect() as conn:
        server = int((await conn.execute(text("SHOW server_version_num"))).scalar_one())
    if sb._pg_dump_major() != server // 10000 and not os.getenv("CI"):
        pytest.skip("pg_dump major differs from the test server")

    result = await sb.run_scheduled_backup(factory, now=NOW)
    assert result["status"] == "succeeded", result
    backup = Path(settings.SCHEDULED_BACKUP_DIR) / result["path"]
    assert sorted(p.name for p in backup.iterdir()) == [
        "MANIFEST.txt",
        "SHA256SUMS",
        "db.dump",
        "storage.tar.gz",
    ]
    for line in (backup / "SHA256SUMS").read_text().splitlines():
        digest, name = line.split("  ")
        assert hashlib.sha256((backup / name).read_bytes()).hexdigest() == digest
    manifest = dict(
        line.split("=", 1)
        for line in (backup / "MANIFEST.txt").read_text().splitlines()
    )
    assert manifest["format"] == "1"
    assert manifest["storage_files"] == "2"

    # Database: restore into a scratch database, compare with the manifest.
    scratch = f"ged237_restore_{uuid.uuid4().hex[:8]}"
    url = make_url(settings.DATABASE_URL)
    async with test_engine.connect() as conn:
        conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
        await conn.execute(text(f'CREATE DATABASE "{scratch}"'))
    try:
        env = {**os.environ, "PGPASSWORD": str(url.password or "")}
        dsn = url.set(
            drivername="postgresql", database=scratch, password=None, query={}
        ).render_as_string(hide_password=False)
        restored = subprocess.run(  # nosec B603 - fixed argv
            [
                pg_restore,
                "--no-owner",
                "--no-privileges",
                "--exit-on-error",
                f"--dbname={dsn}",
                str(backup / "db.dump"),
            ],
            env=env,
            check=False,
            capture_output=True,
            text=True,
        )
        assert restored.returncode == 0, restored.stderr
        engine = create_async_engine(
            url.set(database=scratch).render_as_string(hide_password=False),
            poolclass=NullPool,
        )
        try:
            async with engine.connect() as conn:
                for table in ("tenants", "users", "documents"):
                    count = (
                        await conn.execute(text(f"SELECT count(*) FROM {table}"))  # nosec B608
                    ).scalar_one()
                    assert str(count) == manifest[table], table
                assert manifest["tenants"] == "1"
        finally:
            await engine.dispose()
    finally:
        async with test_engine.connect() as conn:
            conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
            await conn.execute(text(f'DROP DATABASE IF EXISTS "{scratch}"'))

    # Storage: same files, same bytes.
    out = backup_env / "restored"
    with tarfile.open(backup / "storage.tar.gz") as tar:
        tar.extractall(out, filter="data")
    assert (out / "t1" / "2026" / "a.pdf").read_bytes() == b"%PDF-1.4 a"
    assert (out / "b.txt").read_bytes() == b"bonjour"
