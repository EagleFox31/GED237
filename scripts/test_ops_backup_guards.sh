#!/usr/bin/env bash
# Test des garde-fous de ops/backup.sh et ops/restore.sh avec un faux « docker » : aucun démon.
# 1. Image utilitaire absente et non téléchargeable : arrêt avant toute écriture
#    (pas de dossier de sauvegarde, services non arrêtés, cible non vidée).
# 2. Après la relance d'api, nginx est relancé et /health vérifié à travers lui.
# 3. BACKUP_HEALTH_TRIES invalide : arrêt avant toute écriture ; « OK » jamais sans réponse.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export FIX="$T/fix"
fail() { echo "TEST EN ÉCHEC : $1" >&2; [ -f "$T/out" ] && sed 's/^/  | /' "$T/out" >&2; exit 1; }

mkdir -p "$T/bin"
cat >"$T/bin/docker" <<'FAKE'
#!/usr/bin/env bash
# Faux docker : état dans $FIX, chaque appel journalisé dans $FIX/calls.
printf '%s\n' "$*" >>"$FIX/calls"
case "$*" in
  "compose ps -q postgres") echo pg1 ;;
  "compose ps --status running --services") cat "$FIX/running" ;;
  inspect\ -f*project*) echo qlab ;;
  inspect\ -f*Env*) printf 'POSTGRES_USER=ged\nPOSTGRES_DB=ged\n' ;;
  "inspect pg1" | volume\ inspect*) ;;
  image\ inspect*) [ -f "$FIX/has_image" ] ;;
  pull*) [ -f "$FIX/pull_ok" ] ;;
  compose\ exec*) [ -f "$FIX/health_ok" ] ;;
  compose\ stop* | compose\ up* | compose\ restart*) ;;
  *) echo "faux docker : appel inattendu : $*" >&2; exit 99 ;;
esac
FAKE
chmod +x "$T/bin/docker"
unset BACKUP_HELPER_IMAGE BACKUP_PROXY_SERVICES BACKUP_STOP_SERVICES PG_CONTAINER STORAGE_VOLUME
export PATH="$T/bin:$PATH" BACKUP_DIR="$T/backups" BACKUP_HEALTH_TRIES=2

reset() { rm -rf "$FIX" "$T/backups" "$T/root"; mkdir -p "$FIX" "$T/root/ops/lib"; : >"$FIX/calls"
  printf 'api\nworker\nnginx\npostgres\n' >"$FIX/running"
  # Copie sans .env : le .env du poste ne doit pas influencer le test.
  cp "$ROOT/ops/backup.sh" "$ROOT/ops/restore.sh" "$T/root/ops/"; cp "$ROOT/ops/lib/common.sh" "$T/root/ops/lib/"; }
called() { grep -q -- "$1" "$FIX/calls"; }

# 1a. Sauvegarde sans image utilitaire, hors ligne.
reset
rc=0; bash "$T/root/ops/backup.sh" >"$T/out" 2>&1 || rc=$?
[ "$rc" = 1 ] || fail "sauvegarde sans image : code $rc, attendu 1"
grep -q "BACKUP_HELPER_IMAGE=qlab-api" "$T/out" || fail "sauvegarde sans image : réglage à faire absent du message"
grep -q "Rien n'a été modifié" "$T/out" || fail "sauvegarde sans image : message"
[ ! -e "$T/backups" ] || fail "sauvegarde sans image : dossier créé ($(ls "$T/backups"))"
! called "compose stop" || fail "sauvegarde sans image : services arrêtés"

# 1b. Restauration sans image utilitaire : rien n'est arrêté ni vidé.
reset; mkdir -p "$T/src"; for f in MANIFEST.txt SHA256SUMS db.dump storage.tar.gz; do : >"$T/src/$f"; done
echo format=1 >"$T/src/MANIFEST.txt"
rc=0; bash "$T/root/ops/restore.sh" "$T/src" --wipe --yes >"$T/out" 2>&1 || rc=$?
[ "$rc" = 1 ] || fail "restauration sans image : code $rc, attendu 1"
! called "compose stop" || fail "restauration sans image : services arrêtés"
! called "^run" || fail "restauration sans image : conteneur utilitaire lancé"

