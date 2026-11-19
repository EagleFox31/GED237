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
# L'id dépend du magasin d'images : digest de l'index avec le magasin containerd (Docker
# Desktop, Engine 29), digest de la config avec overlay2 (Engine ≤ 28). Quand l'id diffère,
# l'image est aussi acceptée si son id est le digest de config que l'archive vérifiée
# (manifest.json de docker save) donne pour ce tag.
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

# Lignes « "Config":"…","RepoTags":[…] » du manifest.json de l'archive, lues une seule fois.
CONFIGS=""
read_configs() {
  [ -z "$CONFIGS" ] || return 0
  CONFIGS="$(gzip -dc "$SRC/images.tar.gz" | tar -xOf - manifest.json | tr -d '\r\n' |
    grep -oE '"Config":"[^"]*","RepoTags":\[[^]]*\]' || true)"
}

# Digest de config de l'image $1 dans l'archive (vide si inconnu).
archive_config() {
  local ref="$1" line cfg
  case "${ref##*/}" in *:*) ;; *) ref="$ref:latest" ;; esac
  while IFS= read -r line; do
    case "$line" in *"\"$ref\""*) ;; *) continue ;; esac
    cfg="${line#\"Config\":\"}"
    cfg="${cfg%%\"*}"
    cfg="${cfg##*/}"
    printf 'sha256:%s' "${cfg%.json}"
    return 0
  done <<<"$CONFIGS"
}

# Affiche les images absentes de l'hôte, ou dont l'id n'est ni celui de IMAGES.txt ni le
# digest de config de l'archive.
pending() {
  local img id cur cfg
  while read -r img id; do
    [ -n "$img" ] || continue
    cur="$(docker image inspect -f '{{.Id}}' "$img" 2>/dev/null || true)"
    [ -n "$cur" ] && [ "$cur" = "$id" ] && continue
    cfg="$(archive_config "$img")"
    [ -n "$cur" ] && [ -n "$cfg" ] && [ "$cur" = "$cfg" ] && continue
    printf '%s\n' "$img"
  done <"$SRC/IMAGES.txt"
}

todo="$(pending)"
if [ -n "$todo" ]; then
  read_configs
  todo="$(pending)"
fi
total="$(grep -c . "$SRC/IMAGES.txt")"
if [ -z "$todo" ]; then
  log "les $total image(s) sont déjà présentes avec l'id attendu : rien à charger"
  exit 0
fi
log "à charger : $(printf '%s' "$todo" | tr '\n' ' ')"

t0=$SECONDS
gzip -dc "$SRC/images.tar.gz" | docker load >&2 ||
  die "docker load a échoué (voir le message ci-dessus) : vérifier l'espace disque et que Docker tourne, puis relancer"

todo="$(pending)"
[ -z "$todo" ] || die "après docker load, id différent ou image absente : $(printf '%s' "$todo" | tr '\n' ' ')"
log "$total image(s) présentes avec l'id attendu ($((SECONDS - t0)) s)"
