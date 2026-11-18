#!/usr/bin/env bash
# Contrôles avant un tag de version : le SHA de la branche par défaut est-il bon à taguer ?
# Lecture seule : aucun tag, aucune release, aucun run lancé, rien d'écrit dans le dépôt.
# Les fichiers lus au SHA vont dans un dossier temporaire, supprimé en sortie.
#
# Usage : scripts/tag_preflight.sh [--dry-run] <version> [branche]
#   <version>  ex. v1.0.0-rc.1 (nom du tag à créer)
#   [branche]  défaut : la branche par défaut du dépôt, demandée à GitHub
#   --dry-run  affiche les contrôles prévus sans aucun appel réseau
#
# Une ligne « OK » ou « KO » par contrôle ; arrêt au premier KO.
# Codes de sortie : 0 tout est vert ; 1 un contrôle est KO ; 2 usage.
#
# Réglages (variables d'environnement) :
#   REPO              owner/nom (défaut : dépôt du dossier courant, via gh)
#   REQUIRED_CHECKS   contrôles CI exigés au vert sur le SHA, séparés par « ; »
#   CI_WORKFLOW       workflow qui publie le build du frontend
#   NIGHTLY_WORKFLOW  workflow de recette nocturne
#   DIST_ARTIFACT     nom de l'artefact du build du frontend
#   GUARD_PATH        script « interface sans Internet », lu au SHA
#   ALLOWLIST_PATH    sa liste blanche, lue au SHA
#   NOTES_PATH        notes de version ; {version} est remplacé par <version>
set -euo pipefail

REPO="${REPO:-}"
REQUIRED_CHECKS="${REQUIRED_CHECKS:-CI Gate;Frontend / Build}"
CI_WORKFLOW="${CI_WORKFLOW:-ci.yml}"
NIGHTLY_WORKFLOW="${NIGHTLY_WORKFLOW:-e2e-uat-nightly.yml}"
DIST_ARTIFACT="${DIST_ARTIFACT:-frontend-build}"
GUARD_PATH="${GUARD_PATH:-scripts/check_offline_frontend.sh}"
ALLOWLIST_PATH="${ALLOWLIST_PATH:-frontend/offline-allowlist.txt}"
DEFAULT_NOTES_PATH='gestion-projet/innovateur/notes-version-{version}.md'
NOTES_PATH="${NOTES_PATH:-$DEFAULT_NOTES_PATH}"

usage() { sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2; exit 2; }

DRY=0
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    -h | --help) usage ;;
    -*) echo "option inconnue : $arg" >&2; usage ;;
    *) ARGS+=("$arg") ;;
  esac
done
[ "${#ARGS[@]}" -ge 1 ] && [ "${#ARGS[@]}" -le 2 ] || usage
TAG="${ARGS[0]}"
BRANCH="${ARGS[1]:-}"
if ! [[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]]; then
  echo "version invalide : $TAG (attendu : vX.Y.Z ou vX.Y.Z-suffixe)" >&2
  exit 2
fi
NOTES="${NOTES_PATH//\{version\}/$TAG}"

ok() { printf 'OK  %-10s %s\n' "$1" "$2"; }
ko() { printf 'KO  %-10s %s\n' "$1" "$2"; exit 1; }
# gh, sans retour chariot (gh.exe sous Windows).
ghq() { gh "$@" | tr -d '\r'; }
# Un fichier du dépôt, tel qu'il est au SHA.
file_at_sha() { ghq api "repos/$REPO/contents/$1?ref=$SHA" -H "Accept: application/vnd.github.raw"; }

if [ "$DRY" = 1 ]; then
  cat <<EOF
Contrôles prévus pour $TAG (aucun appel réseau en --dry-run) :
1. depot      dépôt ${REPO:-<demandé à gh>}, branche ${BRANCH:-<branche par défaut, demandée à gh>}
2. sha        SHA de tête de la branche
3. ci         chaque contrôle exigé est vert sur ce SHA : $REQUIRED_CHECKS
4. ci         aucun autre contrôle en échec ou en cours sur ce SHA
5. nightly    dernier run de $NIGHTLY_WORKFLOW sur la branche : vert
6. tag        $TAG n'existe pas encore
7. dist       artefact $DIST_ARTIFACT du run $CI_WORKFLOW, passé à $GUARD_PATH
8. notes      $NOTES présent au SHA, non vide, sans en-tête interne
EOF
  exit 0
fi

command -v gh >/dev/null || ko depot "gh introuvable dans le PATH"

if [ -z "$REPO" ]; then
  REPO="$(ghq repo view --json nameWithOwner -q .nameWithOwner)" || ko depot "dépôt introuvable (gh repo view)"
fi
if [ -z "$BRANCH" ]; then
  BRANCH="$(ghq repo view "$REPO" --json defaultBranchRef -q .defaultBranchRef.name)" ||
    ko depot "branche par défaut introuvable pour $REPO"
