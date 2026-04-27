"""add_rule_engine_columns

Revision ID: a1b2c3d4e5fa
Revises: 0285c23ae874
Create Date: 2026-04-13

Adds the columns that align GEDRule with the rule engine contract:
  - operator          : AND | OR logic per rule (default AND)
  - stop_on_first_match: halt evaluation after this rule fires  (default False)
  - dry_run           : evaluate conditions but skip actions    (default False)

Also corrects:
  - conditions / actions JSONB default from '{}' (dict) to '[]' (list)
  - Drops DESC index on priority, replaces with ASC to match applicative sort
"""

from alembic import op
import sqlalchemy as sa


revision = "a1b2c3d4e5fa"
down_revision = "0285c23ae874"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- New behaviour columns ---
    op.add_column(
        "ged_rules",
        sa.Column("operator", sa.String(10), nullable=False, server_default="AND"),
    )
    op.add_column(
        "ged_rules",
        sa.Column(
            "stop_on_first_match",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "ged_rules",
        sa.Column("dry_run", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # --- Fix JSONB defaults: ensure existing rows default to [] not {} ---
    op.execute(
        "UPDATE ged_rules SET conditions = '[]'::jsonb WHERE jsonb_typeof(conditions) = 'object' AND conditions = '{}'::jsonb"
    )
    op.execute(
        "UPDATE ged_rules SET actions    = '[]'::jsonb WHERE jsonb_typeof(actions)    = 'object' AND actions    = '{}'::jsonb"
    )

    # --- Fix priority index: drop old DESC, create plain ASC ---
    op.drop_index("idx_rules_priority", table_name="ged_rules", if_exists=True)
    op.create_index("idx_rules_priority", "ged_rules", ["tenant_id", "priority"])


def downgrade() -> None:
    op.drop_column("ged_rules", "operator")
    op.drop_column("ged_rules", "stop_on_first_match")
    op.drop_column("ged_rules", "dry_run")

    # Restore old DESC index
    op.drop_index("idx_rules_priority", table_name="ged_rules", if_exists=True)
    op.create_index(
        "idx_rules_priority",
        "ged_rules",
        ["tenant_id", "priority"],
        postgresql_ops={"priority": "DESC"},
    )
