"""ingestion sources

Revision ID: b8d9e0f1a2c3
Revises: a7c8d9e0f1b2
Create Date: 2026-11-20

F-NEXT-01: the places a tenant collects documents from (a server folder, a
mounted network share, a workstation agent), with the last run's counts. A new
table, no data to migrate: the folders watched through INGEST_WATCH_FOLDERS keep
working as before.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "b8d9e0f1a2c3"
down_revision = "a7c8d9e0f1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ingestion_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("source_type", sa.String(length=16), nullable=False),
        sa.Column("path", sa.String(length=1024), nullable=True),
        sa.Column("credentials_ref", sa.String(length=128), nullable=True),
        sa.Column("agent_key_hash", sa.String(length=64), nullable=True),
        sa.Column("agent_key_prefix", sa.String(length=12), nullable=True),
        sa.Column(
            "org_unit_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("org_units.id"),
            nullable=False,
        ),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "document_category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("document_categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("recursive", sa.Boolean(), nullable=False),
        sa.Column("processing_mode", sa.String(length=16), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("last_run_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("last_run_status", sa.String(length=16), nullable=True),
        sa.Column(
            "last_run_report", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "tenant_id", "name", name="uq_ingestion_source_tenant_name"
        ),
        sa.UniqueConstraint(
            "agent_key_hash", name="uq_ingestion_source_agent_key_hash"
        ),
    )
    op.create_index(
        "ix_ingestion_sources_tenant_id", "ingestion_sources", ["tenant_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_ingestion_sources_tenant_id", table_name="ingestion_sources")
    op.drop_table("ingestion_sources")
