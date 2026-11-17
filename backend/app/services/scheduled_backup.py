"""Scheduled backup (post-rc1 lot 13).

Once per local day, the worker's beat writes a backup with the layout of
``ops/backup.sh`` (db.dump, storage.tar.gz, SHA256SUMS, MANIFEST.txt format=1),
so ``ops/restore.sh`` restores it. It runs hot: the dump and the manifest
counts read one exported snapshot, so they agree with each other.

- One slot per local date (``backup_runs.slot`` unique): a second run the same
  day does nothing, unless the first one failed or died while running.
- Retention: the ``KEEP_DAILY`` most recent backups, plus the newest of each of
  the ``KEEP_WEEKLY`` ISO weeks before them. Only directories this job wrote
  (recorded in ``backup_runs``) are ever deleted: manual backups are left alone.
- Failure: the run is marked failed and every active super admin gets an
  in-app notification; ``backup_status`` reports the alert.
"""

from __future__ import annotations

import asyncio
import gzip
import hashlib
import logging
import os
import re
import shutil
import subprocess  # nosec B404 - fixed argv, no shell
import tarfile
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable, Optional

from sqlalchemy import and_, func, or_, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.models.backup_run import BackupRun
from app.models.notification import Notification
from app.models.role import Role
from app.models.user import User

logger = logging.getLogger(__name__)

# Africa/Douala: UTC+1 all year, no daylight saving time.
LOCAL_TZ = timezone(timedelta(hours=1))
# A run still "running" after this long died with its worker: the slot is retried.
STALE_RUNNING = timedelta(hours=6)
# Same fixed mtime as ops/backup.sh, so an unchanged storage gives the same archive.
TAR_MTIME = 946684800  # 2000-01-01T00:00:00Z
DIR_PATTERN = re.compile(r"^ged237-\d{8}T\d{6}Z$")
PG_DUMP_TIMEOUT_SECONDS = 6 * 3600


class BackupError(Exception):
    """A backup step failed; the message is shown to the operator."""


def local_slot(now: datetime) -> date:
    return now.astimezone(LOCAL_TZ).date()


def keep_slots(slots: Iterable[date], daily: int, weekly: int) -> set[date]:
    """Slots kept by retention: the ``daily`` most recent, then the newest of
    each of the ``weekly`` ISO weeks that come before them."""
    ordered = sorted(set(slots), reverse=True)
    keep = set(ordered[: max(daily, 0)])
    weeks: set[tuple[int, int]] = set()
    for slot in ordered[max(daily, 0) :]:
        week = tuple(slot.isocalendar())[:2]
        if week in weeks:
            continue
        if len(weeks) >= weekly:
            break
        weeks.add(week)
        keep.add(slot)
    return keep


# --- database side -------------------------------------------------------


async def _claim_slot(db, slot: date, now: datetime) -> Optional[uuid.UUID]:
    """Take today's slot. None when it is already done or still running."""
    stmt = (
        pg_insert(BackupRun)
        .values(
            id=uuid.uuid4(), slot=slot, status="running", attempts=1, started_at=now
        )
        .on_conflict_do_update(
            index_elements=[BackupRun.slot],
            set_={
                "status": "running",
                "attempts": BackupRun.attempts + 1,
                "started_at": now,
                "finished_at": None,
                "error": None,
            },
            where=or_(
                BackupRun.status == "failed",
                and_(
                    BackupRun.status == "running",
                    BackupRun.started_at < now - STALE_RUNNING,
                ),
            ),
        )
        .returning(BackupRun.id)
    )
    run_id = (await db.execute(stmt)).scalar_one_or_none()
    await db.commit()
    return run_id


async def _snapshot_counts(db) -> dict[str, str]:
    """Manifest counts, read in the snapshot the dump will use."""
    alembic = (
        await db.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
    ).scalar_one_or_none()
    counts = {"alembic_version": alembic or ""}
    for table in ("tenants", "users", "documents"):
        counts[table] = str(
            (await db.execute(text(f"SELECT count(*) FROM {table}"))).scalar_one()  # nosec B608 - fixed table names
        )
    return counts


async def _notify_failure(db, slot: date, error: str) -> None:
    rows = await db.execute(
        select(User.id, User.tenant_id)
        .join(Role, Role.id == User.role_id)
        .where(Role.code == "super_admin", User.is_active.is_(True))
    )
    for user_id, tenant_id in rows.all():
        if tenant_id is None:
            continue
        db.add(
            Notification(
                user_id=user_id,
                tenant_id=tenant_id,
                event_type="BACKUP_FAILED",
                message=f"La sauvegarde du {slot:%d/%m/%Y} a échoué. Voir l'état des sauvegardes.",
                channel="in_app",
                meta_data={"slot": slot.isoformat(), "error": error[:200]},
            )
        )


# --- files side ----------------------------------------------------------


def _pg_major(version_text: str) -> int:
    match = re.search(r"\)\s*(\d+)", version_text) or re.search(r"(\d+)", version_text)
    if not match:
        raise BackupError(f"Version de pg_dump illisible : {version_text.strip()[:80]}")
    return int(match.group(1))


