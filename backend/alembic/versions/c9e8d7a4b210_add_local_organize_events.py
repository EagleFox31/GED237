"""add local_organize_events

Revision ID: c9e8d7a4b210
Revises: 6f2b1c4d9e70
Create Date: 2026-05-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "c9e8d7a4b210"
down_revision = "6f2b1c4d9e70"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "local_organize_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("file_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("folders_created", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("files_unranged", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("strategy", sa.String(length=32), nullable=False),
        sa.Column("mode", sa.String(length=8), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_local_organize_events_tenant_id",
        "local_organize_events",
        ["tenant_id"],
    )
    op.create_index(
        "ix_local_organize_events_user_id",
        "local_organize_events",
        ["user_id"],
    )
    op.create_index(
        "idx_local_org_tenant_created",
        "local_organize_events",
        ["tenant_id", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("idx_local_org_tenant_created", table_name="local_organize_events")
    op.drop_index("ix_local_organize_events_user_id", table_name="local_organize_events")
    op.drop_index("ix_local_organize_events_tenant_id", table_name="local_organize_events")
    op.drop_table("local_organize_events")
