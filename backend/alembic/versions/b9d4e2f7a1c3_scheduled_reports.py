"""scheduled official reports

Revision ID: b9d4e2f7a1c3
Revises: eff6822a5320
Create Date: 2026-11-17

Two new tables for scheduled official reports (post-rc1 lot 9):
``report_schedules`` and ``report_runs`` (one line per schedule and closed period).
Additive only: no existing table or row is touched.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "b9d4e2f7a1c3"
down_revision = "eff6822a5320"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report_schedules",
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
        sa.Column("frequency", sa.String(16), nullable=False),
        sa.Column(
            "request",
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
    op.create_index("ix_report_schedules_tenant", "report_schedules", ["tenant_id"])
    op.create_table(
        "report_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "schedule_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("report_schedules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("period_key", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column(
            "report_issue_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("report_issues.id", ondelete="SET NULL"),
        ),
        sa.Column("error", sa.String(300)),
        sa.Column(
            "ran_at", sa.TIMESTAMP(), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint(
            "schedule_id", "period_key", name="uq_report_runs_schedule_period"
        ),
    )


def downgrade() -> None:
    op.drop_table("report_runs")
    op.drop_index("ix_report_schedules_tenant", table_name="report_schedules")
    op.drop_table("report_schedules")
