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
  "179|étape 1 (B)|oui (l. 606)|main|3|-"
  "153|étape 1 (B)|non|main|4|-"
  "155|étape 1 (B)|non|main|5|-"
  "197|étape 2 (B), remplace #161 fermée|oui (OK, CI verte, 17/11 selon O)|main|6|-"
  "162|étape 2 (B)|non|main|7|-"
  "180|étape 2 (B)|bloquant levé, delta 5585c4f relu (12:43), CI en attente|main|8|#197, #162"
  "183|étape 2 (B)|changements demandés (12:36), poussée en f1a1a1c, à relire|main|9|#180"
  "154|étape 2 (B)|oui avec remarques (12:39), commit a655f91 dans #193|main|10|-"
  "193|étape 2 (B)|oui avec remarques sur f2cc377 (l. 882), à relire après rebasage|main|11 (écart B : down_revision)|#154, #183"
  "186|étape 2 (B)|oui (OK selon O le 17/11), migration à rechaîner derrière #197|main|12|#193"
  "165|étape 2 (B)|changements demandés (réglage absent du compose) ; q. 5 du PO|main|13|#186, accord PO (q. 5)"
  "192|étape 2 (B)|non|main|14|#165"
  "209|étape 3 (F)|non|main, via #180|15|#180"
  "194|étape 3 (F)|non|main, via #183|16|#183"
  "205|étape 3 (F)|non|main, via #165|17|#165"
  "152|étape 4 (B)|non|main|18|-"
  "181|étape 4 (F)|oui (l. 608) ; défaut du menu contextuel (l. 877)|main, via #152|19|#152"
  "184|étape 4 (F)|non validée tant que la nightly est rouge (l. 880)|main, via #181|20|#181, #179"
  "211|étape 4 (F)|non|main, via #184|21|#184"
  "182|étape 4 (Q)|non validée, nightly rouge (l. 876-880)|main|22|#211"
  "190|étape 4 (F)|non|main, via #181|23|#181, #153"
  "196|étape 5, après le PO du 23 (B)|non|main|24 (écart E)|accord PO"
  "203|étape 5, après le PO du 23 (B)|oui avec remarques (l. 870)|main|25 (écart E)|#196, accord PO"
  "213|étape 5, après le PO (B), correctif de sécurité #202|non|main, via #203|25 bis|#203, accord PO"
  "171|étape 5, après le PO du 23 (B)|oui avec remarques (l. 894)|main|26|accord PO"
  "199|étape 5, après le PO du 23 (F)|non|main, via #181|27|#182, #171, accord PO"
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
