"""add processing_mode to documents

Revision ID: a1b2c3d4e5f6
Revises: f4b5c6d7e8a9
Create Date: 2026-04-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f4b5c6d7e8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column(
            "processing_mode",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'process'"),
        ),
    )
    op.create_check_constraint(
        "check_valid_processing_mode",
        "documents",
        "processing_mode IN ('archive', 'process')",
    )


def downgrade() -> None:
    op.drop_constraint("check_valid_processing_mode", "documents", type_="check")
    op.drop_column("documents", "processing_mode")
