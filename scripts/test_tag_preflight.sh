#!/usr/bin/env bash
# Test de scripts/tag_preflight.sh avec un faux « gh » : aucun appel réseau.
# Vérifie le cas vert, chaque KO (arrêt au premier), l'usage, --dry-run et la lecture seule.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/tag_preflight.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export FIX="$T/fix"
SHA=0123456789abcdef0123456789abcdef01234567
TAG=v9.9.9-rc.1
fail() { echo "TEST EN ÉCHEC : $1" >&2; [ -f "$T/out" ] && sed 's/^/  | /' "$T/out" >&2; exit 1; }

mkdir -p "$T/bin"
cat >"$T/bin/gh" <<'FAKE'
#!/usr/bin/env bash
# Faux gh : répond depuis $FIX et journalise chaque appel.
printf '%s\n' "$*" >>"$FIX/calls"
all=" $* "
case "$1 $2" in
  "repo view")
    case "$all" in *defaultBranchRef*) cat "$FIX/branch" ;; *) cat "$FIX/repo" ;; esac ;;
  "run list")
    case "$all" in *" -c "*) cat "$FIX/ci_run" ;; *) cat "$FIX/nightly" ;; esac ;;
  "run download")
    [ -d "$FIX/dist" ] || exit 1
    while [ $# -gt 0 ]; do [ "$1" = "-D" ] && dest="$2"; shift; done
    mkdir -p "$dest" && cp -r "$FIX/dist/." "$dest/" ;;
  api\ *)
    url=""; for a in "$@"; do case "$a" in repos/*) url="$a" ;; esac; done
    case "$url" in
      */check-runs*) cat "$FIX/checks" ;;
      */git/matching-refs/tags/*) cat "$FIX/tags" ;;
      */contents/*) f="${url#*/contents/}"; f="${f%%\?*}"; cat "$FIX/contents/$(basename "$f")" ;;
      */commits/*) cat "$FIX/sha" ;;
      *) exit 1 ;;
    esac ;;
  *) exit 1 ;;
esac
FAKE
chmod +x "$T/bin/gh"

mk() { # État vert de référence.
  rm -rf "$FIX"; mkdir -p "$FIX/contents" "$FIX/dist/assets"
  echo "acme/ged" >"$FIX/repo"; echo "trunk" >"$FIX/branch"; echo "$SHA" >"$FIX/sha"
  printf 'CI Gate\tcompleted\tsuccess\nFrontend / Build\tcompleted\tsuccess\nTrivy\tcompleted\tskipped\n' >"$FIX/checks"
  echo "completed success $SHA" >"$FIX/nightly"; echo "4242" >"$FIX/ci_run"
  printf 'refs/tags/%s0\n' "$TAG" >"$FIX/tags" # un tag voisin, de même préfixe
  echo '<html>ok</html>' >"$FIX/dist/index.html"
  # Garde-fou minimal : KO si une URL externe est dans le dist.
  printf '%s\n' 'if grep -rq "https://" "$1/dist"; then echo "ÉCHEC : URL externe"; exit 1; fi' \
    'echo "OK : aucune URL externe"' >"$FIX/contents/check_offline_frontend.sh"
  : >"$FIX/contents/offline-allowlist.txt"
  printf '# Notes de version\n\nContenu.\n' >"$FIX/contents/notes-version-$TAG.md"
  : >"$FIX/calls"
}
run() { # run <code attendu> <libellé> [motif attendu dans la sortie] [arguments…]
  local want="$1" label="$2" pattern="${3:-}" rc=0; shift; shift; [ $# -gt 0 ] && shift
  [ $# -gt 0 ] || set -- "$TAG"
  PATH="$T/bin:$PATH" REPO="" bash "$SCRIPT" "$@" >"$T/out" 2>&1 || rc=$?
  [ "$rc" = "$want" ] || fail "$label (code $rc, attendu $want)"
  [ -z "$pattern" ] || grep -Eq -- "$pattern" "$T/out" || fail "$label (motif absent : $pattern)"
}
last_is_ko() { [ "$(grep -c '^KO ' "$T/out")" = 1 ] && tail -n 1 "$T/out" | grep -q '^KO ' || fail "$1 : un seul KO, en dernière ligne"; }

mk; run 0 "tout est vert" "^PRÊT : $TAG peut être posé sur $SHA"
[ "$(grep -c '^OK ' "$T/out")" = 9 ] || fail "9 lignes OK attendues"
grep -q '^OK  depot      acme/ged, branche trunk' "$T/out" || fail "dépôt et branche découverts"
if grep -Ev '^(repo view|run list|run download|api) ' "$FIX/calls" | grep -q . ||
  grep -Eq -- '(^| )(-X|--method|-f|-F|--field|--input)( |$)' "$FIX/calls"; then
  fail "lecture seule : un appel gh écrit"
fi

mk; run 0 "branche passée en paramètre" "branche releases" "$TAG" releases
grep -q defaultBranchRef "$FIX/calls" && fail "branche fournie : pas de découverte attendue"

mk; printf 'CI Gate\tin_progress\tnull\nFrontend / Build\tcompleted\tsuccess\n' >"$FIX/checks"
run 1 "contrôle exigé en cours" "^KO  ci .*CI Gate.*in_progress"; last_is_ko "contrôle exigé en cours"
mk; printf 'CI Gate\tcompleted\tsuccess\n' >"$FIX/checks"
run 1 "contrôle exigé absent" "^KO  ci .*Frontend / Build.*absent"
mk; printf 'Trivy\tcompleted\tfailure\n' >>"$FIX/checks"
run 1 "autre contrôle en échec" "^KO  ci .*Trivy \(completed failure\)"
mk; echo "completed failure $SHA" >"$FIX/nightly"; run 1 "nightly rouge" "^KO  nightly .*completed failure"
mk; : >"$FIX/nightly"; run 1 "aucun nightly" "^KO  nightly .*aucun run"
mk; echo "completed success ffffffffffffffffffffffffffffffffffffffff" >"$FIX/nightly"
run 0 "nightly vert sur un SHA antérieur" "^OK  nightly .*fffffff \(antérieur"
mk; echo "refs/tags/$TAG" >>"$FIX/tags"; run 1 "tag déjà présent" "^KO  tag .*existe déjà"; last_is_ko "tag déjà présent"
mk; rm "$FIX/tags"; run 1 "tags illisibles" "^KO  tag .*tags illisibles"; last_is_ko "tags illisibles"
mk; echo '<script src="https://cdn.example/x.js"></script>' >"$FIX/dist/index.html"
run 1 "dist dépendant d'Internet" "^KO  dist .*dépend d'Internet"
mk; rm -rf "$FIX/dist"; run 1 "frontend non construit sur le SHA" "^KO  dist .*artefact"
mk; rm "$FIX/contents/notes-version-$TAG.md"; run 1 "notes absentes" "^KO  notes .*absent"
mk; : >"$FIX/contents/notes-version-$TAG.md"; run 1 "notes vides" "^KO  notes .*vide"
mk; printf '# Notes\n- **Pour** : équipe\n' >"$FIX/contents/notes-version-$TAG.md"
run 1 "notes avec en-tête interne" "^KO  notes .*en-tête interne"
mk; echo "pas-un-sha" >"$FIX/sha"; run 1 "SHA illisible" "^KO  sha "

mk; run 2 "version invalide" "version invalide" "1.0"
mk; run 2 "sans argument" "Usage" --dry-run
mk; run 0 "dry-run" "aucun appel réseau" --dry-run "$TAG"
[ ! -s "$FIX/calls" ] || fail "--dry-run a appelé gh"
echo "OK : 19 cas de tag_preflight.sh"
