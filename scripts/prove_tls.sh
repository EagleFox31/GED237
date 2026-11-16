#!/bin/sh
# Preuve de poignée de main TLS pour le profil "tls" (voir DOCS/exploitation/https-local.md).
# À lancer sur le poste de démo, pile démarrée, mémoire libre >= 5 Go.
# Variables : TLS_PORT (8443), TLS_CERT_DIR (./certs), TLS_HOST (localhost).
# Code de sortie : 0 = preuve OK, 1 = échec.
set -eu
PORT="${TLS_PORT:-8443}"
DIR="${TLS_CERT_DIR:-./certs}"
HOST="${TLS_HOST:-localhost}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.tls.yml --profile tls"

fail() { echo "ECHEC: $1" >&2; exit 1; }

command -v mkcert >/dev/null || fail "mkcert introuvable"
command -v curl >/dev/null || fail "curl introuvable"
CA="$(mkcert -CAROOT)/rootCA.pem"
[ -f "$CA" ] || fail "autorité mkcert absente : lancer 'mkcert -install'"

if [ ! -f "$DIR/tls.crt" ] || [ ! -f "$DIR/tls.key" ]; then
  mkdir -p "$DIR"
  mkcert -cert-file "$DIR/tls.crt" -key-file "$DIR/tls.key" localhost 127.0.0.1
fi

TLS_CERT_DIR="$DIR" $COMPOSE up -d nginx-tls >/dev/null

# attendre que l'API réponde derrière le proxy (60 s max)
i=0
while [ "$i" -lt 30 ]; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 --cacert "$CA" "https://$HOST:$PORT/health" || true)"
  [ "$code" = "200" ] && break
  i=$((i + 1)); sleep 2
done
[ "$code" = "200" ] || fail "/health en HTTPS : code '$code' (attendu 200)"

proto="$(curl -s -o /dev/null -w '%{ssl_verify_result} %{http_version}' --cacert "$CA" "https://$HOST:$PORT/health")"
[ "${proto%% *}" = "0" ] || fail "certificat non vérifié (ssl_verify_result=${proto%% *})"

# sans l'autorité, la vérification doit échouer : prouve que le test n'est pas un faux positif
if curl -s -o /dev/null --max-time 5 --cacert /dev/null "https://$HOST:$PORT/health" 2>/dev/null; then
  fail "la connexion aboutit sans autorité de confiance : le test n'est pas probant"
fi

# non-régression : le HTTP 8080 répond toujours
http="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://$HOST:${APP_PORT:-8080}/health" || true)"
[ "$http" = "200" ] || fail "HTTP ${APP_PORT:-8080} /health : code '$http' (attendu 200)"

echo "OK: HTTPS $HOST:$PORT (certificat vérifié, HTTP/${proto#* }), HTTP ${APP_PORT:-8080} inchangé"
