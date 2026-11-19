#!/usr/bin/env bash
# Volume test (item 8): isolated stack docker-compose.load.yml, corpus from backend/scripts/load_dataset.py,
# chronometer backend/scripts/load_measure.py. Results in gestion-projet/recette/charge/.
#   bash scripts/load-test.sh calibrate     # 2 000 files: 1 batch, then 4 batches in parallel
#   bash scripts/load-test.sh witness       # 1 000 files of ~70 KB (file size of the #166 protocol)
#   LOAD_CONFIRM=yes bash scripts/load-test.sh full [parallel] [label]   # 100 000 files, 10 batches
#   bash scripts/load-test.sh down          # containers and volumes removed
# Each run uses its own seed and folder: contents never collide with an earlier run (no duplicate),
# so runs follow each other on the same database. The demo baseline (accounts, rules, demo corpus)
# is seeded once per stack; seed_demo.py purges the demo tenants, so it never runs again after that.
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1
export LOAD_GIT_SHA="${LOAD_GIT_SHA:-$(git rev-parse --short HEAD)}"
project="${LOAD_COMPOSE_PROJECT:-ged-load}"
dc=(docker compose -f docker-compose.load.yml -p "$project")
out_dir=gestion-projet/recette/charge
mkdir -p "$out_dir"

stack_up() {
  "${dc[@]}" up -d --build --wait postgres redis
  if ! "${dc[@]}" run --rm --no-deps tools test -f /data/ingest/.baseline-done; then
    "${dc[@]}" run --rm --no-deps tools python scripts/demo_dataset.py --out /data/ingest/demo --manifest /e2e-data/demo-manifest.json
    "${dc[@]}" run --rm --no-deps tools sh -c 'sh scripts/e2e_reset.sh demo && touch /data/ingest/.baseline-done'
  fi
  # OCR queued by the baseline import (demo images) must not run inside a measure.
  "${dc[@]}" exec -T redis redis-cli -n 1 DEL celery >/dev/null
  "${dc[@]}" up -d --build --wait api worker
}

corpus() {  # corpus <folder> <files> <size-kb> <batches> <seed>
  "${dc[@]}" run --rm --no-deps tools python scripts/load_dataset.py \
    --out "/data/ingest/$1" --files "$2" --size-kb "$3" --batches "$4" --seed "$5"
}

stats_pid=""
stop_stats() { [ -n "$stats_pid" ] && kill "$stats_pid" 2>/dev/null; stats_pid=""; }
trap stop_stats EXIT

measure() {  # measure <folder> <label> <parallel>
  local stats="$out_dir/$2-stats.txt"
  ( while :; do
      date '+%H:%M:%S' >>"$stats"
      docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' $("${dc[@]}" ps -q) >>"$stats" 2>&1 || true
      sleep 5
    done ) &
  stats_pid=$!
  local code=0
  # --build: the probe image must carry the current load_measure.py.
  "${dc[@]}" run --rm --no-deps --build probe python scripts/load_measure.py \
    --root "/data/ingest/$1" --label "$2" --parallel "$3" --out-dir /results/charge || code=$?
  stop_stats
  for id in $("${dc[@]}" ps -aq); do
    docker inspect -f '{{.Name}} oom={{.State.OOMKilled}} restarts={{.RestartCount}} status={{.State.Status}}' "$id"
  done | tee -a "$out_dir/$2.txt"
  return "$code"
}

case "${1:-}" in
  calibrate)
    stack_up
    corpus calib-1 2000 1-4 1 1001
    corpus calib-4 2000 1-4 4 1004
    measure calib-1 calib-1lot 1
    measure calib-4 calib-4lots 4
    ;;
  tune)  # tune <label> <seed>: same shape as calib-4 (2 000 files, 4 batches), fresh folder and seed
    [ -n "${2:-}" ] && [ -n "${3:-}" ] || { echo "usage: tune <label> <seed>"; exit 2; }
    echo "setting: api ${LOAD_API_CPUS:-1.25} cpu, worker ${LOAD_WORKER_CPUS:-1.25} cpu, concurrency ${LOAD_WORKER_CONCURRENCY:-2}" \
      | tee "$out_dir/$2-setting.txt"
    stack_up
    corpus "tune-$2" 2000 1-4 4 "$3"
    measure "tune-$2" "$2" 4
    ;;
  witness)
    stack_up
    corpus witness 1000 70 1 1070
    measure witness witness-70ko 1
    ;;
  full)
    [ "${LOAD_CONFIRM:-}" = yes ] || { echo "full run needs LOAD_CONFIRM=yes (signal of O: lab of Q down, 30 min of calm)"; exit 2; }
    label="${3:-charge-100k-$(date +%F)}"  # a second run of the day gets its own label
    echo "setting: postgres ${LOAD_PG_CPUS:-1.0} cpu ${LOAD_PG_MEM:-704m}, redis ${LOAD_REDIS_CPUS:-0.25} cpu," \
      "api ${LOAD_API_CPUS:-1.25} cpu ${LOAD_API_MEM:-1g} x${LOAD_API_WORKERS:-1} process," \
      "worker ${LOAD_WORKER_CPUS:-1.25} cpu ${LOAD_WORKER_MEM:-1g} concurrency ${LOAD_WORKER_CONCURRENCY:-2}" \
      | tee "$out_dir/$label-setting.txt"
    stack_up
    corpus full 100000 1-4 10 237
    measure full "$label" "${2:-1}"
    ;;
  down)
    "${dc[@]}" --profile tools down -v
    ;;
  *)
    sed -n '2,8p' "$0"
    exit 2
    ;;
esac
