import os
from celery import Celery

from app.core.config import settings

# Use environment variables or defaults
redis_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/1")
redis_backend = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

celery_app = Celery(
    "edossier_worker",
    broker=redis_url,
    backend=redis_backend,
    include=["app.workers.tasks"],
)

# Optional configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Africa/Douala",
    enable_utc=True,
    task_track_started=True,
    # No caller reads task results. Sending a task that keeps its result first subscribes to the result
    # backend, and that subscription retries forever when the backend is unreachable: the HTTP request
    # that enqueues OCR (import commit, upload, review) then never returns (LESSON-2026-026).
    task_ignore_result=True,
    task_default_queue="celery",
)


def build_beat_schedule(cfg=settings) -> dict:
    """Every periodic task of the worker (beat runs with -B in docker-compose.yml).

    One entry per capability, each behind its own setting: a disabled capability
    adds no entry, and an empty registry leaves ``beat_schedule`` untouched.
    """
    schedule: dict = {}
    # Watched folders (lot 5). No folder configured or interval 0: no entry.
    if cfg.INGEST_WATCH_FOLDERS and cfg.INGEST_WATCH_INTERVAL_SECONDS > 0:
        schedule["watch-ingest-folders"] = {
            "task": "app.workers.tasks.watch_ingest_folders",
            "schedule": float(cfg.INGEST_WATCH_INTERVAL_SECONDS),
        }
    # Trash retention. TRASH_RETENTION_DAYS=0: no entry.
    if cfg.TRASH_RETENTION_DAYS > 0:
        schedule["purge-expired-trash"] = {
            "task": "app.workers.tasks.purge_expired_trash",
            "schedule": float(cfg.TRASH_PURGE_INTERVAL_SECONDS),
        }
    return schedule


_beat_schedule = build_beat_schedule()
if _beat_schedule:
    celery_app.conf.beat_schedule = _beat_schedule
