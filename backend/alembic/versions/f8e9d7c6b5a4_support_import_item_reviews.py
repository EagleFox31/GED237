"""support import item backed classification reviews

Revision ID: f8e9d7c6b5a4
Revises: c4f8b2a19d3e
Create Date: 2026-04-30 12:30:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f8e9d7c6b5a4"
down_revision: Union[str, Sequence[str], None] = "c4f8b2a19d3e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("classification_reviews", "document_id", nullable=True)
    op.add_column(
        "classification_reviews",
        sa.Column("import_job_item_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_classification_reviews_import_job_item_id",
        "classification_reviews",
        "import_job_items",
        ["import_job_item_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_classification_reviews_import_job_item_id"),
        "classification_reviews",
        ["import_job_item_id"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_classification_reviews_import_job_item_id",
        "classification_reviews",
        ["import_job_item_id"],
    )
    op.create_check_constraint(
        "check_classification_reviews_has_target",
        "classification_reviews",
        "(document_id IS NOT NULL) OR (import_job_item_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "check_classification_reviews_has_target",
        "classification_reviews",
        type_="check",
    )
    op.drop_constraint(
        "uq_classification_reviews_import_job_item_id",
        "classification_reviews",
        type_="unique",
    )
    op.drop_index(
        op.f("ix_classification_reviews_import_job_item_id"),
        table_name="classification_reviews",
    )
    op.drop_constraint(
        "fk_classification_reviews_import_job_item_id",
        "classification_reviews",
        type_="foreignkey",
    )
    op.drop_column("classification_reviews", "import_job_item_id")
    op.alter_column("classification_reviews", "document_id", nullable=False)
