#!/usr/bin/env bash
# Le journal d'accès de nginx n'écrit aucun secret d'URL (#525) :
#   - le jeton d'un lien « Ouvrir » : /api/v1/documents/stream/<jeton> ;
#   - la query string, dont le jeton du WebSocket : /api/v1/notifications/ws?token=<jeton>.
# Lance nginx:alpine avec chacune des deux configurations (nginx.conf en 80,
# nginx-tls.conf en 443), envoie ces requêtes, puis lit `docker logs`.
# Les amonts api et frontend sont remplacés par deux petits serveurs locaux qui
# répondent 200 sans journaliser : seules les lignes du serveur testé sont lues.
set -euo pipefail
# Git Bash : chemins de conteneur et -subj intacts. Les sorties de curl passent
# par une redirection du shell, jamais par « -o /dev/null » (curl Windows natif).
export MSYS_NO_PATHCONV=1
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
IMAGE="${NGINX_TEST_IMAGE:-nginx:alpine}"
NAME="ged-nginx-logtest-$$"
MARQUEUR="marqueur-a-ne-jamais-journaliser"
# Dossier relatif au dépôt : docker cp le lit tel quel sous Git Bash comme sous Linux.
WORK="$(mktemp -d ./.nginx-logtest.XXXXXX)"
WORK="${WORK#./}"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "${WORK:?}"; }
trap cleanup EXIT
fail() { echo "TEST EN ÉCHEC : $1" >&2; [ -f "$WORK/log" ] && sed 's/^/  | /' "$WORK/log" >&2; exit 1; }

cat >"$WORK/stub.conf" <<'EOF'
server { listen 8000; access_log off; return 200 "api"; }
server { listen 5173; access_log off; return 200 "front"; }
EOF
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=localhost" \
  -keyout "$WORK/tls.key" -out "$WORK/tls.crt" >/dev/null 2>&1

check() { # <fichier de conf> <port> <schéma>
  local conf="$1" port="$2" scheme="$3" etc="${WORK:?}/etc-$2"
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker create --name "$NAME" --memory 64m --cpus 0.5 \
    --log-driver json-file --log-opt max-size=1m \
    --add-host api:127.0.0.1 --add-host frontend:127.0.0.1 \
    -p "127.0.0.1::$port" "$IMAGE" >/dev/null
  # Arborescence /etc/nginx telle que la montent les fichiers compose, copiée
  # d'un bloc avant le démarrage (« dossier/. » crée les sous-dossiers).
  mkdir -p "$etc/conf.d" "$etc/snippets" "$etc/certs"
  cp "nginx/$conf" "$etc/conf.d/default.conf"
  cp "$WORK/stub.conf" "$etc/conf.d/stub.conf"
  cp nginx/app-locations.conf "$etc/snippets/app-locations.conf"
  cp "$WORK/tls.crt" "$WORK/tls.key" "$etc/certs/"
  docker cp "$etc/." "$NAME:/etc/nginx/"
  docker start "$NAME" >/dev/null
  local host_port="" i
  for i in $(seq 1 30); do
    host_port="$(docker port "$NAME" "$port/tcp" 2>/dev/null | head -1 | sed 's/.*://')"
    [ -n "$host_port" ] && curl -ksf "$scheme://127.0.0.1:$host_port/health" >/dev/null && break
    host_port=""
    sleep 0.5
  done
  [ -n "$host_port" ] || { docker logs "$NAME" >"$WORK/log" 2>&1; fail "$conf : nginx ne répond pas"; }
  local base="$scheme://127.0.0.1:$host_port"
  curl -ks "$base/api/v1/documents/stream/$MARQUEUR" >/dev/null
  curl -ks "$base/api/v1/documents/stream/$MARQUEUR?disposition=attachment" >/dev/null
  curl -ks "$base/api/v1/notifications/ws?token=$MARQUEUR" >/dev/null
  curl -ks -e "$base/api/v1/documents/stream/$MARQUEUR" "$base/health" >/dev/null
  curl -ks -e "$base/page?token=$MARQUEUR" "$base/health" >/dev/null
  sleep 0.5
  docker logs "$NAME" >"$WORK/log" 2>&1
  if grep -q "$MARQUEUR" "$WORK/log"; then fail "$conf : le jeton apparaît dans le journal"; fi
  grep -q '"GET /api/v1/documents/stream/\*\*\* HTTP/1.1" 200' "$WORK/log" \
    || fail "$conf : ligne d'accès du lien « Ouvrir » absente ou non masquée"
  grep -q '"GET /api/v1/notifications/ws HTTP/1.1" 200' "$WORK/log" \
    || fail "$conf : ligne d'accès du WebSocket absente ou avec sa query"
  grep -q "\"$base/api/v1/documents/stream/\*\*\*\"" "$WORK/log" \
    || fail "$conf : referer d'un lien « Ouvrir » non masqué"
  grep -q "\"$base/page\"" "$WORK/log" || fail "$conf : referer sans query absent"
  echo "OK $conf : jeton absent du journal d'accès, lignes utiles conservées"
}

check nginx.conf 80 http
check nginx-tls.conf 443 https
