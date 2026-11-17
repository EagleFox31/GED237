"""user totp

Revision ID: d4e8b2c6a1f3
Revises: a7c8d9e0f1b2
Create Date: 2026-11-17

Authenticator app of a user (post-rc1 lot 4). New table only: no existing data
touched. Nothing reads it while AUTH_TOTP_ENABLED is off.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "d4e8b2c6a1f3"
down_revision = "a7c8d9e0f1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_totp",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("secret_encrypted", sa.Text(), nullable=False),
        sa.Column("confirmed_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("last_used_step", sa.BigInteger()),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_user_totp_tenant_id", "user_totp", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_user_totp_tenant_id", table_name="user_totp")
    op.drop_table("user_totp")
