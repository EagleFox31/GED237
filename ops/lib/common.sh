# shellcheck shell=bash
# Fonctions partagées par ops/backup.sh et ops/restore.sh (fichier sourcé, pas exécuté).
#
# Cible = un conteneur PostgreSQL + un volume Docker de stockage, découverts depuis la
# pile compose courante (`docker compose ps -q postgres`, volume `<projet>_storage_data`)
# ou désignés explicitement par PG_CONTAINER et STORAGE_VOLUME. Le mot de passe n'est
# jamais lu : pg_dump/psql s'exécutent dans le conteneur, sur la socket locale.

export MSYS_NO_PATHCONV=1 # Git Bash : ne pas réécrire /src, /dest… en chemins Windows

HELPER_IMAGE="${BACKUP_HELPER_IMAGE:-python:3.12-slim}" # GNU tar + gzip + sha256sum
HELPER_MEMORY="${BACKUP_HELPER_MEMORY:-256m}"
HELPER_CPUS="${BACKUP_HELPER_CPUS:-1}"

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" >&2; }
die() { log "ERREUR : $1"; exit "${2:-1}"; }

# Variables compose du .env racine (COMPOSE_PROJECT_NAME, BACKUP_*…). Jamais affichées.
load_env() {
  if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$ROOT_DIR/.env"
    set +a
  fi
}

# Chemin hôte acceptable par Docker Desktop (Windows) ou tel quel (Linux/macOS).
host_path() {
  local abs
  abs="$(cd "$1" && pwd)"
  if command -v cygpath >/dev/null 2>&1; then cygpath -w "$abs"; else printf '%s' "$abs"; fi
}

container_env() { # container_env <conteneur> <VARIABLE>
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$1" | sed -n "s/^$2=//p" | head -n1
}

# Renseigne PG, PG_USER, PG_DB, PROJECT, VOLUME, COMPOSE_MODE.
resolve_target() {
  COMPOSE_MODE=0
  if [ -n "${PG_CONTAINER:-}" ]; then
    PG="$PG_CONTAINER"
  else
    PG="$(docker compose ps -q postgres 2>/dev/null || true)"
    [ -n "$PG" ] || die "aucun conteneur postgres dans la pile courante : 'docker compose up -d postgres' ou définir PG_CONTAINER (et STORAGE_VOLUME)"
    COMPOSE_MODE=1
  fi
  docker inspect "$PG" >/dev/null 2>&1 || die "conteneur introuvable : $PG"
  PROJECT="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$PG")"
  PG_USER="$(container_env "$PG" POSTGRES_USER)"
  : "${PG_USER:=postgres}"
  PG_DB="$(container_env "$PG" POSTGRES_DB)"
  : "${PG_DB:=$PG_USER}"
  if [ -n "${STORAGE_VOLUME:-}" ]; then
    VOLUME="$STORAGE_VOLUME"
  else
    [ -n "$PROJECT" ] || die "STORAGE_VOLUME requis quand PG_CONTAINER n'appartient pas à une pile compose"
    VOLUME="${PROJECT}_storage_data"
  fi
  docker volume inspect "$VOLUME" >/dev/null 2>&1 || die "volume introuvable : $VOLUME"
}

pg_sql() { # pg_sql "<requête>" [base]
  docker exec -i "$PG" psql -U "$PG_USER" -d "${2:-$PG_DB}" -v ON_ERROR_STOP=1 -qAt -c "$1"
}

count_table() { pg_sql "SELECT count(*) FROM $1" 2>/dev/null || printf -- '-'; }
alembic_version() { pg_sql "SELECT version_num FROM alembic_version" 2>/dev/null || printf -- '-'; }

# Conteneur utilitaire plafonné, sans réseau, supprimé à la fin.
helper() {
  docker run --rm --network none \
    --memory "$HELPER_MEMORY" --memory-swap "$HELPER_MEMORY" --cpus "$HELPER_CPUS" \
    --log-opt max-size=10m --log-opt max-file=2 \
    -e OWNER="$(id -u):$(id -g)" "$@"
}

# api et worker arrêtés pendant l'opération (cohérence base/stockage) ; seuls ceux qui
# tournaient sont redémarrés. Hors compose, la cible est supposée inactive.
STOPPED_SERVICES=""
stop_services() {
  [ "$COMPOSE_MODE" = 1 ] || return 0
  [ "${BACKUP_STOP_SERVICES:-1}" = 1 ] || return 0
  local running
  running="$(docker compose ps --status running --services 2>/dev/null | grep -Ex 'api|worker' || true)"
  [ -n "$running" ] || return 0
  STOPPED_SERVICES="$(printf '%s' "$running" | tr '\n' ' ')"
  log "arrêt des services : $STOPPED_SERVICES"
  # shellcheck disable=SC2086
  docker compose stop $STOPPED_SERVICES >/dev/null
  trap restart_services EXIT
}
# Rend la main seulement quand les services relancés sont sains (l'api rejoue
# `upgrade head` et les seeds au démarrage : un /health immédiat répond « connection
# refused »). `--no-recreate` garde les conteneurs existants ; l'attente est bornée.
restart_services() {
  if [ -n "$STOPPED_SERVICES" ]; then
    log "redémarrage des services : $STOPPED_SERVICES"
    # shellcheck disable=SC2086
    if ! docker compose up -d --no-recreate --wait         --wait-timeout "${BACKUP_WAIT_TIMEOUT:-180}" $STOPPED_SERVICES >/dev/null; then
      log "services non sains après ${BACKUP_WAIT_TIMEOUT:-180} s : $STOPPED_SERVICES (voir docker compose ps)"
      STOPPED_SERVICES=""
      return 1
    fi
    STOPPED_SERVICES=""
  fi
  return 0
}

human_size() { du -h "$1" | cut -f1; }
