#!/bin/sh
# C6 (availability) probe: read-only. One line appended to the log per reading.
#   sh scripts/probe_c6.sh                 one reading
#   sh scripts/probe_c6.sh --loop [SECS]   a reading every SECS seconds (default 300), until stopped
# Variables: BASE_URL (default http://localhost:8080, compose APP_PORT), C6_LOG (default c6.tsv),
#            C6_PREFIX (default edossier_, container name prefix).
# Provenance (LESSON-2026-083): with C6_EXPECT_SHA set, the probe refuses to start (exit 3) unless
#   C6_SOURCE (default .) is a clean checkout of that commit and the Python code served by the API
#   container (C6_API, default <prefix>api) is byte-identical to C6_SOURCE/backend (app/ and alembic/).
#   A merge on main does not redeploy a running stack: without this check a series can be filed under
#   a commit the stack does not run.
# Line format: <UTC time> TAB health=<http code> TAB <name>=<status> ... TAB <name>=<RestartCount> ...
# Protocol and KO rule: gestion-projet/innovateur/protocole-mesures-criteres.md (section C6).
BASE_URL="${BASE_URL:-http://localhost:8080}"
LOG="${C6_LOG:-c6.tsv}"
PREFIX="${C6_PREFIX:-edossier_}"

refuse() { echo "C6 refused: $1" >&2; exit 3; }

if [ -n "${C6_EXPECT_SHA:-}" ]; then
  case "$C6_EXPECT_SHA" in
    *[!0-9a-f]* | ?????? | ????? | ???? | ??? | ?? | ?) refuse "C6_EXPECT_SHA must be at least 7 hex characters" ;;
  esac
  SRC="${C6_SOURCE:-.}"
  API="${C6_API:-${PREFIX}api}"
  head=$(git -C "$SRC" rev-parse HEAD 2>/dev/null || true)
  case "$head" in
    "$C6_EXPECT_SHA"*) ;;
    *) refuse "source $SRC is at ${head:-no commit}, not $C6_EXPECT_SHA" ;;
  esac
  [ -z "$(git -C "$SRC" status --porcelain --untracked-files=no)" ] || refuse "source $SRC has local changes"
  # Same digest on any host: Git Bash prints "hash *path", Linux "hash  path"; normalise, keep the hash only.
  sum='find app alembic -type f -name "*.py" | LC_ALL=C sort | xargs sha256sum | sed "s/ [*]/  /" | sha256sum | cut -d" " -f1'
  want=$(cd "$SRC/backend" && sh -c "$sum")
  got=$(docker exec "$API" sh -c "cd /app && $sum" 2>/dev/null || true)
  [ -n "$got" ] && [ "$got" = "$want" ] || refuse "code served by $API differs from $C6_EXPECT_SHA (or $API is not running)"
  echo "C6 provenance: $head, code served by $API = source" >&2
fi

reading() {
  ts=$(date -u +%FT%TZ)
  health=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$BASE_URL/health" || true)
  ps=$(docker ps --filter "name=$PREFIX" --format '{{.Names}}={{.Status}}' | sort | tr '\n' ' ')
  ids=$(docker ps -q --filter "name=$PREFIX")
  restarts=
  [ -n "$ids" ] && restarts=$(docker inspect -f '{{.Name}}={{.RestartCount}}' $ids | tr -d / | sort | tr '\n' ' ')
  printf '%s\thealth=%s\t%s\t%s\n' "$ts" "${health:-000}" "$ps" "$restarts" >> "$LOG"
}

if [ "$1" = "--loop" ]; then
  while true; do reading; sleep "${2:-300}"; done
else
  reading
fi
