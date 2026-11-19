#!/bin/sh
# Bring the database to the E2E baseline, through the same path as the demo (DOCS/exploitation/donnees-demo.md):
# migrations first (Alembic owns the schema, CHECK constraints included), then the demo accounts
# (seed_db.py, skipped when already seeded), then the manifest's reference data and documents
# (seed_e2e.py, idempotent). Running it twice is a no-op.
#   sh scripts/e2e_reset.sh [profile]     # E2E_MANIFEST points to frontend/e2e/data/seed-manifest.json
# Profile demo: E2E_MANIFEST points to demo-manifest.json; after the reference data, seed_demo.py
# purges the demo tenants' documents, jobs and rules, posts the rules, imports the corpus
# (DEMO_CORPUS, default /data/ingest, see scripts/demo-dataset.sh) through the API and checks the
# result against the manifest's `expected` section. Two runs give the same counters. Last, the P8 data
# (demo-p8-manifest.json: validation circuit + 2 documents) is seeded on top, outside those counters.
set -eu
profile="${1:-e2e}"
: "${E2E_MANIFEST:?E2E_MANIFEST must point to frontend/e2e/data/seed-manifest.json (or demo-manifest.json)}"
alembic upgrade head
# SQL rights store filled from policy.csv when empty, left alone otherwise (same step as the migrate
# service of docker-compose.yml): with AUTHZ_BACKEND=sql an empty store denies every request.
python scripts/bootstrap_authz_sql.py
python scripts/seed_db.py
python scripts/seed_e2e.py --manifest "$E2E_MANIFEST" --profile "$profile"
if [ "$profile" = "demo" ]; then
  python scripts/seed_demo.py --manifest "$E2E_MANIFEST" --corpus "${DEMO_CORPUS:-/data/ingest}"
  # Parcours P8 (circuit de validation + 2 documents DAF) : après seed_demo.py, qui vide les documents du
  # tenant. Idempotent (clé = code) ; le manifeste est cherché à côté de demo-manifest.json.
  python scripts/seed_e2e.py --manifest "${DEMO_P8_MANIFEST:-$(dirname "$E2E_MANIFEST")/demo-p8-manifest.json}" --profile demo-p8
fi
