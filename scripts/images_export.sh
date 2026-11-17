#!/usr/bin/env bash
# Export des images Docker de la pile, pour installer ou démarrer sans Internet (clé USB).
#
# Usage :
#   scripts/images_export.sh [arguments de docker compose…]
#   IMAGES_DIR=/media/usb/ged237-images scripts/images_export.sh \
#     -f docker-compose.yml -f docker-compose.tls.yml --profile tls
#
# La liste des images est lue par `docker compose <arguments> config --images` (rien n'est
# codé en dur). Les images doivent déjà être sur l'hôte : le script ne construit et ne
# télécharge rien (`docker compose build`, puis `docker compose pull --ignore-buildable`).
#
# Produit $IMAGES_DIR (./images-offline par défaut) : images.tar.gz (docker save),
# IMAGES.txt (une ligne « <image> <id> » par image, lue par images_import.sh) et SHA256SUMS.
# Idempotent : si IMAGES.txt décrit déjà les images de l'hôte et que les sommes sont bonnes,
# rien n'est réécrit. Seuls ces trois fichiers sont écrits dans le dossier.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=ops/lib/common.sh
. "$ROOT_DIR/ops/lib/common.sh"
cd "$ROOT_DIR"
load_env

DEST="${IMAGES_DIR:-$ROOT_DIR/images-offline}"

images=()
while IFS= read -r img; do
  [ -n "$img" ] && images+=("$img")
done < <(docker compose "$@" config --images | tr -d '\r' | sort -u)
[ "${#images[@]}" -gt 0 ] || die "aucune image dans la configuration compose (arguments : ${*:-aucun})"

manifest=""
missing=()
for img in "${images[@]}"; do
  if id="$(docker image inspect -f '{{.Id}}' "$img" 2>/dev/null)"; then
    manifest+="$img $id"$'\n'
  else
    missing+=("$img")
  fi
done
[ "${#missing[@]}" -eq 0 ] ||
  die "image(s) absente(s) de l'hôte : ${missing[*]}. Lancer 'docker compose $* build' puis 'docker compose $* pull --ignore-buildable', et relancer l'export."

if [ -f "$DEST/IMAGES.txt" ] && [ "$(cat "$DEST/IMAGES.txt")" = "${manifest%$'\n'}" ] &&
  (cd "$DEST" && sha256sum -c --quiet SHA256SUMS >/dev/null 2>&1); then
  log "déjà à jour : $DEST (${#images[@]} image(s)), rien à écrire"
  exit 0
fi

mkdir -p "$DEST"
partial=("$DEST/images.tar.gz.partial" "$DEST/IMAGES.txt.partial" "$DEST/SHA256SUMS.partial")
trap 'rm -f "${partial[@]}"' EXIT

log "export de ${#images[@]} image(s) vers $DEST"
t0=$SECONDS
docker save "${images[@]}" | gzip -n >"$DEST/images.tar.gz.partial"
printf '%s' "$manifest" >"$DEST/IMAGES.txt.partial"
mv -f "$DEST/images.tar.gz.partial" "$DEST/images.tar.gz"
mv -f "$DEST/IMAGES.txt.partial" "$DEST/IMAGES.txt"
# Sommes écrites en dernier : un export interrompu ne passe pas le contrôle de l'import.
(cd "$DEST" && sha256sum images.tar.gz IMAGES.txt >SHA256SUMS.partial && mv -f SHA256SUMS.partial SHA256SUMS)

log "images.tar.gz $(human_size "$DEST/images.tar.gz") en $((SECONDS - t0)) s"
cat "$DEST/IMAGES.txt" >&2
