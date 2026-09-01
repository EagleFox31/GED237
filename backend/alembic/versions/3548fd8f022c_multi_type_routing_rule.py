"""multi_type_routing_rule

Revision ID: 3548fd8f022c
Revises: b2c3d4e5f6a7
Create Date: 2026-04-27 10:35:11.143077

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "3548fd8f022c"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "routing_rule_categories",
        sa.Column("rule_id", sa.UUID(), nullable=False),
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ["category_id"], ["document_categories.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["rule_id"], ["routing_rules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("rule_id", "category_id"),
    )
    op.create_table(
        "routing_rule_org_units",
        sa.Column("rule_id", sa.UUID(), nullable=False),
        sa.Column("org_unit_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["org_unit_id"], ["org_units.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rule_id"], ["routing_rules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("rule_id", "org_unit_id"),
    )

    # --- DATA MIGRATION ---
    op.execute(
        "INSERT INTO routing_rule_categories (rule_id, category_id) "
        "SELECT id, document_category_id FROM routing_rules WHERE document_category_id IS NOT NULL"
    )
    op.execute(
        "INSERT INTO routing_rule_org_units (rule_id, org_unit_id) "
        "SELECT id, org_unit_id FROM routing_rules WHERE org_unit_id IS NOT NULL"
    )
    # ----------------------

    # Historical schemas do not all contain the same generated indexes/constraints.
    # Make destructive operations tolerant while still normalising the target schema.
    op.drop_index("idx_audit_tenant_created", table_name="audit_logs", if_exists=True)
    op.create_index(
        "idx_audit_tenant_created",
        "audit_logs",
        ["tenant_id", "created_at"],
        unique=False,
        postgresql_ops={"created_at": "DESC"},
    )
    op.drop_index("idx_audit_user_created", table_name="audit_logs", if_exists=True)
    op.create_index(
        "idx_audit_user_created",
        "audit_logs",
        ["user_id", "created_at"],
        unique=False,
        postgresql_ops={"created_at": "DESC"},
    )
    op.drop_index("idx_documents_created", table_name="documents", if_exists=True)
    op.create_index(
        "idx_documents_created",
        "documents",
        ["created_at"],
        unique=False,
        postgresql_ops={"created_at": "DESC"},
    )

    op.execute("DROP INDEX IF EXISTS ix_routing_rules_document_category_id")
    op.execute(
        "ALTER TABLE routing_rules DROP CONSTRAINT IF EXISTS routing_rules_org_unit_id_fkey"
    )
    op.execute(
        "ALTER TABLE routing_rules DROP CONSTRAINT IF EXISTS routing_rules_document_category_id_fkey"
    )
    op.execute("ALTER TABLE routing_rules DROP COLUMN IF EXISTS document_category_id")
    op.execute("ALTER TABLE routing_rules DROP COLUMN IF EXISTS org_unit_id")
    op.execute("DROP INDEX IF EXISTS idx_template_steps_target_unit_type")


def downgrade() -> None:
    """Downgrade schema."""
    op.create_index(
        "idx_template_steps_target_unit_type",
        "workflow_template_steps",
        ["target_unit_type_id"],
        unique=False,
    )
    op.add_column(
        "routing_rules",
        sa.Column("org_unit_id", sa.UUID(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "routing_rules",
        sa.Column(
            "document_category_id", sa.UUID(), autoincrement=False, nullable=False
        ),
    )
    op.create_foreign_key(
        "routing_rules_document_category_id_fkey",
        "routing_rules",
        "document_categories",
        ["document_category_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "routing_rules_org_unit_id_fkey",
        "routing_rules",
        "org_units",
        ["org_unit_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_routing_rules_document_category_id",
        "routing_rules",
        ["document_category_id"],
        unique=False,
    )
    op.drop_index("idx_documents_created", table_name="documents", if_exists=True)
    op.create_index(
        "idx_documents_created", "documents", [sa.text("created_at DESC")], unique=False
    )
    op.drop_index("idx_audit_user_created", table_name="audit_logs", if_exists=True)
    op.create_index(
        "idx_audit_user_created",
        "audit_logs",
        ["user_id", sa.text("created_at DESC")],
        unique=False,
    )
    op.drop_index("idx_audit_tenant_created", table_name="audit_logs", if_exists=True)
    op.create_index(
        "idx_audit_tenant_created",
        "audit_logs",
        ["tenant_id", sa.text("created_at DESC")],
        unique=False,
    )
    op.execute("DROP TABLE IF EXISTS routing_rule_org_units")
    op.execute("DROP TABLE IF EXISTS routing_rule_categories")
