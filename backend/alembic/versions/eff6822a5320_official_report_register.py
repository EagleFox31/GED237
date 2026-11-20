"""official report register

Revision ID: eff6822a5320
Revises: a7c8d9e0f1b2
Create Date: 2026-11-17

Two new tables for numbered official reports (post-rc1 lot 5): ``report_counters``
(last number per institution and year) and ``report_issues`` (one line per copy
issued). Additive only: no existing table or row is touched.
Both tables block the deletion of an institution that has rows (RESTRICT, PO
decision): issued official copies are kept.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "eff6822a5320"
down_revision = "a7c8d9e0f1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report_counters",
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
        sa.Column("year", sa.Integer(), primary_key=True),
        sa.Column("last_value", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "report_issues",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("number", sa.String(80), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("format", sa.String(8), nullable=False),
        sa.Column(
            "filters",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "header",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("content_sha256", sa.String(64), nullable=False),
        sa.Column("file_sha256", sa.String(64), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column(
            "issued_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "issued_at", sa.TIMESTAMP(), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint(
            "tenant_id", "year", "sequence", name="uq_report_issues_tenant_year_seq"
        ),
    )
    op.create_index("ix_report_issues_issued_by", "report_issues", ["issued_by"])
    op.create_index(
        "ix_report_issues_tenant_issued_at", "report_issues", ["tenant_id", "issued_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_report_issues_tenant_issued_at", table_name="report_issues")
    op.drop_index("ix_report_issues_issued_by", table_name="report_issues")
    op.drop_table("report_issues")
    op.drop_table("report_counters")
