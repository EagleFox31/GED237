#!/usr/bin/env bash
# Test de scripts/check_offline_frontend.sh : le garde-fou doit passer sur un frontend propre
# et ÉCHOUER (exit 1) quand une URL externe apparaît dans une source ou dans le dist.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="$ROOT/scripts/check_offline_frontend.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fail() { echo "TEST EN ÉCHEC : $1" >&2; exit 1; }

mk() { rm -rf "$T/f"; mkdir -p "$T/f/dist/assets"; cp "$ROOT/frontend/offline-allowlist.txt" "$T/f/"
  echo '<svg xmlns="http://www.w3.org/2000/svg"></svg>' >"$T/f/ok.tsx"
  echo '// https://commentaire.example/ignoré' >>"$T/f/ok.tsx"
  echo '<html><body>ok</body></html>' >"$T/f/index.html"; }
expect() { # expect <code attendu> <libellé>
  local rc=0; bash "$GUARD" "$T/f" >/dev/null 2>&1 || rc=$?
  [ "$rc" = "$1" ] || fail "$2 (code $rc, attendu $1)"; }

mk; expect 0 "frontend propre"
mk; echo '<script src="https://cdn.tailwindcss.com"></script>' >>"$T/f/index.html"; expect 1 "CDN dans index.html"
mk; echo 'const a = "https://api.dicebear.com/7.x/x/svg";' >"$T/f/bad.tsx"; expect 1 "avatar distant dans une source"
mk; echo '@import url("https://fonts.googleapis.com/css2?family=Inter");' >"$T/f/dist/assets/a.css"; expect 1 "police distante dans le CSS du dist"
mk; echo 'import("https://esm.sh/react")' >"$T/f/dist/assets/a.js"; expect 1 "import distant dans le JS du dist"
mk; echo 'const u = "https://reactrouter.com/doc"; // chaîne de bibliothèque' >"$T/f/dist/assets/lib.js"; expect 0 "lien de documentation dans le dist ignoré"
mk; echo 'fetch("https://autorise.example/x")' >"$T/f/bad.ts"; echo '^https://autorise\.example/' >>"$T/f/offline-allowlist.txt"; expect 0 "liste blanche"
echo "OK : 7 cas du garde-fou"
