#!/bin/sh
# Prérequis du lab multi-postes : rendre /dev/kvm visible des conteneurs Docker Desktop.
#
# Sous Docker Desktop (backend WSL2), le noyau WSL est partagé entre toutes les distributions.
# KVM y est compilé en module (CONFIG_KVM=m) mais n'est pas chargé au démarrage : les conteneurs
# ne voient alors pas /dev/kvm. Charger le module depuis une distribution WSL qui possède
# /lib/modules (Ubuntu, par ex.) le rend visible à Docker Desktop jusqu'au prochain `wsl --shutdown`.
#
# Usage : scripts/lab/kvm_prereq.sh [--check]
#   --check        lecture seule : dit si KVM est disponible, ne charge rien.
# Variables :
#   LAB_WSL_DISTRO distribution WSL qui charge le module (défaut : première distribution
#                  hors docker-desktop*).
#   LAB_PROBE_IMAGE image de sonde (défaut : alpine:3.20).
# Codes de sortie : 0 = KVM visible des conteneurs, 1 = indisponible, 2 = usage.
#
# Idempotent : si KVM est déjà visible, aucune action (sortie « déjà prêt »).
# Sous Git Bash, MSYS_NO_PATHCONV=1 est indispensable : sinon « /dev/kvm » est réécrit en « C ».
set -eu
export MSYS_NO_PATHCONV=1

MODE="apply"
case "${1:-}" in
  "") ;;
  --check) MODE="check" ;;
  *) echo "usage : $0 [--check]" >&2; exit 2 ;;
esac

IMAGE="${LAB_PROBE_IMAGE:-alpine:3.20}"

fail() { echo "ECHEC : $1" >&2; exit 1; }

command -v docker >/dev/null || fail "docker introuvable"

# Sonde non privilégiée : c'est exactement ce que fera le conteneur Windows.
kvm_visible() {
  docker run --rm --network none --memory 32m --device /dev/kvm "$IMAGE" \
    test -c /dev/kvm >/dev/null 2>&1
}

if kvm_visible; then
  echo "KVM : déjà prêt (/dev/kvm visible depuis un conteneur)."
  exit 0
fi

[ "$MODE" = "check" ] && fail "KVM non visible depuis les conteneurs (relancer sans --check pour charger le module)."

command -v wsl.exe >/dev/null || fail "wsl.exe introuvable : hôte non WSL, charger kvm à la main (modprobe kvm_intel|kvm_amd)."

# wsl.exe -l sort de l'UTF-16 : retirer les octets nuls et les retours chariot.
DISTRO="${LAB_WSL_DISTRO:-}"
if [ -z "$DISTRO" ]; then
  DISTRO="$(wsl.exe -l -q 2>/dev/null | tr -d '\0\r' | grep -v '^docker-desktop' | grep -v '^$' | head -n 1 || true)"
fi
[ -n "$DISTRO" ] || fail "aucune distribution WSL hors docker-desktop : en installer une (wsl --install -d Ubuntu) ou définir LAB_WSL_DISTRO."

echo "Chargement du module KVM via la distribution WSL « $DISTRO »..."
# Le fabricant du processeur choisit le module ; modprobe est sans effet s'il est déjà chargé.
# -e exécute sans passer par le shell de connexion de la distribution : avec « -- », la commande
# y serait réinterprétée et « $m » développé trop tôt (vide).
# shellcheck disable=SC2016 # développement voulu côté distribution, pas ici
wsl.exe -d "$DISTRO" -u root -e sh -c '
  if grep -q vmx /proc/cpuinfo; then m=kvm_intel
  elif grep -q svm /proc/cpuinfo; then m=kvm_amd
  else echo "virtualisation imbriquée absente (ni vmx ni svm)" >&2; exit 1; fi
  modprobe "$m"
' || fail "modprobe a échoué dans « $DISTRO » (virtualisation imbriquée activée ? .wslconfig nestedVirtualization)."

kvm_visible || fail "module chargé mais /dev/kvm toujours invisible depuis les conteneurs."
echo "KVM : prêt (module chargé, /dev/kvm visible depuis un conteneur)."