def check_pg_dump_matches(client_major: int, server_major: int) -> None:
    """The dump client must have the server's major version.

    Measured on 2026-11-17: a pg_dump 17.11 archive is refused by pg_restore 15
    ("unsupported version (1.16) in file header"), and pg_restore 17 into a
    PostgreSQL 15 server stops on "SET transaction_timeout". A newer client
    would write backups that ops/restore.sh cannot restore: fail loudly instead.
    """
    if client_major != server_major:
        raise BackupError(
            f"pg_dump {client_major} et PostgreSQL {server_major} : versions majeures "
            "différentes, l'archive ne serait pas restaurable par ops/restore.sh. "
            f"Installez postgresql-client-{server_major} sur le worker et réglez "
            "SCHEDULED_BACKUP_PG_DUMP."
        )


def _pg_env_and_dsn() -> tuple[dict, str]:
    url = make_url(settings.DATABASE_URL).set(drivername="postgresql")
    env = dict(os.environ)
    if url.password:
        env["PGPASSWORD"] = str(url.password)
    # The password goes through the environment, never on the command line.
    return env, url.set(password=None, query={}).render_as_string(hide_password=False)


def _run_pg_dump(dest: Path, snapshot: str) -> None:
    env, dsn = _pg_env_and_dsn()
    result = subprocess.run(  # nosec B603 B607 - fixed argv, no shell
        [
            settings.SCHEDULED_BACKUP_PG_DUMP,
            "--format=custom",
            "--compress=6",
            f"--snapshot={snapshot}",
            f"--file={dest}",
            f"--dbname={dsn}",
        ],
        env=env,
        capture_output=True,
        text=True,
        timeout=PG_DUMP_TIMEOUT_SECONDS,
        check=False,
    )
    if result.returncode != 0:
        raise BackupError(f"pg_dump a échoué : {result.stderr.strip()[-300:]}")


def _pg_dump_major() -> int:
    try:
        out = subprocess.run(  # nosec B603 B607 - fixed argv, no shell
            [settings.SCHEDULED_BACKUP_PG_DUMP, "--version"],
            capture_output=True,
            text=True,
            timeout=30,
            check=True,
        ).stdout
    except (OSError, subprocess.SubprocessError) as exc:
        raise BackupError(f"pg_dump introuvable ou inutilisable : {exc}") from exc
    return _pg_major(out)


def _write_storage_archive(root: Path, dest: Path) -> int:
    """storage.tar.gz of every regular file under ``root``, reproducible
    (sorted, fixed mtime and owner, no gzip timestamp). Returns the file count."""
    files = (
        sorted(p for p in root.rglob("*") if p.is_file() and not p.is_symlink())
        if root.is_dir()
        else []
    )
    with open(dest, "wb") as raw, gzip.GzipFile(
        filename="", mode="wb", fileobj=raw, mtime=0
    ) as gz, tarfile.open(fileobj=gz, mode="w", format=tarfile.GNU_FORMAT) as tar:
        for path in files:
            info = tar.gettarinfo(
                str(path), arcname=f"./{path.relative_to(root).as_posix()}"
            )
            info.mtime = TAR_MTIME
            info.uid = info.gid = 0
            info.uname = info.gname = ""
            with open(path, "rb") as fh:
                tar.addfile(info, fh)
    return len(files)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _finish_files(partial: Path, counts: dict[str, str], files: int) -> None:
    sums = "".join(
        f"{_sha256(partial / name)}  {name}\n" for name in ("db.dump", "storage.tar.gz")
    )
    (partial / "SHA256SUMS").write_text(sums, encoding="utf-8")
    database = make_url(settings.DATABASE_URL).database or ""
    manifest = (
        "format=1\n"
        f"database={database}\n"
        f"alembic_version={counts['alembic_version']}\n"
        f"tenants={counts['tenants']}\n"
        f"users={counts['users']}\n"
        f"documents={counts['documents']}\n"
        f"storage_files={files}\n"
        "storage_volume=-\n"
        "compose_project=-\n"
    )
    (partial / "MANIFEST.txt").write_text(manifest, encoding="utf-8")


def _dir_size(path: Path) -> int:
    return sum(p.stat().st_size for p in path.iterdir() if p.is_file())


# --- orchestration -------------------------------------------------------


