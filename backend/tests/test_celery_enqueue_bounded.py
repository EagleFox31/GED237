"""Enqueueing OCR returns or fails within a bounded time when Redis is unreachable (LESSON-2026-026).

Each case runs in a subprocess: the Celery app reads its URLs at import time, and a hang must fail the
test through the subprocess timeout instead of blocking the whole suite.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
UNREACHABLE = (
    "redis://127.0.0.1:1"  # nothing listens on port 1: connections are refused at once
)
QUEUE = "ged-regression-enqueue"
BOUND_SECONDS = 30

ENQUEUE = f"""
from app.workers.tasks import process_document_ocr
try:
    process_document_ocr.apply_async(("doc", "path", "application/pdf"), queue="{QUEUE}")
    print("ENQUEUED")
except Exception as exc:
    print("FAILED", type(exc).__name__)
"""


def _enqueue(broker: str, backend: str) -> str:
    env = {**os.environ, "CELERY_BROKER_URL": broker, "CELERY_RESULT_BACKEND": backend}
    try:
        done = subprocess.run(
            [sys.executable, "-c", ENQUEUE],
            cwd=BACKEND,
            env=env,
            capture_output=True,
            text=True,
            timeout=BOUND_SECONDS,
        )
    except subprocess.TimeoutExpired:
        pytest.fail(
            f"enqueue still blocked after {BOUND_SECONDS}s (broker={broker}, backend={backend})"
        )
    assert done.returncode == 0, done.stderr[-2000:]
    return done.stdout.strip().splitlines()[-1]


def _test_redis() -> str:
    return os.environ.get(
        "TEST_REDIS_URL", os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    ).rsplit("/", 1)[0]


def test_unreachable_result_backend_does_not_block_enqueue():
    broker = f"{_test_redis()}/1"
    try:
        assert _enqueue(broker, f"{UNREACHABLE}/2") == "ENQUEUED"
    finally:
        import redis

        redis.Redis.from_url(broker).delete(QUEUE)  # no worker consumes this queue


def test_unreachable_broker_fails_fast_with_an_error():
    assert _enqueue(f"{UNREACHABLE}/1", f"{UNREACHABLE}/2").startswith("FAILED")
