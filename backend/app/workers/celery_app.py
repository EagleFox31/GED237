import os
from celery import Celery

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
    task_default_queue="celery",
)
