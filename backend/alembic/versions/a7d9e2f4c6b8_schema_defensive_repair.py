"""schema defensive repair

Revision ID: a7d9e2f4c6b8
Revises: f8e9d7c6b5a4
Create Date: 2026-09-01

This migration is intentionally defensive. It gives databases that already
passed older migrations a forward-only repair point without requiring those
historical revisions to be replayed.
"""

from typing import Sequence, Union

from alembic import op


revision: str = "a7d9e2f4c6b8"
down_revision: Union[str, Sequence[str], None] = "f8e9d7c6b5a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Normalise known legacy drift without assuming objects are present."""
    # Old installations may contain a global matricule uniqueness constraint.
    # GED237 uniqueness is tenant-scoped instead.
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_matricule_key")

    # Stale indexes left by historical routing/template revisions.
    op.execute("DROP INDEX IF EXISTS ix_routing_rules_document_category_id")
    op.execute("DROP INDEX IF EXISTS idx_template_steps_target_unit_type")

    # Recreate/ensure non-destructive invariants expected by the current schema.
    # IF NOT EXISTS means databases that are already correct are untouched.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_matricule "
        "ON users (tenant_id, matricule)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_users_matricule ON users (matricule)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_tenant_created "
        "ON audit_logs (tenant_id, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_user_created "
        "ON audit_logs (user_id, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_documents_created "
        "ON documents (created_at DESC)"
    )


def downgrade() -> None:
    # Repair migrations intentionally do not remove objects that may have
    # pre-existed this revision. Downgrading the version marker is safe.
    pass
