"""Where the auth rate-limit counters live (RATE_LIMIT_STORAGE_URI)."""

from limits.storage import MemoryStorage, RedisStorage, storage_from_string

from app.core.config import settings
from app.core.rate_limit import limiter


def test_limiter_counts_where_the_setting_says():
    assert limiter._storage_uri == settings.RATE_LIMIT_STORAGE_URI


def test_default_counters_stay_in_the_process():
    assert settings.RATE_LIMIT_STORAGE_URI == "memory://"
    assert isinstance(limiter._storage, MemoryStorage)


def test_redis_uri_of_the_env_example_gives_shared_counters():
    # Built without connecting: the image must carry the Redis backend of the limits package.
    assert isinstance(storage_from_string("redis://redis:6379/3"), RedisStorage)
