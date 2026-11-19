#!/usr/bin/env bash
# Vérifie que chaque fichier cité entre accents graves dans un document existe.
#
# Usage : gestion-projet/outils/verif-chemins.sh DOCUMENT.md [REF]
#   REF : branche de référence (défaut : branche par défaut du dépôt distant).
# Un chemin cité est trouvé s'il existe dans REF ou dans l'arbre suivi local,
# tel quel ou comme fin de chemin (« Header.tsx », « components/Header.tsx »).
# Seuls les jetons sans espace, joker ni gabarit <x> et avec une extension connue sont lus ;
# « fichier.py:42 » est lu comme « fichier.py ».
# Un fichier qu'une PR ouverte va créer apparaît aussi : le lecteur juge.
# Sortie : une ligne par chemin introuvable (n° de ligne du document) ; code 1
# s'il y en a, 0 sinon. Lecture seule.
set -euo pipefail

doc=${1:?usage : $0 DOCUMENT.md [REF]}
ref=${2:-$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null || echo origin/main)}

{ git ls-tree -r --name-only "$ref"; git ls-files; echo "@@DOC@@"; grep -noE '`[^`]+`' "$doc"; } | awk -v doc="$doc" -v ref="$ref" '
  !indoc && $0 == "@@DOC@@" { indoc = 1; next }
  !indoc { n = split($0, p, "/"); s = p[n]; known[s] = 1
           for (i = n - 1; i >= 1; i--) { s = p[i] "/" s; known[s] = 1 }; next }
  {
    ln = $0; sub(/:.*/, "", ln); t = $0; sub(/^[0-9]+:`/, "", t); sub(/`$/, "", t)
    sub(/:.*/, "", t); sub(/^\.\//, "", t)
    if (t ~ /[[:space:]*?<>]/ || t !~ /\.(tsx|ts|jsx|js|py|md|sh|ya?ml|json|sql|css|toml|ini|cfg|txt|csv)$/) next
    if (!(t in known) && !(t in seen)) { seen[t] = 1; printf "%s:%s : introuvable dans %s ni en local : %s\n", doc, ln, ref, t; miss++ }
  }
  END { if (miss) exit 1; printf "OK : tous les chemins cités existent (%s).\n", ref }'
