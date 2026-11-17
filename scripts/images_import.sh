#!/usr/bin/env bash
# Import des images Docker exportées par scripts/images_export.sh (clé USB, sans Internet).
#
# Usage :
#   scripts/images_import.sh [dossier]   # défaut : $IMAGES_DIR, sinon ./images-offline
#
# 1. Vérifie SHA256SUMS : une copie incomplète ou altérée est refusée avant tout chargement.
# 2. Compare chaque ligne « <image> <id> » de IMAGES.txt aux images de l'hôte.
# 3. Lance `docker load` seulement s'il manque une image ou si son id diffère ; sinon, rien
#    n'est chargé (idempotent). Après le chargement, chaque image doit avoir l'id attendu.
# Ensuite : `docker compose up -d` (sans --build) démarre la pile sur ces images.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=ops/lib/common.sh
. "$ROOT_DIR/ops/lib/common.sh"
cd "$ROOT_DIR"
load_env

SRC="${1:-${IMAGES_DIR:-$ROOT_DIR/images-offline}}"
for f in SHA256SUMS IMAGES.txt images.tar.gz; do
  [ -f "$SRC/$f" ] || die "$SRC/$f introuvable : dossier d'export incomplet (scripts/images_export.sh)"
done

(cd "$SRC" && sha256sum -c --quiet SHA256SUMS) ||
  die "sommes de contrôle invalides dans $SRC : copie incomplète ou altérée, refaire la copie depuis l'export"

# Affiche les images dont l'id sur l'hôte diffère de IMAGES.txt (absentes comprises).
pending() {
  local img id
  while read -r img id; do
    [ -n "$img" ] || continue
    [ "$(docker image inspect -f '{{.Id}}' "$img" 2>/dev/null || true)" = "$id" ] || printf '%s\n' "$img"
  done <"$SRC/IMAGES.txt"
}

todo="$(pending)"
total="$(grep -c . "$SRC/IMAGES.txt")"
if [ -z "$todo" ]; then
  log "les $total image(s) sont déjà présentes avec le même id : rien à charger"
  exit 0
fi
log "à charger : $(printf '%s' "$todo" | tr '\n' ' ')"

t0=$SECONDS
gzip -dc "$SRC/images.tar.gz" | docker load >&2

todo="$(pending)"
[ -z "$todo" ] || die "après docker load, id différent ou image absente : $(printf '%s' "$todo" | tr '\n' ' ')"
log "$total image(s) présentes avec l'id attendu ($((SECONDS - t0)) s)"
