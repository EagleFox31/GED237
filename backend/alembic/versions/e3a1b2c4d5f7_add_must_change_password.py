"""add must_change_password to users

Revision ID: e3a1b2c4d5f7
Revises: d2f4e6a8b901
Create Date: 2026-04-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e3a1b2c4d5f7"
down_revision: Union[str, Sequence[str], None] = "d2f4e6a8b901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "must_change_password")
