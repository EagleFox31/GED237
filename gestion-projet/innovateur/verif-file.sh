#!/usr/bin/env bash
# Contrôle de la file de fusion V1.1 (lecture seule).
#
# Usage : gestion-projet/innovateur/verif-file.sh [file-v1.1.md]
# 1. ORDER : pas de doublon ; chaque DEP pointe vers des PR de ORDER, dans le bon ordre.
# 2. Exhaustivité : chaque PR ouverte doit être dans ORDER, dans HORS_FILE, ou relever
#    d'une règle d'exclusion écrite dans la file (Dependabot ; branche feat/v12-* ou
#    étiquette v1.2, sauf si la PR est dans ORDER). Sinon : erreur avec numéro et titre.
# 3. Information : PR de ORDER ou de HORS_FILE qui ne sont plus ouvertes.
# 4. Numéros de LESSON (LESSON-2026-072) : un numéro ajouté par une PR ouverte ne doit pas
#    désigner une autre leçon (titre différent) sur main ni dans une autre PR ouverte. Le même
#    titre dans plusieurs PR est permis (PR empilées). Lancer `git fetch origin` avant.
# Code 0 si tout va bien, 1 sinon.
set -euo pipefail

file=${1:-$(dirname "$0")/file-v1.1.md}
[ -r "$file" ] || { echo "file introuvable : $file" >&2; exit 1; }

declare -A DEP=()
ORDER_V0= ORDER_V1= ORDER_V2= ORDER_V3= ORDER_V4= ORDER_V5= ORDER_V6= HORS_FILE=
# Seules les affectations ORDER*, HORS_FILE et DEP[...] du fichier sont évaluées.
eval "$(grep -E '^(ORDER(_V[0-9])?|HORS_FILE)="[0-9 $_A-Z]*"$|^DEP\[[0-9]+\]="[0-9 ]*"(; DEP\[[0-9]+\]="[0-9 ]*")*$' "$file")"

status=0
declare -A pos=(); i=0
for n in $ORDER; do
  i=$((i + 1))
  [ -n "${pos[$n]:-}" ] && { echo "ERREUR doublon dans ORDER : #$n"; status=1; }
  pos[$n]=$i
done
for k in "${!DEP[@]}"; do
  [ -z "${pos[$k]:-}" ] && { echo "ERREUR DEP[$k] : #$k absente de ORDER"; status=1; }
  for d in ${DEP[$k]}; do
    if [ -z "${pos[$d]:-}" ]; then echo "ERREUR DEP[$k] : #$d absente de ORDER"; status=1
    elif [ -n "${pos[$k]:-}" ] && [ "${pos[$d]}" -gt "${pos[$k]}" ]; then
      echo "ERREUR ordre : #$k passe avant #$d dont elle dépend"; status=1
    fi
  done
done

lessons=DOCS/engineering/lessons-learned.md
heading='s/^+\{0,1\}### \(LESSON-[0-9]*-[0-9]*\) — /\1 — /p'
declare -A les_titre=() les_prs=(); les_err=0
while IFS= read -r l; do
  les_titre[${l%% *}]=${l#* — }; les_prs[${l%% *}]=main
done < <(git show "origin/main:$lessons" 2>/dev/null | sed -n "$heading")
# Enregistre les LESSON ajoutées par la PR $1 (branche $2) ; erreur si un numéro change de titre.
check_lessons() {
  local id t l
  if ! git rev-parse -q --verify "origin/$2" >/dev/null; then
    echo "info : origin/$2 absente en local (git fetch origin) : LESSON de #$1 non vérifiées"; return
  fi
  while IFS= read -r l; do
    id=${l%% *}; t=${l#* — }
    if [ -z "${les_titre[$id]:-}" ]; then les_titre[$id]=$t; les_prs[$id]="#$1"
    elif [ "${les_titre[$id]}" != "$t" ]; then
      echo "ERREUR LESSON : $id de #$1 désigne une autre leçon que dans ${les_prs[$id]}"
      les_err=$((les_err + 1)); status=1
    else les_prs[$id]+=" #$1"; fi
  done < <(git diff "origin/main...origin/$2" -- "$lessons" 2>/dev/null | sed -n "$heading" | grep -v '^LESSON-[0-9-]* — $' || true)
}

declare -A hors=(); for n in $HORS_FILE; do hors[$n]=1; done
declare -A open=(); absentes=0; regle=0
while IFS=$'\t' read -r num author branch labels title; do
  open[$num]=1
  check_lessons "$num" "$branch"
  [ -n "${pos[$num]:-}" ] && continue
  [ -n "${hors[$num]:-}" ] && continue
  if [[ $author == *dependabot* || $branch == feat/v12-* || ,$labels, == *,v1.2,* ]]; then
    regle=$((regle + 1)); continue
  fi
  echo "ERREUR absente de la file : #$num $title ($branch)"; absentes=$((absentes + 1)); status=1
done < <(gh pr list --state open --limit 300 \
  --json number,author,headRefName,labels,title \
  -q '.[] | [.number, .author.login, .headRefName, ([.labels[].name] + ["-"] | join(",")), .title] | @tsv')
# Le "-" ajouté aux étiquettes évite un champ vide : read fusionne les tabulations consécutives.

for n in $ORDER $HORS_FILE; do
  [ -z "${open[$n]:-}" ] && echo "info : #$n n'est plus ouverte (fusionnée ou fermée)"
done

echo "ORDER : $i PR ; HORS_FILE : ${#hors[@]} ; exclues par règle : $regle ; absentes : $absentes ; LESSON en conflit : $les_err."
exit $status
