#!/usr/bin/env bash
# Garde-fou « interface sans Internet » : échoue si le navigateur peut dépendre d'une URL
# externe. Prévention vérifiable du retour de styles, polices ou avatars servis par Internet
# (CDN Tailwind, Google Fonts, esm.sh, api.dicebear.com : corrigés par #116, #122, #126).
#
# Usage : scripts/check_offline_frontend.sh [dossier frontend]   (défaut : frontend)
#   ALLOWLIST=<fichier> remplace la liste blanche (défaut : <frontend>/offline-allowlist.txt).
#
# Ce qui est contrôlé :
# 1. Sources servies au navigateur (.html .ts .tsx .js .jsx .mjs .css .svg), hors
#    node_modules, dist, e2e, tests (*.test.*, *.spec.*, __tests__/, test/, tests/),
#    fichiers de configuration de build (*.config.*) et déclarations (*.d.ts) :
#    toute URL http(s), sauf sur une ligne de commentaire (//, /*, *, <!--).
# 2. Build (<frontend>/dist, s'il existe) : toute URL des .html ; dans les .css, les
#    url(…) et @import ; dans les .js, les import(…), import et from. Les chaînes des
#    bibliothèques (espaces de noms XML, liens vers une doc d'erreur ou une licence) ne
#    sont pas chargées par le navigateur et ne sont pas relevées.
# Une URL est acceptée si elle correspond à une expression de la liste blanche.
set -euo pipefail

FRONT="${1:-frontend}"
FRONT="${FRONT%/}"
ALLOW="${ALLOWLIST:-$FRONT/offline-allowlist.txt}"
URL_RE="https?://[^\"' \`)<>\\]+"
COMMENT_RE='^[[:space:]]*(//|/\*|\*|<!--)'

[ -d "$FRONT" ] || { echo "dossier frontend introuvable : $FRONT" >&2; exit 2; }
[ -f "$ALLOW" ] || { echo "liste blanche introuvable : $ALLOW" >&2; exit 2; }
allow_re="$(grep -vE '^[[:space:]]*(#|$)' "$ALLOW" | paste -sd'|' - || true)"

failures=0
report() { # report <fichier> <ligne> <url>
  if [ -n "$allow_re" ] && printf '%s\n' "$3" | grep -qE "$allow_re"; then return 0; fi
  echo "::error file=$1,line=$2::URL externe pour le navigateur : $3 (l'embarquer dans le build, ou l'ajouter commentée à $ALLOW)"
  failures=$((failures + 1))
}

# Fichiers lus sur l'entrée standard (séparés par NUL), un grep par fichier : le chemin
# n'est jamais découpé sur « : » (lecteur Windows C:).
# Toutes les URL, lignes de commentaire exclues.
scan_all() {
  local file entry line content url
  while IFS= read -r -d "" file; do
    while IFS= read -r entry; do
      line="${entry%%:*}"; content="${entry#*:}"
      printf '%s\n' "$content" | grep -qE "$COMMENT_RE" && continue
      while IFS= read -r url; do
        report "$file" "$line" "$url"
      done < <(printf '%s\n' "$content" | grep -oE "$URL_RE")
    done < <(grep -nE "$URL_RE" -- "$file" 2>/dev/null || true)
  done
}

# Seulement les URL chargées (motif de chargement <loader> suivi d'une URL).
scan_loads() { # scan_loads <motif ERE>
  local file entry line url
  while IFS= read -r -d "" file; do
    while IFS= read -r entry; do
      line="${entry%%:*}"
      url="$(printf '%s\n' "${entry#*:}" | grep -oE "$URL_RE" | head -n1)"
      report "$file" "$line" "$url"
    done < <(grep -noE "($1)[[:space:]]*[\"'(]?[[:space:]]*[\"']?$URL_RE" -- "$file" 2>/dev/null || true)
  done
}

list_sources() {
  find "$FRONT" \( -name node_modules -o -name dist -o -name e2e -o -name __tests__ -o -name test -o -name tests \) -prune -o \
    -type f \( -name '*.html' -o -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.css' -o -name '*.svg' \) \
    ! -name '*.test.*' ! -name '*.spec.*' ! -name '*.config.*' ! -name '*.d.ts' -print0
}
sources="$(list_sources | tr -cd "\0" | wc -c | tr -d "[:space:]")"
scan_all < <(list_sources)

dist="non construit"
if [ -d "$FRONT/dist" ]; then
  dist="contrôlé"
  scan_all < <(find "$FRONT/dist" -type f -name '*.html' -print0)
  scan_loads 'url\(|@import' < <(find "$FRONT/dist" -type f -name '*.css' -print0)
  scan_loads 'import\(|import|from' < <(find "$FRONT/dist" -type f \( -name '*.js' -o -name '*.mjs' \) -print0)
fi

if [ "$failures" -gt 0 ]; then
  echo "ÉCHEC : $failures URL externe(s) ; l'interface doit fonctionner sans Internet." >&2
  exit 1
fi
echo "OK : aucune URL externe ($sources fichier(s) source ; dist : $dist)."
