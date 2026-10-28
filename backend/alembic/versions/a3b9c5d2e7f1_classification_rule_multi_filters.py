"""classification rule multi filters

Adds JSON list columns to classification_rules so a single rule can target
multiple document categories, source org units and source users in OR mode,
while keeping the legacy single FK columns for backward compatibility.

Revision ID: a3b9c5d2e7f1
Revises: f8e9d7c6b5a4
Create Date: 2026-05-03 09:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "a3b9c5d2e7f1"
down_revision: Union[str, Sequence[str], None] = "f8e9d7c6b5a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "classification_rules",
        sa.Column(
            "document_category_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "classification_rules",
        sa.Column(
            "source_org_unit_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "classification_rules",
        sa.Column(
            "source_user_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("classification_rules", "source_user_ids")
    op.drop_column("classification_rules", "source_org_unit_ids")
    op.drop_column("classification_rules", "document_category_ids")
