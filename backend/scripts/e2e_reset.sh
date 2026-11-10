#!/bin/sh
# Bring the database to the E2E baseline, through the same path as the demo (DOCS/exploitation/donnees-demo.md):
# migrations first (Alembic owns the schema, CHECK constraints included), then the demo accounts
# (seed_db.py, skipped when already seeded), then the manifest's reference data and documents
# (seed_e2e.py, idempotent). Running it twice is a no-op.
#   sh scripts/e2e_reset.sh [profile]     # E2E_MANIFEST points to seed-manifest.json
set -eu
profile="${1:-e2e}"
: "${E2E_MANIFEST:?E2E_MANIFEST must point to frontend/e2e/data/seed-manifest.json}"
alembic upgrade head
python scripts/seed_db.py
python scripts/seed_e2e.py --manifest "$E2E_MANIFEST" --profile "$profile"
