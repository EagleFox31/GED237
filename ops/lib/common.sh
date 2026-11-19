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

# L'image utilitaire doit être présente avant toute écriture : sans réseau, `docker run`
# ne peut pas la télécharger, et l'opération s'arrêterait à mi-chemin (dossier de
# sauvegarde sans MANIFEST, ou cible déjà vidée). En ligne, elle est téléchargée ici.
require_helper_image() {
  docker image inspect "$HELPER_IMAGE" >/dev/null 2>&1 && return 0
  log "image utilitaire absente : $HELPER_IMAGE, téléchargement"
  docker pull -q "$HELPER_IMAGE" >/dev/null 2>&1 ||
    die "image utilitaire $HELPER_IMAGE absente et impossible à télécharger (hors ligne ?). Rien n'a été modifié. Mettre dans .env BACKUP_HELPER_IMAGE=${PROJECT:-<projet>}-api (image de la pile, qui a tar, gzip et sha256sum), puis relancer."
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
    case " $STOPPED_SERVICES " in
      *" api "*) STOPPED_SERVICES=""; restart_proxies || return 1 ;;
    esac
    STOPPED_SERVICES=""
  fi
  return 0
}

# api relancé change souvent d'adresse IP ; nginx garde celle lue à son démarrage et
# répond 502. On relance donc les proxys qui tournent, puis on vérifie /health à travers
# chacun d'eux, depuis son conteneur (ports et certificats de l'hôte sans importance).
PROXY_SERVICES="${BACKUP_PROXY_SERVICES:-nginx nginx-tls}"
# Vérifié avant toute écriture : 0 ou une valeur non entière ne ferait aucun essai.
require_health_tries() {
  local v="${BACKUP_HEALTH_TRIES:-30}"
  case "$v" in
    *[!0-9]*) ;;
    *[1-9]*) return 0 ;;
  esac
  die "BACKUP_HEALTH_TRIES=$v : nombre entier d'essais de /health attendu, au moins 1 (30 par défaut). Rien n'a été modifié."
}
restart_proxies() {
  local running proxies="" svc url i tries="${BACKUP_HEALTH_TRIES:-30}"
  running="$(docker compose ps --status running --services 2>/dev/null || true)"
  for svc in $PROXY_SERVICES; do
    printf '%s\n' "$running" | grep -qx -- "$svc" && proxies="$proxies $svc"
  done
  [ -n "$proxies" ] || return 0
  log "relance du proxy :$proxies"
  # shellcheck disable=SC2086
  docker compose restart $proxies >/dev/null || { log "relance du proxy en échec :$proxies"; return 1; }
  for svc in $proxies; do
    url=http://127.0.0.1/health
    [ "$svc" = nginx-tls ] && url=https://127.0.0.1/health
    # Au moins un essai : « OK » n'est écrit qu'après une réponse réelle.
    i=1
    until docker compose exec -T "$svc" wget -q -O /dev/null --no-check-certificate "$url" >/dev/null 2>&1; do
      if [ "$i" -ge "$tries" ]; then
        log "/health ne répond pas à travers $svc : voir docker compose logs $svc api"
        return 1
      fi
      i=$((i + 1))
      sleep 1
    done
    log "/health OK à travers $svc"
  done
}

human_size() { du -h "$1" | cut -f1; }
