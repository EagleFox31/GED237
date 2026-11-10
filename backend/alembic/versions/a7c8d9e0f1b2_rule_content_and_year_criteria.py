"""rule content and year criteria

Revision ID: a7c8d9e0f1b2
Revises: f0a1b2c3d4e5
Create Date: 2026-11-10

Two optional criteria on classification rules (V1.1 lot 4): keywords looked for in
the OCR text (``content_pattern``) and an inclusive range on the document year
(``year_min`` / ``year_max``). Nullable columns, no data to migrate: an empty
criterion is inactive, so existing rules behave exactly as before.
"""

import sqlalchemy as sa
from alembic import op

revision = "a7c8d9e0f1b2"
down_revision = "f0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("classification_rules", sa.Column("content_pattern", sa.String(255)))
    op.add_column("classification_rules", sa.Column("year_min", sa.Integer()))
    op.add_column("classification_rules", sa.Column("year_max", sa.Integer()))


def downgrade() -> None:
    op.drop_column("classification_rules", "year_max")
    op.drop_column("classification_rules", "year_min")
    op.drop_column("classification_rules", "content_pattern")
