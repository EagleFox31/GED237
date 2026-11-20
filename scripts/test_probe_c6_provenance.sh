#!/usr/bin/env bash
# Test de la garde de provenance de scripts/probe_c6.sh (LESSON-2026-083), avec de faux « docker » et
# « curl » : aucun conteneur, aucun réseau. Vérifie qu'une série ne démarre que si la pile sert le code
# du SHA annoncé, et que sans C6_EXPECT_SHA le comportement est inchangé.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${PROBE:-$ROOT/scripts/probe_c6.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export FIX="$T/fix"
fail() { echo "TEST EN ÉCHEC : $1" >&2; [ -f "$T/err" ] && sed 's/^/  | /' "$T/err" >&2; exit 1; }

mkdir -p "$T/bin" "$FIX"
cat >"$T/bin/docker" <<'FAKE'
#!/usr/bin/env bash
# Faux docker : « exec <conteneur> sh -c <cmd> » exécute <cmd> dans $FIX/served à la place de /app,
# pour le seul conteneur fix_api ; ps et inspect ne listent rien.
if [ "$1" = exec ]; then
  [ "$2" = fix_api ] || { echo "No such container: $2" >&2; exit 1; }
  cmd="${5/cd \/app/cd $FIX/served}"
  # FAKE_EXEC_PATH : sha256sum « du conteneur » (format Linux) placé devant le PATH de l'hôte.
  PATH="${FAKE_EXEC_PATH:+$FAKE_EXEC_PATH:}$PATH" exec sh -c "$cmd"
fi
exit 0
FAKE
printf '#!/bin/sh\nprintf 200\n' >"$T/bin/curl"
chmod +x "$T/bin/docker" "$T/bin/curl"
export PATH="$T/bin:$PATH"

# sha256sum aux deux formats de sortie : « hash *chemin » (Git Bash) et « hash  chemin » (Linux).
REAL_SUM="$(command -v sha256sum)"
mkdir -p "$T/star" "$T/linux"
printf '#!/bin/sh\n"%s" "$@" | sed "s/^\\([0-9a-f]*\\) [ *]/\\1 */"\n' "$REAL_SUM" >"$T/star/sha256sum"
printf '#!/bin/sh\n"%s" "$@" | sed "s/^\\([0-9a-f]*\\) [ *]/\\1  /"\n' "$REAL_SUM" >"$T/linux/sha256sum"
chmod +x "$T/star/sha256sum" "$T/linux/sha256sum"

# Dépôt source minimal : backend/app et backend/alembic, un commit.
SRC="$T/src"
mkdir -p "$SRC/backend/app" "$SRC/backend/alembic"
echo 'X = 1' >"$SRC/backend/app/main.py"
echo 'Y = 2' >"$SRC/backend/alembic/env.py"
git -C "$SRC" init -q
git -C "$SRC" -c user.name=t -c user.email=t@t add -A
git -C "$SRC" -c user.name=t -c user.email=t@t commit -q -m init
SHA="$(git -C "$SRC" rev-parse HEAD)"

serve_source() { rm -rf "$FIX/served"; cp -r "$SRC/backend" "$FIX/served"; }

run() { # run <code attendu> <libellé> [VAR=valeur…]
  local want="$1" label="$2"; shift 2
  rm -f "$T/c6.tsv"
  set +e
  env C6_LOG="$T/c6.tsv" C6_PREFIX=fix_ C6_SOURCE="$SRC" "$@" sh "$SCRIPT" >/dev/null 2>"$T/err"
  local got=$?
  set -e
  [ "$got" = "$want" ] || fail "$label : code $got, attendu $want"
  if [ "$want" = 0 ]; then
    [ "$(wc -l <"$T/c6.tsv")" = 1 ] || fail "$label : un relevé attendu"
  else
    [ ! -e "$T/c6.tsv" ] || fail "$label : aucun relevé ne doit être écrit après un refus"
  fi
}

serve_source
run 0 "sans C6_EXPECT_SHA : comportement inchangé"
grep -q provenance "$T/err" && fail "sans C6_EXPECT_SHA : aucun contrôle de provenance attendu"

run 0 "SHA annoncé (court) et code servi identique" C6_EXPECT_SHA="${SHA:0:8}"
grep -q "C6 provenance: $SHA" "$T/err" || fail "provenance OK : ligne de preuve attendue"

run 3 "source à un autre commit" C6_EXPECT_SHA=0123456789abcdef
grep -q "not 0123456789abcdef" "$T/err" || fail "SHA différent : message attendu"

echo 'Y = 3' >"$SRC/backend/alembic/env.py"
run 3 "source modifiée localement" C6_EXPECT_SHA="$SHA"
git -C "$SRC" checkout -q -- backend

echo 'X = 99' >"$FIX/served/app/main.py"
run 3 "code servi différent de la source (pile non redéployée)" C6_EXPECT_SHA="$SHA"
grep -q "differs from $SHA" "$T/err" || fail "code différent : message attendu"
serve_source

run 3 "conteneur API absent" C6_EXPECT_SHA="$SHA" C6_API=fix_absent

"$T/star/sha256sum" "$SCRIPT" | grep -q ' [*]' || fail "faux sha256sum hôte : format « * » attendu"
"$T/linux/sha256sum" "$SCRIPT" | grep -q '  ' || fail "faux sha256sum conteneur : format Linux attendu"
run 0 "même code, hôte « hash *chemin » et conteneur « hash  chemin »" \
  C6_EXPECT_SHA="$SHA" PATH="$T/star:$PATH" FAKE_EXEC_PATH="$T/linux"

run 3 "SHA annoncé trop court (moins de 7 caractères)" C6_EXPECT_SHA="${SHA:0:6}"
grep -q "at least 7 hex" "$T/err" || fail "SHA court : message attendu"
run 3 "SHA annoncé non hexadécimal" C6_EXPECT_SHA="${SHA:0:7}z"

echo "OK : garde de provenance C6 (9 cas)"
