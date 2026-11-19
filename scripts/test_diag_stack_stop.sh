#!/usr/bin/env bash
# Test de scripts/diag_stack_stop.sh avec un faux « docker » : aucun démon, aucun réseau.
# Vérifie l'usage, le projet inconnu, l'arrêt volontaire groupé, le manque de mémoire, le code 137
# et la lecture seule (seuls « ps » et « inspect » sont appelés).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/diag_stack_stop.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export FIX="$T/fix"; mkdir -p "$FIX" "$T/bin"
fail() { echo "TEST EN ÉCHEC : $1" >&2; [ -f "$T/out" ] && sed 's/^/  | /' "$T/out" >&2; exit 1; }

cat >"$T/bin/docker" <<'FAKE'
#!/usr/bin/env bash
# Faux docker : « ps » rend les ids de la fixture, « inspect » ses lignes ; journalise tout.
printf '%s\n' "$*" >>"$FIX/calls"
case "$1" in
  ps) if [ -s "$FIX/inspect" ]; then cut -d'|' -f1 "$FIX/inspect" | tr -d /; fi ;;
  inspect) cat "$FIX/inspect" ;;
  *) exit 99 ;;
esac
FAKE
chmod +x "$T/bin/docker"
export PATH="$T/bin:$PATH"

run() { rm -f "$FIX/calls"; set +e; bash "$SCRIPT" "$@" >"$T/out" 2>&1; rc=$?; set -e; }

# 1. Usage.
run; [ "$rc" = 2 ] || fail "sans argument : code $rc (attendu 2)"

# 2. Projet inconnu.
: >"$FIX/inspect"
run inconnu; [ "$rc" = 1 ] || fail "projet inconnu : code $rc (attendu 1)"
grep -q 'aucun conteneur' "$T/out" || fail "projet inconnu : message absent"

# 3. Arrêt volontaire groupé (cas du 19/11) : codes 0, même minute, un conteneur relancé depuis.
cat >"$FIX/inspect" <<'EOF'
/p_api|exited|0|false|2026-11-19T06:47:27.1Z|2026-11-19T11:58:18.5Z|unless-stopped
/p_db|running|0|false|2026-11-19T12:45:53.4Z|2026-11-19T11:58:15.9Z|unless-stopped
/p_front|exited|0|false|2026-11-19T06:47:27.2Z|2026-11-19T11:58:16.2Z|
/p_seed|exited|0|false|2026-11-16T22:05:57.0Z|0001-01-01T00:00:00Z|no
/p_migrate|exited|0|false|2026-11-18T07:17:11.0Z|2026-11-18T07:17:12.0Z|no
EOF
run p; [ "$rc" = 0 ] || fail "arrêt groupé : code $rc"
grep -q 'arrêt volontaire' "$T/out" || fail "arrêt groupé : lecture « arrêt volontaire » absente"
grep -q "vague d'arrêts du projet p : 3 conteneur(s), de 2026-11-19T11:58:15 à 2026-11-19T11:58:18" "$T/out" || fail "arrêt groupé : vague fausse"
grep -q '(1 arrêt(s) plus ancien(s) hors vague' "$T/out" || fail "tâche ponctuelle de la veille non mise hors vague"
grep -qE '^p_front +exited +0 +false .* no$' "$T/out" || fail "politique vide non affichée en « no »"
[ "$(head -2 "$T/out" | tail -1 | cut -d' ' -f1)" = p_seed ] || fail "tri par heure d'arrêt"

# 4. Manque de mémoire et code 137 : pas de lecture « volontaire ».
cat >"$FIX/inspect" <<'EOF'
/p_worker|exited|137|true|2026-11-19T06:00:00Z|2026-11-19T11:58:10Z|unless-stopped
/p_sync|exited|137|false|2026-11-19T06:00:00Z|2026-11-19T11:58:12Z|no
EOF
run p; [ "$rc" = 0 ] || fail "oom : code $rc"
grep -q 'manque de mémoire : p_worker' "$T/out" || fail "oom non signalé"
grep -q 'code 137, sans OOM) : p_sync' "$T/out" || fail "137 sans OOM non signalé"
grep -q 'arrêt volontaire' "$T/out" && fail "oom : lecture volontaire à tort"

# 5. Lecture seule : uniquement ps et inspect.
grep -vqE '^(ps|inspect) ' "$FIX/calls" && fail "appel docker autre que ps/inspect : $(cat "$FIX/calls")"
grep -q 'label=com.docker.compose.project=p' "$FIX/calls" || fail "filtre par projet compose absent"

echo "test_diag_stack_stop : OK (5 cas)"
