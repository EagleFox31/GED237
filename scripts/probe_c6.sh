#!/bin/sh
# C6 (availability) probe: read-only. One line appended to the log per reading.
#   sh scripts/probe_c6.sh                 one reading
#   sh scripts/probe_c6.sh --loop [SECS]   a reading every SECS seconds (default 300), until stopped
# Variables: BASE_URL (default http://localhost, nginx port 80), C6_LOG (default c6.tsv),
#            C6_PREFIX (default edossier_, container name prefix).
# Line format: <UTC time> TAB health=<http code> TAB <name>=<status> ... TAB <name>=<RestartCount> ...
# Protocol and KO rule: gestion-projet/innovateur/protocole-mesures-criteres.md (section C6).
BASE_URL="${BASE_URL:-http://localhost}"
LOG="${C6_LOG:-c6.tsv}"
PREFIX="${C6_PREFIX:-edossier_}"

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
