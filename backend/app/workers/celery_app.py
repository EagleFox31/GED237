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

# Watched folders (lot 5): the worker runs beat (-B in docker-compose.yml). No folder
# configured or interval 0: no schedule at all.
if settings.INGEST_WATCH_FOLDERS and settings.INGEST_WATCH_INTERVAL_SECONDS > 0:
    celery_app.conf.beat_schedule = {
        "watch-ingest-folders": {
            "task": "app.workers.tasks.watch_ingest_folders",
            "schedule": float(settings.INGEST_WATCH_INTERVAL_SECONDS),
        }
    }

# Scheduled official reports (post-rc1 lot 9): off unless SCHEDULED_REPORTS_ENABLED.
if (
    settings.SCHEDULED_REPORTS_ENABLED
    and settings.SCHEDULED_REPORTS_INTERVAL_SECONDS > 0
):
    celery_app.conf.beat_schedule = {
        **(celery_app.conf.beat_schedule or {}),
        "run-scheduled-reports": {
            "task": "app.workers.tasks.run_scheduled_reports",
            "schedule": float(settings.SCHEDULED_REPORTS_INTERVAL_SECONDS),
        },
    }

# Quality alerts (post-rc1 lot 9): off unless QUALITY_ALERTS_ENABLED.
if settings.QUALITY_ALERTS_ENABLED and settings.QUALITY_ALERTS_INTERVAL_SECONDS > 0:
    celery_app.conf.beat_schedule = {
        **(celery_app.conf.beat_schedule or {}),
        "evaluate-quality-alerts": {
            "task": "app.workers.tasks.evaluate_quality_alerts",
            "schedule": float(settings.QUALITY_ALERTS_INTERVAL_SECONDS),
        },
    }
