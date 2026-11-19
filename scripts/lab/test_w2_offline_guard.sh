#!/usr/bin/env bash
# Non-régression du garde-fou hors ligne de W2 (scripts/lab/w2/offline_up.sh --check).
# Aucun appel à docker : le contenu du volume est simulé par LAB_W2_LISTING.
# Usage : bash scripts/lab/test_w2_offline_guard.sh
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/w2/offline_up.sh"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
failures=0

check() { # attendu nom contenu...
  local want="$1" name="$2"; shift 2
  printf '%s\n' "$@" > "$tmp/ls"
  local rc=0
  LAB_W2_LISTING="$tmp/ls" sh "$SCRIPT" --check >/dev/null 2>&1 || rc=$?
  if [ "$rc" -eq "$want" ]; then echo "ok   $name (code $rc)"; else echo "KO   $name : code $rc, attendu $want"; failures=$((failures + 1)); fi
}

check 0 "installé, validé, ISO en place"       data.img windows.base windows.boot custom.iso
check 0 "installé, validé, ISO retirée ensuite" data.img windows.base windows.boot
check 3 "installé, jamais arrêté proprement"    data.img windows.base custom.iso
check 3 "ISO supprimée avant l'arrêt (19/11)"   data.img windows.base
check 3 "volume vidé par l'image"               tmp
check 3 "volume vide"                           ""

rc=0; sh "$SCRIPT" --inconnu >/dev/null 2>&1 || rc=$?
if [ "$rc" -eq 2 ]; then echo "ok   argument inconnu (code 2)"; else echo "KO   argument inconnu : code $rc"; failures=$((failures + 1)); fi

[ "$failures" -eq 0 ] || { echo "ECHEC : $failures cas" >&2; exit 1; }
echo "OK : garde-fou hors ligne"
