"""Role codes known to the platform.

Single source for the role codes that the Casbin policy (``policy.csv``), the
database seeds (``alembic/versions/001_initial_schema.py``,
``scripts/seed_db.py``) and the tests must agree on. Codes are lower case and
compared literally everywhere; the ``roles`` table enforces the case with a
CHECK constraint (migration ``f0a1b2c3d4e5``).
"""

SUPER_ADMIN = "super_admin"
TENANT_ADMIN = "tenant_admin"
UNIT_ADMIN = "unit_admin"
MANAGER = "manager"
COLLABORATOR = "collaborator"
READER = "reader"
AUDITOR = "auditor"

ROLE_CODES: frozenset[str] = frozenset(
    {SUPER_ADMIN, TENANT_ADMIN, UNIT_ADMIN, MANAGER, COLLABORATOR, READER, AUDITOR}
)
