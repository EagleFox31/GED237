#!/usr/bin/env bash
# Test de scripts/images_import.sh avec un faux « docker » : aucun démon, aucun réseau.
# Couvre les deux magasins d'images : containerd (id = digest de l'index, celui de
# IMAGES.txt) et overlay2 (id = digest de la config, lu dans le manifest.json de l'archive).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/images_import.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export FIX="$T/fix"
fail() { echo "TEST EN ÉCHEC : $1" >&2; [ -f "$T/out" ] && sed 's/^/  | /' "$T/out" >&2; exit 1; }

IDX_API=sha256:1111111111111111111111111111111111111111111111111111111111111111
IDX_DB=sha256:2222222222222222222222222222222222222222222222222222222222222222
CFG_API=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
CFG_DB=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb

mkdir -p "$T/bin"
cat >"$T/bin/docker" <<'FAKE'
#!/usr/bin/env bash
# Faux docker : magasin = un fichier par tag dans $FIX/store ; « load » copie $FIX/loaded.
key() { local r="$1"; case "${r##*/}" in *:*) ;; *) r="$r:latest" ;; esac; printf '%s' "${r//[\/:]/_}"; }
case "$1 $2" in
  "image inspect") f="$FIX/store/$(key "${!#}")"; [ -f "$f" ] && cat "$f" || exit 1 ;;
  "load ")
    cat >/dev/null; echo load >>"$FIX/calls"; cp "$FIX/loaded/"* "$FIX/store/" ;;
  *) exit 1 ;;
esac
FAKE
chmod +x "$T/bin/docker"

# Archive « docker save » minimale : seul manifest.json compte pour le script.
# $1 = forme du chemin de config : oci (blobs/sha256/<hex>) ou legacy (<hex>.json).
mk() {
  rm -rf "$FIX"; mkdir -p "$FIX/src" "$FIX/arc" "$FIX/store" "$FIX/loaded"; : >"$FIX/calls"
  local a="blobs/sha256/$CFG_API" d="blobs/sha256/$CFG_DB"
  [ "$1" = legacy ] && { a="$CFG_API.json"; d="$CFG_DB.json"; }
  printf '[{"Config":"%s","RepoTags":["qlab-api:latest"],"Layers":[]},{"Config":"%s","RepoTags":["postgres:15-alpine"],"Layers":[]}]\n' \
    "$a" "$d" >"$FIX/arc/manifest.json"
  (cd "$FIX/arc" && tar -cf - manifest.json) | gzip -n >"$FIX/src/images.tar.gz"
  printf 'postgres:15-alpine %s\nqlab-api %s\n' "$IDX_DB" "$IDX_API" >"$FIX/src/IMAGES.txt"
  (cd "$FIX/src" && sha256sum images.tar.gz IMAGES.txt >SHA256SUMS)
}
# Ce que « docker load » produit selon le magasin.
store_containerd() { echo "$IDX_API" >"$FIX/loaded/qlab-api_latest"; echo "$IDX_DB" >"$FIX/loaded/postgres_15-alpine"; }
store_overlay2() { echo "sha256:$CFG_API" >"$FIX/loaded/qlab-api_latest"; echo "sha256:$CFG_DB" >"$FIX/loaded/postgres_15-alpine"; }

run() { # run <code attendu> <libellé> <motif attendu> <nombre de docker load attendu>
  local rc=0
  PATH="$T/bin:$PATH" bash "$SCRIPT" "$FIX/src" >"$T/out" 2>&1 || rc=$?
  [ "$rc" = "$1" ] || fail "$2 (code $rc, attendu $1)"
  grep -q -- "$3" "$T/out" || fail "$2 (sortie sans « $3 »)"
  [ "$(grep -c . "$FIX/calls" || true)" = "$4" ] || fail "$2 ($(grep -c . "$FIX/calls" || true) docker load, attendu $4)"
}

for store in containerd overlay2; do
  mk oci; "store_$store"
  run 0 "$store : premier import" "2 image(s) présentes avec l'id attendu" 1
  : >"$FIX/calls"
  run 0 "$store : second import" "rien à charger" 0
done

mk legacy; store_overlay2
run 0 "overlay2, manifest à l'ancien format" "2 image(s) présentes" 1

mk oci; store_overlay2; echo "sha256:$(printf 'c%.0s' {1..64})" >"$FIX/loaded/qlab-api_latest"
run 1 "id inattendu après chargement" "id différent ou image absente : qlab-api" 1

mk oci; store_overlay2; echo "corrompu" >>"$FIX/src/IMAGES.txt"
run 1 "copie altérée" "sommes de contrôle invalides" 0

echo "OK : images_import.sh, magasins containerd et overlay2 ($(basename "$SCRIPT"))"
