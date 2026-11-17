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
  "154|dépendance (hors liste)|non|main|3|-"
  "193|post-rc1|non (CI rouge, revue au prochain SHA de B, l. 836, 843)|main|4|#154"
  "161|post-rc1|non|main|5|-"
  "197|post-rc1|non|main|6|-"
  "203|post-rc1|non|main|7|-"
  "184|post-rc1|non (relecture après #182, l. 688)|main, via #181 puis #152|8|#181, #152"
  "182|post-rc1|non (CI non suivie, gelée, l. 797)|main|9|#184"
  "199|post-rc1|non|main, via #181 puis #152|10|#181, #152"
  "205|post-rc1|non|main, via #165|11|#165"
  "209|post-rc1|non|main, via #180|12|#180"
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
