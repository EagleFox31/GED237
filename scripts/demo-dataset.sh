#!/usr/bin/env bash
# Generate the demo corpus and check (or rewrite) demo-manifest.json, inside the api image.
#   bash scripts/demo-dataset.sh            # regenerate the corpus, fail if the manifest drifted
#   bash scripts/demo-dataset.sh --write    # regenerate and update the manifest
# Output: frontend/e2e/data/demo-import/{DRH,DAF,DSI,MINESUP,live,versions}/ (not versioned; the
# manifest and this script are). Deterministic: GED_EXPORT_SEED (default 237) fixes every byte.
# The e2e stack mounts the same folder at /data/ingest; `e2e_reset.sh demo` imports it from there.
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1
data="$(pwd)/frontend/e2e/data"
if command -v cygpath >/dev/null 2>&1; then data="$(cygpath -w "$data")"; fi
docker compose -f docker-compose.e2e.yml -p "${DEMO_COMPOSE_PROJECT:-ged-demo-dataset}" run --rm --no-deps \
  -v "$data:/e2e-data-rw" -e "GED_EXPORT_SEED=${GED_EXPORT_SEED:-237}" api \
  python scripts/demo_dataset.py --out /e2e-data-rw/demo-import --manifest /e2e-data-rw/demo-manifest.json "$@"
