"""add casbin rule table

Revision ID: a9c1e7b5f302
Revises: f1a2b3c4d5e6
Create Date: 2026-04-17 18:15:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a9c1e7b5f302"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "casbin_rule",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("ptype", sa.String(length=255), nullable=False),
        sa.Column("v0", sa.String(length=255), nullable=True),
        sa.Column("v1", sa.String(length=255), nullable=True),
        sa.Column("v2", sa.String(length=255), nullable=True),
        sa.Column("v3", sa.String(length=255), nullable=True),
        sa.Column("v4", sa.String(length=255), nullable=True),
        sa.Column("v5", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "ptype",
            "v0",
            "v1",
            "v2",
            "v3",
            "v4",
            "v5",
            name="uq_casbin_rule_all_fields",
        ),
    )
    op.create_index("idx_casbin_rule_ptype", "casbin_rule", ["ptype"], unique=False)
    op.create_index(
        "idx_casbin_rule_v0_v1_v2", "casbin_rule", ["v0", "v1", "v2"], unique=False
    )


def downgrade() -> None:
    op.drop_index("idx_casbin_rule_v0_v1_v2", table_name="casbin_rule")
    op.drop_index("idx_casbin_rule_ptype", table_name="casbin_rule")
    op.drop_table("casbin_rule")
