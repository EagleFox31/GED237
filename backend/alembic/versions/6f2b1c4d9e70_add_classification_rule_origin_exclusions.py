"""add classification rule origin exclusions

Revision ID: 6f2b1c4d9e70
Revises: a3b9c5d2e7f1
Create Date: 2026-05-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "6f2b1c4d9e70"
down_revision = "a3b9c5d2e7f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "classification_rules",
        sa.Column("source_org_unit_excluded_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("classification_rules", "source_org_unit_excluded_ids")
