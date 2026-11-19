#!/usr/bin/env bash
# Ajoute une entrée datée à la fin d'un fichier de passation, sans jamais le réécrire.
#
# Usage : scripts/passation-add.sh FICHIER "Sujet" <<'EOF'
#         - corps de l'entrée (Markdown)
#         EOF
# Chaque session lance ce script sur SON fichier (PASSATION-<rôle>.md).
# Titre : « ## AAAA-MM-JJ HH:MM — Sujet », heure locale réelle.
# Relance sans risque : si la dernière entrée a déjà ce sujet et ce corps,
# rien n'est ajouté. Le fichier est créé s'il n'existe pas.
set -euo pipefail

file=${1:?usage : $0 FICHIER \"Sujet\" < corps}
subject=${2:?usage : $0 FICHIER \"Sujet\" < corps}
body=$(cat)
[ -n "${body//[[:space:]]/}" ] || { echo "corps vide : rien ajouté" >&2; exit 2; }

if [ -s "$file" ]; then
  last=$(awk '/^## /{h=$0; b=""; next} {b=b $0 "\n"} END{print h; printf "%s", b}' "$file")
  last_subject=$(printf '%s\n' "$last" | head -1 | sed 's/^## [0-9-]* [0-9:]* — //')
  last_body=$(printf '%s\n' "$last" | tail -n +2 | sed -e '/./,$!d')
  if [ "$last_subject" = "$subject" ] && [ "$last_body" = "$(printf '%s\n' "$body" | sed -e '/./,$!d')" ]; then
    echo "déjà présent en dernière entrée : rien ajouté"; exit 0
  fi
  [ -z "$(tail -c1 "$file")" ] || printf '\n' >> "$file"
fi

printf '\n## %s — %s\n\n%s\n' "$(date '+%Y-%m-%d %H:%M')" "$subject" "$body" >> "$file"
echo "ajouté à $file : $(tail -n +1 "$file" | grep '^## ' | tail -1)"
