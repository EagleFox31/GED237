#!/bin/sh
# Test sans réseau de c6_summary.sh : un trou sans relevé et un relevé KO doivent apparaître.
set -eu
dir=$(dirname "$0")
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
printf '%s\n' \
  '2026-11-17T08:00:00Z	health=200' \
  '2026-11-17T08:05:00Z	health=200' \
  '2026-11-17T08:10:00Z	health=000' \
  '2026-11-17T08:15:00Z	health=200' \
  '2026-11-17T09:15:00Z	health=200' > "$tmp"
out=$(sh "$dir/c6_summary.sh" "$tmp")
echo "$out"
echo "$out" | grep -q 'Trous sans relevé (> 900 s) : 1' || { echo "FAIL: trou non compté"; exit 1; }
echo "$out" | grep -q '2026-11-17T08:15:00Z -> 2026-11-17T09:15:00Z (60 min)' || { echo "FAIL: trou non listé"; exit 1; }
echo "$out" | grep -q 'Relevés KO : 1' || { echo "FAIL: KO non compté"; exit 1; }
echo "$out" | grep -qE '2026-11-17 matin +5 +4 +80% +3600' || { echo "FAIL: écart max"; exit 1; }
echo "OK"
