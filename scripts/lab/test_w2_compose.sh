#!/usr/bin/env bash
# Garde-fou du poste W2 (lecture seule) : la mémoire de Windows reste fixe et tient sous le plafond.
# Usage : bash scripts/lab/test_w2_compose.sh
set -euo pipefail

FILE="$(cd "$(dirname "$0")" && pwd)/w2/compose.yml"
fail() { echo "ECHEC : $1 ($FILE)" >&2; exit 1; }

to_mb() {
  case "$1" in
    *[Gg]) echo $(( ${1%[Gg]} * 1024 )) ;;
    *[Mm]) echo "${1%[Mm]}" ;;
    *) fail "unité inattendue : $1" ;;
  esac
}

ram=$(sed -n 's/^ *RAM_SIZE: *"\{0,1\}\([0-9]*[GgMm]\)"\{0,1\} *$/\1/p' "$FILE")
limit=$(sed -n 's/^ *mem_limit: *\([0-9]*[GgMm]\) *$/\1/p' "$FILE")
[ -n "$ram" ] || fail "RAM_SIZE absent"
[ -n "$limit" ] || fail "mem_limit absent"

# Sans RAM_CHECK=N, l'image remplace RAM_SIZE par « max », calculé sur le reste de la mémoire du
# conteneur (cache disque compris) : arrêt en code 16 après le téléchargement de l'ISO (19/11).
grep -Eq '^ *RAM_CHECK: *"?(N|n|no|false|0)"? *$' "$FILE" || fail "RAM_CHECK doit valoir \"N\""

# QEMU a besoin d'environ 256 Mo en plus de la mémoire de Windows.
ram_mb=$(to_mb "$ram"); limit_mb=$(to_mb "$limit")
[ "$limit_mb" -ge $(( ram_mb + 256 )) ] || fail "mem_limit ($limit) < RAM_SIZE ($ram) + 256 Mo"

echo "OK : RAM_SIZE $ram fixe (RAM_CHECK=N), mem_limit $limit"