fi
[ -n "$REPO" ] && [ -n "$BRANCH" ] || ko depot "dépôt ou branche vide"
ok depot "$REPO, branche $BRANCH"

SHA="$(ghq api "repos/$REPO/commits/$BRANCH" -q .sha)" || ko sha "tête de $BRANCH illisible"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || ko sha "réponse inattendue : $SHA"
ok sha "$SHA"

checks="$(ghq api --paginate "repos/$REPO/commits/$SHA/check-runs?per_page=100" \
  -q '.check_runs[]|"\(.name)\t\(.status)\t\(.conclusion)"')" || ko ci "contrôles du SHA illisibles"
IFS=';' read -ra required <<<"$REQUIRED_CHECKS"
for name in "${required[@]}"; do
  state="$(printf '%s\n' "$checks" | awk -F'\t' -v n="$name" '$1==n {print $2" "$3}' | sort -u | paste -sd, -)"
  [ "$state" = "completed success" ] || ko ci "« $name » : ${state:-absent sur ce SHA}"
  ok ci "« $name » vert"
done
pending="$(printf '%s\n' "$checks" | awk -F'\t' \
  'NF && ($2!="completed" || $3!~/^(success|skipped|neutral)$/) {print $1" ("$2" "$3")"}' | paste -sd, -)"
[ -z "$pending" ] || ko ci "en échec ou en cours : $pending"
ok ci "aucun contrôle en échec ou en cours"

nightly="$(ghq run list -R "$REPO" -w "$NIGHTLY_WORKFLOW" -b "$BRANCH" -L 1 \
  --json status,conclusion,headSha -q '.[0]|"\(.status) \(.conclusion) \(.headSha)"')" ||
  ko nightly "runs de $NIGHTLY_WORKFLOW illisibles"
[ -n "$nightly" ] || ko nightly "aucun run de $NIGHTLY_WORKFLOW sur $BRANCH"
read -r n_status n_conclusion n_sha <<<"$nightly"
[ "$n_status $n_conclusion" = "completed success" ] ||
  ko nightly "dernier run : $n_status $n_conclusion (SHA ${n_sha:0:7})"
if [ "$n_sha" = "$SHA" ]; then
  ok nightly "dernier run vert, sur ce SHA"
else
  ok nightly "dernier run vert, sur ${n_sha:0:7} (antérieur à ce SHA)"
fi

tags="$(ghq api "repos/$REPO/git/matching-refs/tags/$TAG" -q '.[].ref')" || ko tag "tags illisibles"
if printf '%s\n' "$tags" | grep -qxF "refs/tags/$TAG"; then
  ko tag "$TAG existe déjà"
fi
ok tag "$TAG n'existe pas encore"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
# gh.exe ne comprend pas un chemin POSIX quand MSYS_NO_PATHCONV=1.
native() { if command -v cygpath >/dev/null; then cygpath -m "$1"; else printf '%s\n' "$1"; fi; }
mkdir -p "$WORK/guard" "$WORK/front"
run_id="$(ghq run list -R "$REPO" -c "$SHA" -w "$CI_WORKFLOW" -L 1 --json databaseId -q '.[0].databaseId')" ||
  ko dist "runs de $CI_WORKFLOW illisibles"
[ -n "$run_id" ] || ko dist "aucun run de $CI_WORKFLOW sur ce SHA"
gh run download "$run_id" -R "$REPO" -n "$DIST_ARTIFACT" -D "$(native "$WORK/front/dist")" >/dev/null 2>&1 ||
  ko dist "artefact $DIST_ARTIFACT absent du run $run_id (frontend non construit sur ce SHA)"
file_at_sha "$GUARD_PATH" >"$WORK/guard/guard.sh" 2>/dev/null || ko dist "$GUARD_PATH absent au SHA"
file_at_sha "$ALLOWLIST_PATH" >"$WORK/front/$(basename "$ALLOWLIST_PATH")" 2>/dev/null ||
  ko dist "$ALLOWLIST_PATH absent au SHA"
guard_out="$(bash "$WORK/guard/guard.sh" "$WORK/front" 2>&1)" ||
  ko dist "l'interface dépend d'Internet : $(printf '%s\n' "$guard_out" | tail -n 1)"
ok dist "$(printf '%s\n' "$guard_out" | tail -n 1)"

file_at_sha "$NOTES" >"$WORK/notes.md" 2>/dev/null || ko notes "$NOTES absent au SHA"
[ -s "$WORK/notes.md" ] || ko notes "$NOTES est vide"
if head -n 5 "$WORK/notes.md" | grep -Eiq 'brouillon|Pour\**[[:space:]]*:'; then
  ko notes "en-tête interne présent dans $NOTES"
fi
ok notes "$NOTES présent, sans en-tête interne"

echo "PRÊT : $TAG peut être posé sur $SHA"
