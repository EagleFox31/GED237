#!/bin/sh
# Lightweight demo stack for the C6 availability probe, one command.
#   sh scripts/probe_stack.sh start    check RAM, start the stack WITHOUT the worker, run probe_c6.sh in a loop
#   sh scripts/probe_stack.sh status   RAM, containers, last readings
#   sh scripts/probe_stack.sh stop     stop the loop and the stack (data volumes are kept)
# The stack keeps the memory caps already set in docker-compose.yml (api 1g, postgres/frontend 768m, redis 192m,
# nginx 64m, migrate/seed 512m while they run). The worker (OCR, 2g) is not started.
# HTTPS: if certs/tls.crt and certs/tls.key exist (see DOCS/exploitation/https-local.md), the `tls` profile is added.
# Variables: MIN_FREE_MB (default 3500, refuse to start below), STOP_FREE_MB (default 1000, the guard stops the
#            stack below), PROBE_SECS (default 300), BASE_URL (default http://localhost:8080), C6_LOG (default c6.tsv).
# Only this project's containers are touched (compose project of this directory).
set -u
cd "$(dirname "$0")/.." || exit 1

MIN_FREE_MB="${MIN_FREE_MB:-3500}"
STOP_FREE_MB="${STOP_FREE_MB:-1000}"
PROBE_SECS="${PROBE_SECS:-300}"
PIDFILE="${C6_PIDFILE:-.probe_stack.pid}"
LOG="${C6_LOG:-c6.tsv}"

free_mb() {
  if command -v free >/dev/null 2>&1; then
    free -m | awk '/^Mem:/ {print $7}'
  else
    powershell.exe -NoProfile -Command "[int]((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1024)" | tr -d '\r'
  fi
}

compose() {
  if [ -f certs/tls.crt ] && [ -f certs/tls.key ]; then
    TLS_CERT_DIR=./certs docker compose -f docker-compose.yml -f docker-compose.tls.yml --profile tls "$@"
  else
    docker compose "$@"
  fi
}

guard_loop() {
  tick=0
  every=$((PROBE_SECS / 60))
  [ "$every" -lt 1 ] && every=1
  while true; do
    if [ $((tick % every)) -eq 0 ]; then
      C6_LOG="$LOG" sh scripts/probe_c6.sh
    fi
    free=$(free_mb)
    if [ -n "$free" ] && [ "$free" -lt "$STOP_FREE_MB" ]; then
      printf '%s\tGUARD free=%sMB < %sMB: stack stopped\n' "$(date -u +%FT%TZ)" "$free" "$STOP_FREE_MB" >> "$LOG"
      compose stop
      rm -f "$PIDFILE"
      exit 0
    fi
    tick=$((tick + 1))
    sleep 60
  done
}

case "${1:-}" in
  start)
    free=$(free_mb)
    echo "free RAM: ${free} MB (minimum ${MIN_FREE_MB})"
    if [ -z "$free" ] || [ "$free" -lt "$MIN_FREE_MB" ]; then
      echo "refused: not enough free memory" >&2
      exit 1
    fi
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "probe loop already running (pid $(cat "$PIDFILE"))"
      exit 0
    fi
    compose up -d --build --scale worker=0 || exit 1
    echo "waiting for /health on ${BASE_URL:-http://localhost:8080} ..."
    i=0
    until [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "${BASE_URL:-http://localhost:8080}/health")" = "200" ]; do
      i=$((i + 1))
      [ "$i" -ge 60 ] && { echo "api not healthy after 5 min" >&2; exit 1; }
      sleep 5
    done
    nohup sh "$0" _loop >/dev/null 2>&1 &
    echo $! > "$PIDFILE"
    echo "stack up without worker, probe every ${PROBE_SECS}s -> $LOG (pid $(cat "$PIDFILE"))"
    ;;
  _loop)
    guard_loop
    ;;
  status)
    echo "free RAM: $(free_mb) MB"
    compose ps --format 'table {{.Name}}\t{{.Status}}'
    [ -f "$LOG" ] && tail -n 3 "$LOG" | cut -c1-200
    ;;
  stop)
    [ -f "$PIDFILE" ] && kill "$(cat "$PIDFILE")" 2>/dev/null
    rm -f "$PIDFILE"
    compose stop
    ;;
  *)
    echo "usage: sh scripts/probe_stack.sh start|status|stop" >&2
    exit 2
    ;;
esac
