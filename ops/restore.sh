#!/usr/bin/env bash
# Restauration GED237 depuis un dossier produit par ops/backup.sh.
#
# Usage :
#   ops/restore.sh <dossier-sauvegarde> [--wipe] [--yes]
#   PG_CONTAINER=<nom> STORAGE_VOLUME=<vol> ops/restore.sh <dossier>   # cible désignée
#
# Sans --wipe, la cible (base + volume) doit être vide : on ne restaure jamais par accident
# sur la pile en cours. --wipe recrée la base (DROP … WITH (FORCE)) et vide le volume
# après confirmation interactive, ou sans question avec --yes.
#
# Codes de sortie : 0 ok ; 1 erreur d'usage ou d'exécution ; 2 comptages différents du
# manifeste ; 3 cible non vide sans --wipe.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=ops/lib/common.sh
. "$ROOT_DIR/ops/lib/common.sh"

usage() { sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2; exit 1; }

SRC="" WIPE=0 YES=0
for arg in "$@"; do
  case "$arg" in
    --wipe) WIPE=1 ;;
    --yes) YES=1 ;;
    -h | --help) usage ;;
    -*) die "option inconnue : $arg" ;;
    *) [ -z "$SRC" ] || die "un seul dossier attendu"; SRC="$arg" ;;
  esac
done
[ -n "$SRC" ] || usage
[ -d "$SRC" ] || die "dossier introuvable : $SRC"
for f in MANIFEST.txt SHA256SUMS db.dump storage.tar.gz; do
  [ -f "$SRC/$f" ] || die "fichier manquant dans la sauvegarde : $f"
done
SRC_HOST="$(host_path "$SRC")"
manifest() { sed -n "s/^$1=//p" "$SRC/MANIFEST.txt" | head -n1; }
[ "$(manifest format)" = 1 ] || die "format de manifeste non pris en charge : $(manifest format)"

cd "$ROOT_DIR"
load_env
resolve_target
started=$SECONDS
log "source : $SRC (base $(manifest database), alembic $(manifest alembic_version))"
log "cible  : conteneur=$PG base=$PG_DB volume=$VOLUME"

log "vérification des empreintes"
helper -v "$SRC_HOST":/backup:ro "$HELPER_IMAGE" sh -ec 'cd /backup && sha256sum -c --quiet SHA256SUMS' \
  || die "empreintes SHA-256 invalides : sauvegarde altérée ou incomplète"

stop_services

tables="$(pg_sql "SELECT count(*) FROM pg_tables WHERE schemaname='public'")"
vol_entries="$(helper -v "$VOLUME":/dst:ro "$HELPER_IMAGE" sh -c 'find /dst -mindepth 1 -print -quit | wc -l' | tr -d '[:space:]')"
if [ "$tables" != 0 ] || [ "$vol_entries" != 0 ]; then
  if [ "$WIPE" != 1 ]; then
    die "cible non vide (tables publiques : $tables, volume non vide : $vol_entries). Relancer avec --wipe pour écraser, ou désigner une cible vierge (PG_CONTAINER / STORAGE_VOLUME)." 3
  fi
  if [ "$YES" != 1 ]; then
    printf 'Écraser la base %s du conteneur %s et le volume %s ? Tapez oui : ' "$PG_DB" "$PG" "$VOLUME" >&2
    read -r answer
    [ "$answer" = oui ] || die "abandon demandé"
  fi
  log "écrasement : base $PG_DB recréée, volume $VOLUME vidé"
  pg_sql "DROP DATABASE IF EXISTS \"$PG_DB\" WITH (FORCE)" postgres
  pg_sql "CREATE DATABASE \"$PG_DB\" OWNER \"$PG_USER\"" postgres
  helper -v "$VOLUME":/dst "$HELPER_IMAGE" sh -ec 'find /dst -mindepth 1 -delete'
fi

t0=$SECONDS
docker exec -i "$PG" pg_restore -U "$PG_USER" -d "$PG_DB" --no-owner --no-privileges --exit-on-error <"$SRC/db.dump"
restore_s=$((SECONDS - t0))
log "base restaurée en ${restore_s} s"

t0=$SECONDS
files="$(
  helper -v "$SRC_HOST":/backup:ro -v "$VOLUME":/dst "$HELPER_IMAGE" sh -ec '
    tar -xzf /backup/storage.tar.gz -C /dst
    find /dst -type f | wc -l' | tr -d '[:space:]'
)"
extract_s=$((SECONDS - t0))
log "stockage restauré : $files fichier(s) en ${extract_s} s"

restart_services

status=0
check() { # check <clé> <attendu> <obtenu>
  if [ "$2" = "$3" ]; then
    log "  $1 : $3 = manifeste"
  else
    log "  $1 : $3 ≠ manifeste $2"
    status=2
  fi
}
log "comparaison avec le manifeste"
check alembic_version "$(manifest alembic_version)" "$(alembic_version)"
check tenants "$(manifest tenants)" "$(count_table tenants)"
check users "$(manifest users)" "$(count_table users)"
check documents "$(manifest documents)" "$(count_table documents)"
check storage_files "$(manifest storage_files)" "$files"

total_s=$((SECONDS - started))
if [ "$status" = 0 ]; then
  log "terminé en ${total_s} s (base ${restore_s} s, stockage ${extract_s} s) : comptages identiques"
else
  log "terminé en ${total_s} s avec des ÉCARTS de comptage"
fi
exit "$status"
