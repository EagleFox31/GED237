#!/usr/bin/env bash
# Sauvegarde GED237 : dump PostgreSQL compressé + archive du stockage local, horodatés.
#
# Usage :
#   ops/backup.sh                                   # pile compose du dossier courant
#   PG_CONTAINER=<nom> STORAGE_VOLUME=<vol> ops/backup.sh   # cible désignée
#
# Variables (voir .env.example) : BACKUP_DIR (./backups), BACKUP_RETENTION (0 = tout garder),
# BACKUP_STOP_SERVICES (1), BACKUP_HELPER_IMAGE / _MEMORY / _CPUS.
#
# Produit $BACKUP_DIR/ged237-<UTC>/ : db.dump (pg_dump -Fc), storage.tar.gz (archive
# reproductible), SHA256SUMS, MANIFEST.txt (comptages servant de preuve à la restauration).
# Aucun secret : ni dans les journaux, ni dans les noms, ni dans le manifeste.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=ops/lib/common.sh
. "$ROOT_DIR/ops/lib/common.sh"
cd "$ROOT_DIR"
load_env
resolve_target

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETENTION="${BACKUP_RETENTION:-0}"
case "$RETENTION" in '' | *[!0-9]*) die "BACKUP_RETENTION doit être un entier (0 = tout garder)" ;; esac

DEST="$BACKUP_DIR/ged237-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$DEST"
started=$SECONDS
log "cible : conteneur=$PG base=$PG_DB volume=$VOLUME"
log "destination : $DEST"

stop_services

t0=$SECONDS
docker exec "$PG" pg_dump -U "$PG_USER" -d "$PG_DB" -Fc -Z 6 >"$DEST/db.dump"
dump_s=$((SECONDS - t0))
log "base : db.dump $(human_size "$DEST/db.dump") en ${dump_s} s"

alembic="$(alembic_version)"
tenants="$(count_table tenants)"
users="$(count_table users)"
documents="$(count_table documents)"

t0=$SECONDS
files="$(
  helper -v "$VOLUME":/src:ro -v "$(host_path "$DEST")":/dest "$HELPER_IMAGE" sh -ec '
    tar -C /src --sort=name --mtime="2000-01-01 00:00:00Z" --owner=0 --group=0 --numeric-owner -cf - . | gzip -n >/dest/storage.tar.gz
    cd /dest && sha256sum db.dump storage.tar.gz >SHA256SUMS
    chown -R "$OWNER" /dest 2>/dev/null || true
    find /src -type f | wc -l'
)"
files="$(printf '%s' "$files" | tr -d '[:space:]')"
tar_s=$((SECONDS - t0))
log "stockage : storage.tar.gz $(human_size "$DEST/storage.tar.gz"), $files fichier(s) en ${tar_s} s"

restart_services

# Pas d'horodatage ici : le dossier le porte déjà et un état inchangé donne un manifeste identique.
cat >"$DEST/MANIFEST.txt" <<EOF
format=1
database=$PG_DB
alembic_version=$alembic
tenants=$tenants
users=$users
documents=$documents
storage_files=$files
storage_volume=$VOLUME
compose_project=$PROJECT
EOF

if [ "$RETENTION" -gt 0 ]; then
  mapfile -t old < <(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'ged237-*' | sort | head -n -"$RETENTION")
  for d in "${old[@]}"; do
    log "rétention ($RETENTION) : suppression de $(basename "$d")"
    rm -rf "$d"
  done
fi

total_s=$((SECONDS - started))
log "terminé en ${total_s} s (dump ${dump_s} s, stockage ${tar_s} s) : tenants=$tenants users=$users documents=$documents fichiers=$files alembic=$alembic"
printf '%s\n' "$DEST"
