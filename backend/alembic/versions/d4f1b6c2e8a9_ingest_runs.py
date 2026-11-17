"""ingest runs

Revision ID: d4f1b6c2e8a9
Revises: a7c8d9e0f1b2
Create Date: 2026-11-17

Progress of directory imports, so that an interrupted import resumes (post-rc1
lot 14): ``ingest_runs`` and ``ingest_run_files``. Additive only: no existing
table or row is touched.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "d4f1b6c2e8a9"
down_revision = "a7c8d9e0f1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ingest_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("org_unit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_dir", sa.Text(), nullable=False),
        sa.Column("recursive", sa.Boolean(), nullable=False),
        sa.Column("processing_mode", sa.String(16), nullable=False),
        sa.Column("document_category_id", postgresql.UUID(as_uuid=True)),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column(
            "total_found", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "attempts", sa.Integer(), nullable=False, server_default=sa.text("1")
        ),
        sa.Column(
            "started_at", sa.TIMESTAMP(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("finished_at", sa.TIMESTAMP()),
    )
    op.create_index(
        "ix_ingest_runs_tenant_status", "ingest_runs", ["tenant_id", "status"]
    )
    op.create_table(
        "ingest_run_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ingest_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_path", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
        ),
        sa.Column("error", sa.String(500)),
        sa.Column(
            "updated_at", sa.TIMESTAMP(), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("run_id", "source_path", name="uq_ingest_run_files_path"),
    )


def downgrade() -> None:
    op.drop_table("ingest_run_files")
    op.drop_index("ix_ingest_runs_tenant_status", table_name="ingest_runs")
    op.drop_table("ingest_runs")
