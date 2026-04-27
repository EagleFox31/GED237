# backend/app/core/authz/metrics.py
import json
import logging
from collections import Counter
from threading import Lock

from app.core.config import settings

logger = logging.getLogger(__name__)

_metrics_lock = Lock()
_authz_counter: Counter[tuple[str, str, str, str, str, str]] = Counter()
_redis_lock = Lock()
_redis_state_lock = Lock()
_redis_client = None
_redis_error_logged = False
_dropped_lock = Lock()
_authz_metrics_dropped = 0


def _redis_hash_key() -> str:
    return f"{settings.AUTHZ_METRICS_REDIS_PREFIX}:counter"


def _serialize_key(key: tuple[str, str, str, str, str, str]) -> str:
    return json.dumps(key, separators=(",", ":"))


def _deserialize_key(value: str) -> tuple[str, str, str, str, str, str]:
    raw = json.loads(value)
    return (
        str(raw[0]),
        str(raw[1]),
        str(raw[2]),
        str(raw[3]),
        str(raw[4]),
        str(raw[5]),
    )


def _get_redis_client():
    global _redis_client
    if _redis_client is None:
        with _redis_lock:
            if _redis_client is None:
                import redis

                redis_url = settings.AUTHZ_METRICS_REDIS_URL or settings.REDIS_URL
                _redis_client = redis.Redis.from_url(
                    redis_url,
                    decode_responses=True,
                )
    return _redis_client


def _log_redis_error_once(exc: Exception) -> None:
    global _redis_error_logged
    with _redis_state_lock:
        if _redis_error_logged:
            return
        _redis_error_logged = True
    logger.warning(
        "[AUTHZ_METRICS_REDIS_ERROR] backend=redis unavailable, dropping metric updates: %s",
        exc,
        exc_info=True,
    )


def _mark_redis_healthy() -> None:
    global _redis_error_logged
    should_log = False
    with _redis_state_lock:
        if _redis_error_logged:
            _redis_error_logged = False
            should_log = True
    if should_log:
        logger.info("[AUTHZ_METRICS_REDIS_RECOVERED] backend=redis is healthy again.")


def _record_dropped_metric() -> None:
    global _authz_metrics_dropped
    with _dropped_lock:
        _authz_metrics_dropped += 1


def get_authz_metrics_dropped_count() -> int:
    with _dropped_lock:
        return _authz_metrics_dropped


def is_authz_metrics_redis_degraded() -> bool:
    with _redis_state_lock:
        return _redis_error_logged


def record_authz_decision(
    *,
    allowed: bool,
    role: str,
    resource: str,
    action: str,
    tenant_id: str,
    reason: str,
) -> None:
    decision = "allow" if allowed else "deny"
    key = (decision, role, resource, action, tenant_id, reason)
    if settings.AUTHZ_METRICS_BACKEND == "redis":
        try:
            client = _get_redis_client()
            client.hincrby(_redis_hash_key(), _serialize_key(key), 1)
            _mark_redis_healthy()
            return
        except Exception as exc:
            _log_redis_error_once(exc)
            _record_dropped_metric()
            return

    with _metrics_lock:
        _authz_counter[key] += 1


def get_authz_metrics_snapshot() -> list[dict]:
    if settings.AUTHZ_METRICS_BACKEND == "redis":
        try:
            client = _get_redis_client()
            payload = client.hgetall(_redis_hash_key())
            _mark_redis_healthy()
            items = [
                (_deserialize_key(field), int(count))
                for field, count in payload.items()
            ]
            return [
                {
                    "decision": decision,
                    "role": role,
                    "resource": resource,
                    "action": action,
                    "tenant_id": tenant_id,
                    "reason": reason,
                    "count": count,
                }
                for (
                    decision,
                    role,
                    resource,
                    action,
                    tenant_id,
                    reason,
                ), count in items
            ]
        except Exception as exc:
            _log_redis_error_once(exc)
            return []

    with _metrics_lock:
        items = list(_authz_counter.items())
    return [
        {
            "decision": decision,
            "role": role,
            "resource": resource,
            "action": action,
            "tenant_id": tenant_id,
            "reason": reason,
            "count": count,
        }
        for (decision, role, resource, action, tenant_id, reason), count in items
    ]


def reset_authz_metrics() -> None:
    global _authz_metrics_dropped
    if settings.AUTHZ_METRICS_BACKEND == "redis":
        try:
            client = _get_redis_client()
            client.delete(_redis_hash_key())
            _mark_redis_healthy()
        except Exception as exc:
            _log_redis_error_once(exc)
        with _dropped_lock:
            _authz_metrics_dropped = 0
        with _metrics_lock:
            _authz_counter.clear()
        return

    with _metrics_lock:
        _authz_counter.clear()
    with _dropped_lock:
        _authz_metrics_dropped = 0
