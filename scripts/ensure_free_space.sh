#!/usr/bin/env bash
# Garde d'espace disque : refuse de lancer une charge lourde (build d'image, tests en conteneurs,
# campagne e2e) quand le disque qui l'héberge est presque plein.
# Lecture seule : ne supprime rien, ne lance aucun nettoyage.
#
# Usage : scripts/ensure_free_space.sh [chemin ...]
#   chemin   dossier dont on vérifie le disque (défaut : le dossier courant) ;
#            plusieurs chemins = plusieurs disques, chacun doit passer.
#
# Une ligne « OK » ou « KO » par chemin, avec l'espace libre en Go.
# Codes de sortie : 0 tous les disques ont assez de place ; 1 au moins un KO ; 2 usage.
#
# Réglages (variables d'environnement) :
#   MIN_FREE_GB   espace libre exigé, en Go entiers (défaut : 20)
set -euo pipefail

MIN_FREE_GB="${MIN_FREE_GB:-20}"
case "$MIN_FREE_GB" in
  '' | *[!0-9]*) echo "MIN_FREE_GB doit être un entier de Go (reçu : '$MIN_FREE_GB')" >&2; exit 2 ;;
esac

case "${1:-}" in
  -h | --help) sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2; exit 2 ;;
esac

[ "$#" -gt 0 ] || set -- .
status=0
for path in "$@"; do
  if [ ! -d "$path" ]; then
    echo "KO  $path : dossier introuvable" >&2
    status=1
    continue
  fi
  # POSIX df (-P) : une ligne par disque, colonne 4 = Ko disponibles.
  avail_kb="$(df -Pk "$path" | awk 'NR==2 {print $4}')"
  case "$avail_kb" in
    '' | *[!0-9]*) echo "KO  $path : lecture de l'espace libre impossible" >&2; status=1; continue ;;
  esac
  free_gb=$((avail_kb / 1024 / 1024))
  if [ "$free_gb" -ge "$MIN_FREE_GB" ]; then
    echo "OK  $path : ${free_gb} Go libres (seuil ${MIN_FREE_GB} Go)"
  else
    echo "KO  $path : ${free_gb} Go libres, seuil ${MIN_FREE_GB} Go" >&2
    status=1
  fi
done
exit "$status"
