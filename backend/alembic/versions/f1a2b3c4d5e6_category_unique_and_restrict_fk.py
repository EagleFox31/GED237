"""category_unique_constraint_and_restrict_fk

Revision ID: f1a2b3c4d5e6
Revises: 5c9f45c994cf
Create Date: 2026-04-17 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "5c9f45c994cf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add the tenant/category uniqueness only when it is missing.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'uq_category_tenant_code'
                  AND conrelid = 'document_categories'::regclass
            ) THEN
                ALTER TABLE document_categories
                ADD CONSTRAINT uq_category_tenant_code UNIQUE (tenant_id, code);
            END IF;
        END
        $$;
        """
    )

    # 2. Normalise FK semantics. DROP IF EXISTS makes this work whether the
    # historical CASCADE FK is present or not.
    op.execute("ALTER TABLE routing_rules DROP CONSTRAINT IF EXISTS fk_rules_category")
    op.create_foreign_key(
        "fk_rules_category",
        "routing_rules",
        "document_categories",
        ["document_category_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.execute("ALTER TABLE routing_rules DROP CONSTRAINT IF EXISTS fk_rules_category")
    op.create_foreign_key(
        "fk_rules_category",
        "routing_rules",
        "document_categories",
        ["document_category_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.execute(
        "ALTER TABLE document_categories DROP CONSTRAINT IF EXISTS uq_category_tenant_code"
    )