async def _write_backup(session_factory, root: Path, now: datetime) -> tuple[str, int]:
    """Write one complete backup directory; return its name and size."""
    if settings.STORAGE_TYPE != "local":
        raise BackupError(
            "Sauvegarde planifiée limitée au stockage local (STORAGE_TYPE=local)."
        )
    name = f"ged237-{now.astimezone(timezone.utc):%Y%m%dT%H%M%SZ}"
    partial = root / f".{name}.partial"
    root.mkdir(parents=True, exist_ok=True)
    shutil.rmtree(partial, ignore_errors=True)
    partial.mkdir()
    try:
        async with session_factory() as db:
            await db.connection(
                execution_options={"isolation_level": "REPEATABLE READ"}
            )
            server_major = (
                int((await db.execute(text("SHOW server_version_num"))).scalar_one())
                // 10000
            )
            check_pg_dump_matches(await asyncio.to_thread(_pg_dump_major), server_major)
            snapshot = (
                await db.execute(text("SELECT pg_export_snapshot()"))
            ).scalar_one()
            counts = await _snapshot_counts(db)
            # The transaction stays open while pg_dump reads the exported snapshot.
            await asyncio.to_thread(_run_pg_dump, partial / "db.dump", snapshot)
            await db.rollback()
        files = await asyncio.to_thread(
            _write_storage_archive,
            Path(settings.STORAGE_PATH),
            partial / "storage.tar.gz",
        )
        await asyncio.to_thread(_finish_files, partial, counts, files)
        final = root / name
        if final.exists():
            raise BackupError(f"Le dossier {name} existe déjà.")
        partial.rename(final)
        return name, _dir_size(final)
    except BaseException:
        shutil.rmtree(partial, ignore_errors=True)
        raise


async def _prune(db, root: Path, now: datetime) -> list[str]:
    rows = (
        (
            await db.execute(
                select(BackupRun).where(
                    BackupRun.status == "succeeded",
                    BackupRun.path.is_not(None),
                    BackupRun.pruned_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    keep = keep_slots(
        (r.slot for r in rows),
        settings.SCHEDULED_BACKUP_KEEP_DAILY,
        settings.SCHEDULED_BACKUP_KEEP_WEEKLY,
    )
    removed = []
    for run in rows:
        if run.slot in keep or not DIR_PATTERN.match(run.path or ""):
            continue
        target = root / run.path
        if target.parent.resolve() != root.resolve():
            continue
        shutil.rmtree(target, ignore_errors=True)
        run.pruned_at = now
        removed.append(run.path)
    await db.commit()
    return removed


async def run_scheduled_backup(
    session_factory, *, now: Optional[datetime] = None
) -> dict:
    """One scheduled pass. Safe to call any number of times a day."""
    now = now or datetime.now(timezone.utc)
    slot = local_slot(now)
    root = Path(settings.SCHEDULED_BACKUP_DIR)

    async with session_factory() as db:
        run_id = await _claim_slot(db, slot, now)
    if run_id is None:
        return {"status": "skipped", "slot": slot.isoformat()}

    try:
        name, size = await _write_backup(session_factory, root, now)
    except Exception as exc:  # every failure must reach the operator
        error = (
            str(exc) if isinstance(exc, BackupError) else f"{type(exc).__name__}: {exc}"
        )
        logger.error("scheduled backup %s failed: %s", slot, error)
        async with session_factory() as db:
            await db.execute(
                update(BackupRun)
                .where(BackupRun.id == run_id)
                .values(status="failed", finished_at=func.now(), error=error[:500])
            )
            await _notify_failure(db, slot, error)
            await db.commit()
        return {"status": "failed", "slot": slot.isoformat(), "error": error}

    async with session_factory() as db:
        await db.execute(
            update(BackupRun)
            .where(BackupRun.id == run_id)
            .values(
                status="succeeded", finished_at=func.now(), path=name, size_bytes=size
            )
        )
        await db.commit()
        removed = await _prune(db, root, now)
    logger.info("scheduled backup %s written to %s, pruned %s", slot, name, removed)
    return {
        "status": "succeeded",
        "slot": slot.isoformat(),
        "path": name,
        "pruned": removed,
    }


async def backup_status(db, *, now: Optional[datetime] = None) -> dict:
    """State shown to the super admin. ``alert`` is None, "failed" (the last
    run failed) or "stale" (no successful backup within MAX_AGE_HOURS)."""
    now = now or datetime.now(timezone.utc)
    last = (
        await db.execute(
            select(BackupRun).order_by(BackupRun.started_at.desc()).limit(1)
        )
    ).scalar_one_or_none()
    last_success = (
        await db.execute(
            select(BackupRun)
            .where(BackupRun.status == "succeeded")
            .order_by(BackupRun.finished_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    alert = None
    if settings.SCHEDULED_BACKUP_ENABLED:
        if last is not None and last.status == "failed":
            alert = "failed"
        elif last_success is None or last_success.finished_at < now - timedelta(
            hours=settings.SCHEDULED_BACKUP_MAX_AGE_HOURS
        ):
            alert = "stale"

    def _run(run: Optional[BackupRun]) -> Optional[dict]:
        if run is None:
            return None
        return {
            "slot": run.slot.isoformat(),
            "status": run.status,
            "attempts": run.attempts,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "finished_at": run.finished_at.isoformat() if run.finished_at else None,
            "path": run.path,
            "size_bytes": run.size_bytes,
            "error": run.error,
        }

    return {
        "enabled": settings.SCHEDULED_BACKUP_ENABLED,
        "hour": settings.SCHEDULED_BACKUP_HOUR,
        "alert": alert,
        "last_run": _run(last),
        "last_success": _run(last_success),
    }
