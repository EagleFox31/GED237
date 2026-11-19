#!/usr/bin/env bash
# Pourquoi une pile compose s'est-elle arrêtée ? Lecture seule : aucune action sur les conteneurs.
#
# Usage : scripts/diag_stack_stop.sh <projet-compose>     (ex. edossier)
# Affiche, pour chaque conteneur du projet (label com.docker.compose.project), triés par heure
# d'arrêt : état, code de sortie, OOMKilled, StartedAt, FinishedAt (UTC) et politique de
# redémarrage. Puis une lecture des signes :
#   - OOMKilled=true            → tué par manque de mémoire (voir la limite du conteneur) ;
#   - code 137 sans OOM         → tué (SIGKILL), souvent après le délai d'arrêt de 10 s ;
#   - dernière vague d'arrêts (60 s) toute en code 0, sans OOM
#                               → arrêt volontaire (docker stop ou compose stop) : chercher QUI.
# Codes de sortie : 0 = rapport affiché, 1 = docker absent ou aucun conteneur, 2 = usage.
#
# Pour trouver qui a lancé un arrêt volontaire (docker events ne garde que les derniers
# événements) : chercher l'heure FinishedAt dans PASSATION*.md et dans les historiques des
# sessions, puis comparer avec les arrêts des AUTRES projets à la même minute.
set -euo pipefail

if [ $# -ne 1 ] || [ -z "$1" ]; then echo "usage : $0 <projet-compose>" >&2; exit 2; fi
PROJECT="$1"
command -v docker >/dev/null || { echo "ECHEC : docker introuvable" >&2; exit 1; }

ids="$(docker ps -aq --filter "label=com.docker.compose.project=$PROJECT")"
[ -n "$ids" ] || { echo "ECHEC : aucun conteneur pour le projet compose « $PROJECT »" >&2; exit 1; }

FMT='{{.Name}}|{{.State.Status}}|{{.State.ExitCode}}|{{.State.OOMKilled}}|{{.State.StartedAt}}|{{.State.FinishedAt}}|{{.HostConfig.RestartPolicy.Name}}'
# shellcheck disable=SC2086 # un id par mot, voulu
docker inspect --format "$FMT" $ids | sed 's|^/||' | sort -t'|' -k6,6 | awk -F'|' -v project="$PROJECT" '
  function hms(t) { return (t ~ /^0001-/) ? "-" : substr(t, 12, 8) }
  function day(t) { return (t ~ /^0001-/) ? "" : substr(t, 1, 10) }
  BEGIN {
    printf "%-28s %-10s %4s %-5s %-19s %-19s %s\n", "CONTENEUR", "ETAT", "CODE", "OOM", "DEMARRE (UTC)", "ARRETE (UTC)", "REDEMARRAGE"
  }
  {
    pol = ($7 == "") ? "no" : $7
    printf "%-28s %-10s %4s %-5s %-19s %-19s %s\n", $1, $2, $3, $4, day($5) " " hms($5), day($6) " " hms($6), pol
    n++
    if ($4 == "true") oom = oom " " $1
    else if ($3 == 137) killed = killed " " $1
    if ($6 !~ /^0001-/) {
      # Dernier arrêt connu, y compris pour un conteneur relancé depuis.
      m++; at[m] = substr($6, 1, 19); code[m] = $3; isoom[m] = $4
      if (last == "" || at[m] > last) last = at[m]
    }
  }
  END {
    print ""
    if (oom != "") print "Lecture : tué par manque de mémoire :" oom "."
    if (killed != "") print "Lecture : tué (code 137, sans OOM) :" killed " — délai d\047arrêt dépassé ou kill."
    if (m == 0) { print "Aucun arrêt enregistré pour ce projet."; exit }
    # Dernière vague : arrêts du même jour, à 60 s au plus du dernier. Les plus anciens
    # (tâches ponctuelles type migrate ou seed) ne faussent pas la lecture.
    for (i = 1; i <= m; i++) {
      if (substr(at[i], 1, 10) != substr(last, 1, 10) || secs(last) - secs(at[i]) > 60) { older++; continue }
      w++
      if (first == "" || at[i] < first) first = at[i]
      if (code[i] != 0 || isoom[i] == "true") bad++
    }
    printf "Dernière vague d\047arrêts du projet %s : %d conteneur(s), de %s à %s (UTC).\n", project, w, first, last
    if (older > 0) printf "(%d arrêt(s) plus ancien(s) hors vague, souvent des tâches ponctuelles.)\n", older
    if (bad == 0)
      print "Lecture : vague en code 0, sans OOM → arrêt volontaire (docker stop ou compose stop). Chercher qui, à cette minute, dans PASSATION*.md et les historiques des sessions."
  }
  function secs(t) { return substr(t, 12, 2) * 3600 + substr(t, 15, 2) * 60 + substr(t, 18, 2) }'
