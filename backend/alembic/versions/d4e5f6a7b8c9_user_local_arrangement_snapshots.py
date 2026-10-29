"""user_local_arrangement_snapshots

Revision ID: d4e5f6a7b8c9
Revises: c9e8d7a4b210
Create Date: 2026-05-10

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "d4e5f6a7b8c9"
down_revision = "c9e8d7a4b210"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_local_arrangement_snapshots",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index(
        "idx_ul_snapshots_tenant_updated",
        "user_local_arrangement_snapshots",
        ["tenant_id", "updated_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_ul_snapshots_tenant_updated", table_name="user_local_arrangement_snapshots"
    )
    op.drop_table("user_local_arrangement_snapshots")
