"""add authz policy version table

Revision ID: d2f4e6a8b901
Revises: a9c1e7b5f302
Create Date: 2026-04-17 23:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d2f4e6a8b901"
down_revision: Union[str, Sequence[str], None] = "a9c1e7b5f302"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "authz_policy_version",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("version", sa.BigInteger(), nullable=False, server_default="1"),
        sa.CheckConstraint("id = 1", name="ck_authz_policy_version_singleton_id"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(sa.text("INSERT INTO authz_policy_version (id, version) VALUES (1, 1)"))


def downgrade() -> None:
    op.drop_table("authz_policy_version")
