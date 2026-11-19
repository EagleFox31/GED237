"""backup runs

Revision ID: c9f2a7d4e1b6
Revises: a7c8d9e0f1b2
Create Date: 2026-11-17

Scheduled backup (post-rc1 lot 13): one row per local day. New table only, no
existing data touched.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c9f2a7d4e1b6"
down_revision = "a7c8d9e0f1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "backup_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slot", sa.Date(), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "started_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("finished_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("path", sa.String(255)),
        sa.Column("size_bytes", sa.BigInteger()),
        sa.Column("error", sa.String(500)),
        sa.Column("pruned_at", sa.TIMESTAMP(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("backup_runs")
