#!/usr/bin/env bash
# Test de scripts/ensure_free_space.sh avec un faux « df » : aucune dépendance au disque réel.
# Vérifie le cas vert, le KO, le seuil réglable, plusieurs chemins, l'usage et la lecture seule.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/ensure_free_space.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fail() { echo "TEST EN ÉCHEC : $1" >&2; [ -f "$T/out" ] && sed 's/^/  | /' "$T/out" >&2; exit 1; }

mkdir -p "$T/bin" "$T/a" "$T/b"
cat >"$T/bin/df" <<'FAKE'
#!/usr/bin/env bash
# Faux df : l'espace libre (Ko) d'un dossier est lu dans $FREE_KB_<nom du dossier>.
last="${@: -1}"
name="$(basename "$last")"
kb_var="FREE_KB_${name}"
printf 'Filesystem 1024-blocks Used Available Capacity Mounted\n/dev/x 999999999 1 %s 1%% /\n' "${!kb_var:-0}"
FAKE
chmod +x "$T/bin/df"
export PATH="$T/bin:$PATH"
GB=$((1024 * 1024))

run() { set +e; "$SCRIPT" "$@" >"$T/out" 2>&1; rc=$?; set -e; }

FREE_KB_a=$((25 * GB)); export FREE_KB_a
FREE_KB_b=$((5 * GB)); export FREE_KB_b

run "$T/a";                              [ "$rc" = 0 ] || fail "disque à 25 Go : attendu 0, reçu $rc"
grep -q '^OK' "$T/out"                    || fail "ligne OK absente"
run "$T/b";                              [ "$rc" = 1 ] || fail "disque à 5 Go : attendu 1, reçu $rc"
grep -q '^KO' "$T/out"                    || fail "ligne KO absente"
run "$T/a" "$T/b";                       [ "$rc" = 1 ] || fail "un seul KO doit suffire : reçu $rc"
MIN_FREE_GB=3 run "$T/b";                [ "$rc" = 0 ] || fail "seuil réglé à 3 Go : attendu 0, reçu $rc"
MIN_FREE_GB=25 run "$T/a";               [ "$rc" = 0 ] || fail "seuil égal à l'espace libre : attendu 0, reçu $rc"
MIN_FREE_GB=26 run "$T/a";               [ "$rc" = 1 ] || fail "seuil au-dessus de l'espace libre : attendu 1, reçu $rc"
MIN_FREE_GB=abc run "$T/a";              [ "$rc" = 2 ] || fail "seuil invalide : attendu 2, reçu $rc"
run "$T/absent";                         [ "$rc" = 1 ] || fail "dossier absent : attendu 1, reçu $rc"
before="$(ls -A "$T/a" "$T/b" | wc -l)"
run "$T/a" "$T/b"
[ "$(ls -A "$T/a" "$T/b" | wc -l)" = "$before" ] || fail "le script a écrit dans un dossier vérifié"
echo "ensure_free_space : tous les tests passent"