# 1c. Image absente mais téléchargeable (en ligne) : on passe.
reset; : >"$FIX/pull_ok"
# shellcheck disable=SC1091
( . "$T/root/ops/lib/common.sh"; require_helper_image ) >"$T/out" 2>&1 || fail "image téléchargeable : refusée"
called "^pull -q python:3.12-slim" || fail "image téléchargeable : pas de docker pull"

# 2. Relance des services : nginx suit api, /health vérifié.
# shellcheck disable=SC1091,SC2034 # sourced copy, variables read by common.sh
restart() { ( . "$T/root/ops/lib/common.sh"; COMPOSE_MODE=1; STOPPED_SERVICES="$1"; restart_services ) >"$T/out" 2>&1; }

reset; : >"$FIX/health_ok"
restart "api worker " || fail "api relancé : code non nul"
called "^compose restart nginx$" || fail "api relancé : nginx non relancé"
called "^compose exec -T nginx wget .* http://127.0.0.1/health" || fail "api relancé : /health non vérifié"
grep -q "/health OK à travers nginx" "$T/out" || fail "api relancé : pas de trace /health OK"

reset
rc=0; restart "api " || rc=$?
[ "$rc" = 1 ] || fail "/health en échec : code $rc, attendu 1"
grep -q "/health ne répond pas à travers nginx" "$T/out" || fail "/health en échec : message"

reset; : >"$FIX/health_ok"; printf 'api\nnginx\nnginx-tls\n' >"$FIX/running"
restart "api " || fail "deux proxys : code non nul"
called "^compose restart nginx nginx-tls$" || fail "deux proxys : relance"
called "^compose exec -T nginx-tls wget .* https://127.0.0.1/health" || fail "deux proxys : /health en https"

reset
restart "worker " || fail "worker seul : code non nul"
! called "compose restart" || fail "worker seul : nginx relancé sans raison"

reset; printf 'api\nworker\n' >"$FIX/running"
restart "api " || fail "sans proxy : code non nul"
! called "compose restart" || fail "sans proxy : relance inattendue"

# 3. BACKUP_HEALTH_TRIES à 0 ou non entier : arrêt avant toute écriture (sinon aucun essai
#    et « /health OK » écrit à tort).
for bad in 0 00 abc 2x -1; do
  reset; : >"$FIX/has_image"
  rc=0; BACKUP_HEALTH_TRIES="$bad" bash "$T/root/ops/backup.sh" >"$T/out" 2>&1 || rc=$?
  [ "$rc" = 1 ] || fail "BACKUP_HEALTH_TRIES=$bad : code $rc, attendu 1"
  grep -q "BACKUP_HEALTH_TRIES=$bad : nombre entier" "$T/out" || fail "BACKUP_HEALTH_TRIES=$bad : message"
  [ ! -e "$T/backups" ] || fail "BACKUP_HEALTH_TRIES=$bad : dossier créé"
done
reset; : >"$FIX/has_image"
rc=0; BACKUP_HEALTH_TRIES=0 bash "$T/root/ops/restore.sh" "$T/src" --wipe --yes >"$T/out" 2>&1 || rc=$?
[ "$rc" = 1 ] || fail "restauration BACKUP_HEALTH_TRIES=0 : code $rc, attendu 1"
! called "compose stop" || fail "restauration BACKUP_HEALTH_TRIES=0 : services arrêtés"

# 4. Un seul essai autorisé et /health en échec : erreur, jamais « OK ».
reset
rc=0; BACKUP_HEALTH_TRIES=1 restart "api " || rc=$?
[ "$rc" = 1 ] || fail "un essai : code $rc, attendu 1"
! grep -q "/health OK" "$T/out" || fail "un essai : OK écrit sans réponse"
[ "$(grep -c '^compose exec' "$FIX/calls")" = 1 ] || fail "un essai : $(grep -c '^compose exec' "$FIX/calls") essais"

echo "OK : garde-fous de ops/backup.sh et ops/restore.sh (image utilitaire, relance de nginx)"
