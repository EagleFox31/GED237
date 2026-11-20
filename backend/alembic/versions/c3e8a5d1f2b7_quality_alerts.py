"""quality alerts

Revision ID: c3e8a5d1f2b7
Revises: b9d4e2f7a1c3
Create Date: 2026-11-17

Two new tables for alerts on the documentary quality indicators (post-rc1 lot 9,
second part): ``quality_alert_rules`` and ``quality_alert_events`` (one open event
per rule at most). Additive only: no existing table or row is touched.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c3e8a5d1f2b7"
down_revision = "b9d4e2f7a1c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quality_alert_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("indicator", sa.String(32), nullable=False),
        sa.Column("measure", sa.String(8), nullable=False),
        sa.Column("threshold", sa.Float(), nullable=False),
        sa.Column(
            "scope",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "created_at", sa.TIMESTAMP(), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index(
        "ix_quality_alert_rules_tenant", "quality_alert_rules", ["tenant_id"]
    )
    op.create_table(
        "quality_alert_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "rule_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("quality_alert_rules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column(
            "opened_at", sa.TIMESTAMP(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("cleared_at", sa.TIMESTAMP()),
    )
    op.create_index(
        "uq_quality_alert_events_open",
        "quality_alert_events",
        ["rule_id"],
        unique=True,
        postgresql_where=sa.text("cleared_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_quality_alert_events_open", table_name="quality_alert_events")
    op.drop_table("quality_alert_events")
    op.drop_index("ix_quality_alert_rules_tenant", table_name="quality_alert_rules")
    op.drop_table("quality_alert_rules")
