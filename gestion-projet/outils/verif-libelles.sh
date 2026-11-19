#!/usr/bin/env bash
# Vérifie qu'un libellé d'écran cité dans un script de démo existe dans le code.
#
# Usage : gestion-projet/outils/verif-libelles.sh [--ref REF] [--dans CHEMIN]... "Libellé" ["Menu > Sous-menu"]...
#   --ref  : branche lue (défaut : branche par défaut du dépôt distant).
#   --dans : limite la recherche (ex. frontend/components/Sidebar.tsx pour un
#            menu) ; défaut : frontend/, hors tests.
# « A > B » vérifie chaque partie. Casse ignorée (l'écran met souvent en
# majuscules par CSS). Code 1 si un libellé manque. Lecture seule.
set -euo pipefail

ref=$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)
paths=()
while [ $# -gt 0 ]; do
  case $1 in
    --ref) ref=$2; shift 2 ;;
    --dans) paths+=("$2"); shift 2 ;;
    *) break ;;
  esac
done
[ $# -gt 0 ] || { echo "usage : $0 [--ref REF] [--dans CHEMIN]... \"Libellé\"..." >&2; exit 2; }
[ ${#paths[@]} -gt 0 ] || paths=(frontend/ ':!frontend/e2e' ':!*.spec.ts' ':!*.test.ts' ':!*.test.tsx')

bad=0
for label in "$@"; do
  IFS='>' read -ra parts <<< "$label"
  for part in "${parts[@]}"; do
    part=$(printf '%s' "$part" | sed 's/^[[:space:]«]*//; s/[[:space:]»]*$//')
    [ -n "$part" ] || continue
    hits=$(git grep -F -i -l -e "$part" "$ref" -- "${paths[@]}" 2>/dev/null | sed "s#^$ref:##" | head -3 | paste -sd, - || true)
    if [ -n "$hits" ]; then echo "OK      « $part » : $hits"; else echo "ABSENT  « $part »"; bad=1; fi
  done
done
exit $bad
