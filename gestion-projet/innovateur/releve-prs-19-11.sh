#!/usr/bin/env bash
# Relevé des PR du 19/11 : régénère le tableau de releve-prs-19-11.md (§ 2) à partir de GitHub.
# Lecture seule (gh pr view). Usage : bash releve-prs-19-11.sh [repo]  > /tmp/releve.md
# Colonnes automatiques : statut, base, CI, SHA de tête. Colonnes manuelles (tableau META ci-dessous) :
# relue Q, ligne cible, ordre de fusion, dépend de. Les mettre à jour avant d'exécuter.
set -euo pipefail
REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"

# n|groupe|relue Q|ligne cible|ordre|dépend de
META=(
  "208|file|oui (verte, nightly verte, PASSATION-ci-qa l. 835, 841)|main avant la coupe, donc dans release/v1.0.0|1|-"
  "104|file|-|main, puis coupe release/v1.0.0 sur son SHA de fusion|2|#208"
  "197|post-rc1, étape 1|non|main|3 (écart A : après #161)|#161 (embarque ses commits)"
  "203|post-rc1, étape 1|non|main|4|-"
  "171|ajoutée par O, étape 1|non|main|4 bis|- (deleted_at déjà sur main)"
  "161|post-rc1, étape 2|non|main|5|-"
  "180|dépendance, étape 2|réserves (l. 607)|main|6|#161, #162"
  "183|dépendance, étape 2|verte sur a642c38 (l. 649), verdict à confirmer|main|7|#180"
  "154|dépendance, étape 2|non|main|8|-"
  "193|post-rc1, étape 2|non (CI rouge, l. 836, 843)|main|9 (écart B : down_revision)|#154, #183"
  "186|dépendance, étape 2|non (à corriger, l. 625, 655)|main|10|#193"
  "165|dépendance, étape 2|non|main|11|#186"
  "192|dépendance, étape 2|non|main|12|#165"
  "209|post-rc1, étape 3|non|main, via #180|13|#180"
  "205|post-rc1, étape 3|non|main, via #165|14|#165"
  "152|dépendance, étape 4|non|main|15|-"
  "181|dépendance, étape 4|oui (l. 608), diff final à relire sur main (l. 616)|main, via #152|16|#152"
  "184|post-rc1, étape 4|réserves (après #152, l. 625)|main, via #181|17|#181"
  "211|ajoutée par O, étape 4|non|main, via #184|17 bis|#184"
  "182|post-rc1, étape 4|non (CI non suivie, gelée, l. 797)|main|18|#211"
  "199|post-rc1, étape 4|non|main, via #181|19|#182, et #171 fusionnée"
)

ci_summary() {
  # Résumé des checks : V (verts), R (rouges), A (en attente), S (sautés).
  gh pr view "$1" -R "$REPO" --json statusCheckRollup -q '
    [.statusCheckRollup[]? | (.conclusion // .state // "PENDING")] as $c
    | if ($c|length)==0 then "aucun check"
      else "V\([$c[]|select(.=="SUCCESS")]|length) R\([$c[]|select(.=="FAILURE" or .=="TIMED_OUT" or .=="CANCELLED" or .=="ERROR")]|length) A\([$c[]|select(.=="PENDING" or .=="IN_PROGRESS" or .=="QUEUED" or .=="" or .=="EXPECTED")]|length) S\([$c[]|select(.=="SKIPPED" or .=="NEUTRAL")]|length)" end'
}

echo "Relevé généré le $(date '+%Y-%m-%d %H:%M') sur $REPO, main = $(gh api "repos/$REPO/commits/main" -q '.sha[0:7]')"
echo
echo "| Ordre | PR | Groupe | Titre | Statut | Base | CI | Tête | Relue Q | Ligne cible | Dépend de |"
echo "|---|---|---|---|---|---|---|---|---|---|---|"
for row in "${META[@]}"; do
  IFS='|' read -r n grp q cible ordre dep <<<"$row"
  info=$(gh pr view "$n" -R "$REPO" --json state,isDraft,baseRefName,headRefOid,title,mergedAt \
    -q '"\(.state)\(if .isDraft then " (brouillon)" else "" end)\(if .mergedAt then " " + .mergedAt[0:16] else "" end)|\(.baseRefName)|\(.headRefOid[0:7])|\(.title[0:60] | gsub("\\|";"/"))"')
  IFS='|' read -r st base head title <<<"$info"
  echo "| $ordre | #$n | $grp | $title | $st | \`$base\` | $(ci_summary "$n") | \`$head\` | $q | $cible | $dep |"
done
