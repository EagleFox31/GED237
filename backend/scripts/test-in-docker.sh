#!/usr/bin/env bash
# Run backend tests (or any command) in python:3.12-slim, like CI, without a local
# Python/PostgreSQL/Redis install. Idempotent: network, containers and volumes are
# created only when missing and reused on later runs.
#
# Usage (from repo root or backend/):
#   bash backend/scripts/test-in-docker.sh                          # full suite + coverage gate
#   bash backend/scripts/test-in-docker.sh python -m pytest -q tests/api/test_users.py
#   MIGRATION_DB=mig_fresh bash backend/scripts/test-in-docker.sh alembic upgrade head
#
# Settings (env): GED_TEST_PREFIX (default gedtest), PYTHON_IMAGE (python:3.12-slim),
# POSTGRES_IMAGE (postgres:16-alpine), REDIS_IMAGE (redis:7-alpine), MIGRATION_DB (test_ged).
# Resource caps (env): RUNNER_MEMORY (2g), RUNNER_CPUS (2), PG_MEMORY (512m), PG_CPUS (1),
# REDIS_MEMORY (128m). Applied to existing containers too (docker update), so a host
# never gives the test stack all its RAM/CPU. Logs are capped at 2 x 10 MB per container.
set -euo pipefail

PREFIX="${GED_TEST_PREFIX:-gedtest}"
NET="$PREFIX-net"
PG="$PREFIX-pg"
REDIS="$PREFIX-redis"
PYTHON_IMAGE="${PYTHON_IMAGE:-python:3.12-slim}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"
REDIS_IMAGE="${REDIS_IMAGE:-redis:7-alpine}"
DB="${MIGRATION_DB:-test_ged}"
RUNNER_MEMORY="${RUNNER_MEMORY:-2g}"
RUNNER_CPUS="${RUNNER_CPUS:-2}"
PG_MEMORY="${PG_MEMORY:-512m}"
PG_CPUS="${PG_CPUS:-1}"
REDIS_MEMORY="${REDIS_MEMORY:-128m}"
LOG_OPTS=(--log-opt max-size=10m --log-opt max-file=2)

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Docker Desktop on Windows needs a native path for bind mounts.
if command -v cygpath >/dev/null 2>&1; then BACKEND_DIR="$(cygpath -w "$BACKEND_DIR")"; fi

if [ "$#" -eq 0 ]; then
  set -- python -m pytest -p no:cacheprovider -q --cov=app --cov-fail-under=70
fi

docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null

if ! docker container inspect "$PG" >/dev/null 2>&1; then
  docker run -d --name "$PG" --network "$NET" "${LOG_OPTS[@]}" --shm-size=128m \
    -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
fi
# --memory-swap equal to --memory: no swap on top of the cap. No-op when already applied.
docker update --memory "$PG_MEMORY" --memory-swap "$PG_MEMORY" --cpus "$PG_CPUS" "$PG" >/dev/null
docker start "$PG" >/dev/null
if ! docker container inspect "$REDIS" >/dev/null 2>&1; then
  docker run -d --name "$REDIS" --network "$NET" "${LOG_OPTS[@]}" "$REDIS_IMAGE" \
    redis-server --save "" --appendonly no >/dev/null
fi
docker update --memory "$REDIS_MEMORY" --memory-swap "$REDIS_MEMORY" --cpus 0.5 "$REDIS" >/dev/null
docker start "$REDIS" >/dev/null

until docker exec "$PG" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
for name in test_ged "$DB"; do
  exists="$(docker exec "$PG" psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$name'")"
  [ "$exists" = "1" ] || docker exec "$PG" createdb -U postgres "$name"
done

# The source is mounted read-only and copied, so the container never writes into the repo.
MSYS_NO_PATHCONV=1 docker run --rm --network "$NET" "${LOG_OPTS[@]}" \
  --memory "$RUNNER_MEMORY" --memory-swap "$RUNNER_MEMORY" --cpus "$RUNNER_CPUS" \
  -v "$BACKEND_DIR":/src:ro -v "$PREFIX-pip":/root/.cache/pip -v "$PREFIX-venv":/venv \
  -e TEST_DATABASE_URL="postgresql+asyncpg://postgres:postgres@$PG:5432/test_ged" \
  -e TEST_REDIS_URL="redis://$REDIS:6379/0" \
  -e DATABASE_URL="postgresql+asyncpg://postgres:postgres@$PG:5432/$DB" \
  -e REDIS_URL="redis://$REDIS:6379/0" \
  -e PYTHONDONTWRITEBYTECODE=1 \
  "$PYTHON_IMAGE" bash -c '
    set -e
    [ -x /venv/bin/python ] || python -m venv /venv
    /venv/bin/pip install -q --disable-pip-version-check \
      --extra-index-url https://download.pytorch.org/whl/cpu -r /src/requirements.txt
    rm -rf /work && mkdir /work
    tar -C /src --exclude=./venv --exclude=__pycache__ -cf - . | tar -C /work -xf -
    cd /work && export PATH=/venv/bin:$PATH
    exec "$@"
  ' _ "$@"
