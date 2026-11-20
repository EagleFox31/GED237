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

# --postes : C1 + C2 (2400 Mo) plus la réserve commune (2048 Mo) doivent tenir, et W2 + relais
# (3564 Mo) en plus s'ils ne tournent pas encore.
check_mem() { # attendu nom mémoire_disponible_Mo w2_en_marche
  printf '%s\n' data.img windows.base windows.boot > "$tmp/ls"
  local rc=0
  LAB_W2_LISTING="$tmp/ls" LAB_MEM_AVAILABLE_MB="$3" LAB_W2_RUNNING="$4" \
    sh "$SCRIPT" --check --postes >/dev/null 2>&1 || rc=$?
  if [ "$rc" -eq "$1" ]; then echo "ok   $2 (code $rc)"; else echo "KO   $2 : code $rc, attendu $1"; failures=$((failures + 1)); fi
}
check_mem 0 "postes, W2 en marche, mémoire suffisante" 4448 true
check_mem 3 "postes, W2 en marche, réserve entamée"    4447 true
check_mem 3 "postes, VM chargée (19/11)"               1900 true
check_mem 3 "postes, W2 arrêté, 4448 Mo"               4448 false
check_mem 0 "postes, W2 arrêté, mémoire suffisante"    8012 false
check_mem 3 "postes, W2 arrêté, réserve entamée"       8011 false

rc=0; sh "$SCRIPT" --inconnu >/dev/null 2>&1 || rc=$?
if [ "$rc" -eq 2 ]; then echo "ok   argument inconnu (code 2)"; else echo "KO   argument inconnu : code $rc"; failures=$((failures + 1)); fi

[ "$failures" -eq 0 ] || { echo "ECHEC : $failures cas" >&2; exit 1; }
echo "OK : garde-fou hors ligne"
