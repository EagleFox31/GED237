#!/bin/sh
# Passe W2 en mode hors ligne (compose.yml + compose.offline.yml), après un contrôle du volume
# en lecture seule.
#
# Usage : scripts/lab/w2/offline_up.sh           contrôle, puis démarre W2 et le relais
#         scripts/lab/w2/offline_up.sh --postes  idem, plus les postes C1 et C2 si la mémoire suffit
#         scripts/lab/w2/offline_up.sh --check   contrôle seulement, ne démarre rien
# Variables : LAB_W2_VOLUME (défaut ged-lab_w2-storage) ;
#             LAB_W2_BOOT_ISO : ISO hors volume (compose.iso.yml), montée si le fichier existe ;
#             LAB_W2_LISTING : fichier listant le contenu du volume, qui remplace sa lecture (tests) ;
#             LAB_MEM_AVAILABLE_MB : mémoire disponible imposée, qui remplace sa mesure (tests).
# Codes de sortie : 0 = prêt (et démarré), 3 = refus (volume pas prêt pour le hors-ligne),
#                   1 = erreur docker, 2 = usage.
#
# Pourquoi : l'image dockurr/windows ne considère une installation comme terminée qu'après avoir
# écrit le marqueur windows.boot. Elle l'écrit à l'arrêt propre du conteneur, et seulement si le
# média source (custom.iso) est encore dans le volume. Sans ce marqueur, le démarrage suivant
# efface data.img et relance l'installation. Hors ligne, le téléchargement échoue : arrêt en
# code 68 et Windows perdu (19/11, LESSON-2026-082).
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
VOLUME="${LAB_W2_VOLUME:-ged-lab_w2-storage}"

refuse() { echo "REFUS : $1" >&2; exit 3; }

mode="up"; postes=""
for arg in "$@"; do
  case "$arg" in
    --check) mode="--check" ;;
    --postes) postes="y" ;;
    *) echo "usage : $0 [--check] [--postes]" >&2; exit 2 ;;
  esac
done

if [ -n "${LAB_W2_LISTING:-}" ]; then
  listing=$(cat "$LAB_W2_LISTING")
else
  docker volume inspect "$VOLUME" >/dev/null 2>&1 \
    || refuse "volume $VOLUME absent : W2 n'a jamais été installé. Installer d'abord en ligne (compose.yml seul)."
  listing=$(MSYS_NO_PATHCONV=1 docker run --rm --network none --memory 32m --log-opt max-size=1m \
    -v "$VOLUME:/storage:ro" alpine:3.20 ls -1 /storage) \
    || { echo "ECHEC : lecture du volume $VOLUME impossible" >&2; exit 1; }
fi
has() { printf '%s\n' "$listing" | grep -Eqx "$1"; }

has 'data\.[A-Za-z0-9]+' \
  || refuse "aucun disque data.* dans $VOLUME : Windows n'est pas installé. Installer d'abord en ligne (compose.yml seul)."

if ! has 'windows\.boot'; then
  has 'custom\.iso' \
    && refuse "installation non validée par l'image (windows.boot absent). Arrêter W2 proprement en ligne (docker compose -f compose.yml --profile w2 down) avec custom.iso en place, puis relancer ce script."
  refuse "custom.iso et windows.boot absents : au prochain démarrage, l'image effacera data.* et réinstallera. Remettre l'ISO d'origine en custom.iso dans le volume avant tout démarrage, ou réinstaller en ligne."
fi

echo "OK : $VOLUME prêt pour le hors-ligne (disque installé, windows.boot présent)."

# Postes C1 et C2 (profil postes) : 2,4 Go de plus. Refus si la mémoire disponible de la VM
# Docker ne garde pas la réserve commune de 2 Go une fois ces plafonds pris.
profiles="--profile w2"
if [ -n "$postes" ]; then
  need_mb="${LAB_POSTES_NEED_MB:-2400}"; reserve_mb="${LAB_MEM_RESERVE_MB:-2048}"
  if [ -n "${LAB_MEM_AVAILABLE_MB:-}" ]; then
    avail_mb="$LAB_MEM_AVAILABLE_MB"
  else
    avail_mb=$(MSYS_NO_PATHCONV=1 docker run --rm --network none --memory 32m --log-opt max-size=1m \
      alpine:3.20 free -m | awk 'NR==2 {print $7}') \
      || { echo "ECHEC : lecture de la mémoire de la VM Docker impossible" >&2; exit 1; }
  fi
  [ "$avail_mb" -ge $(( need_mb + reserve_mb )) ] \
    || refuse "mémoire disponible ${avail_mb} Mo < ${need_mb} Mo (C1 + C2) + ${reserve_mb} Mo de réserve. Démarrer sans --postes, ou attendre qu'une charge se termine."
  echo "OK : ${avail_mb} Mo disponibles pour C1 et C2."
  profiles="$profiles --profile postes"
fi
[ "$mode" = "--check" ] && exit 0

cd "$HERE"
# ISO hors volume (compose.iso.yml) : la garder montée si elle est encore là. Une fois
# windows.boot écrit, l'image accepte son absence et garde l'installation.
iso_overlay=""
if [ -n "${LAB_W2_BOOT_ISO:-}" ]; then
  if [ -s "$LAB_W2_BOOT_ISO" ]; then
    iso_overlay="-f compose.iso.yml"
  else
    echo "Note : $LAB_W2_BOOT_ISO introuvable, démarrage sans ISO (installation déjà validée)."
  fi
fi
# shellcheck disable=SC2086 # iso_overlay et profiles : découpage en mots voulu
MSYS_NO_PATHCONV=1 docker compose -f compose.yml $iso_overlay -f compose.offline.yml $profiles up -d \
  || { echo "ECHEC : démarrage hors ligne" >&2; exit 1; }
echo "Vérifier l'état avant d'annoncer quoi que ce soit : docker ps -a --filter name=ged-lab-"
