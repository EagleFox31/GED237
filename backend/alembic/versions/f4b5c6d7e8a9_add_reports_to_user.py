"""add reports_to_user_id to users (N+1 hierarchy)

Revision ID: f4b5c6d7e8a9
Revises: e3a1b2c4d5f7
Create Date: 2026-04-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f4b5c6d7e8a9"
down_revision: Union[str, Sequence[str], None] = "e3a1b2c4d5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "reports_to_user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_users_reports_to_user_id",
        "users",
        "users",
        ["reports_to_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_users_reports_to_user_id", "users", ["reports_to_user_id"])


def downgrade() -> None:
    op.drop_index("ix_users_reports_to_user_id", table_name="users")
    op.drop_constraint("fk_users_reports_to_user_id", "users", type_="foreignkey")
    op.drop_column("users", "reports_to_user_id")
