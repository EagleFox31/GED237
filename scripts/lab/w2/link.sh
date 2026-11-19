#!/bin/sh
# Lien W2 → GED du lab : état voulu, appliqué sur les proxys ged-* du relais (Toxiproxy).
#
# Usage : scripts/lab/w2/link.sh ok|slow|cut|status
#   ok     lien normal : aucun toxique, proxys actifs.
#   slow   agence régionale : 300 ms ± 50 de latence, 256 kb/s dans chaque sens.
#   cut    coupure franche : proxys désactivés (les connexions en cours tombent).
#   status état actuel (lecture seule).
# Variable : LAB_RELAY_API (défaut http://127.0.0.1:8474).
# Codes de sortie : 0 = état atteint, 1 = relais injoignable ou refus, 2 = usage.
#
# Idempotent : l'état voulu remplace l'état courant (toxiques nommés retirés puis reposés),
# donc relancer la même commande ne change rien. Seuls les proxys ged-* sont touchés :
# la visionneuse et le bureau à distance de W2 restent normaux.
set -eu

API="${LAB_RELAY_API:-http://127.0.0.1:8474}"
PROXIES="ged-https ged-http"
TOXICS="lat-down lat-up bw-down bw-up"

fail() { echo "ECHEC : $1" >&2; exit 1; }
req() { curl -fsS -o /dev/null -X "$1" "$API$2" ${3:+-H 'Content-Type: application/json' -d "$3"}; }

state="${1:-}"
case "$state" in ok|slow|cut|status) ;; *) echo "usage : $0 ok|slow|cut|status" >&2; exit 2 ;; esac

curl -fsS -o /dev/null "$API/version" || fail "relais injoignable sur $API (compose.offline.yml démarré ?)"

if [ "$state" = "status" ]; then
  for p in $PROXIES; do echo "== $p"; curl -fsS "$API/proxies/$p"; echo; done
  exit 0
fi

for p in $PROXIES; do
  # Retrait de nos toxiques : 404 attendu s'ils n'existent pas.
  for t in $TOXICS; do curl -fsS -o /dev/null -X DELETE "$API/proxies/$p/toxics/$t" 2>/dev/null || true; done
  if [ "$state" = "cut" ]; then
    req POST "/proxies/$p" '{"enabled":false}' || fail "désactivation de $p"
    continue
  fi
  req POST "/proxies/$p" '{"enabled":true}' || fail "activation de $p"
  if [ "$state" = "slow" ]; then
    for dir in down up; do
      req POST "/proxies/$p/toxics" "{\"name\":\"lat-$dir\",\"type\":\"latency\",\"stream\":\"${dir}stream\",\"attributes\":{\"latency\":150,\"jitter\":25}}" \
        || fail "latence $dir sur $p"
      # rate en Ko/s : 32 Ko/s = 256 kb/s.
      req POST "/proxies/$p/toxics" "{\"name\":\"bw-$dir\",\"type\":\"bandwidth\",\"stream\":\"${dir}stream\",\"attributes\":{\"rate\":32}}" \
        || fail "débit $dir sur $p"
    done
  fi
done
echo "Lien W2 → GED : $state."
