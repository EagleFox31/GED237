"""add import jobs and items

Revision ID: 9c3f1a2b4d6e
Revises: 7d6e5c4b3a21
Create Date: 2026-04-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "9c3f1a2b4d6e"
down_revision: Union[str, Sequence[str], None] = "7d6e5c4b3a21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "import_jobs",
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("created_by_id", sa.UUID(), nullable=False),
        sa.Column("source_scope", sa.String(length=30), nullable=False),
        sa.Column("target_org_unit_id", sa.UUID(), nullable=True),
        sa.Column("target_user_id", sa.UUID(), nullable=True),
        sa.Column("default_document_category_id", sa.UUID(), nullable=True),
        sa.Column("forced_year", sa.Integer(), nullable=True),
        sa.Column(
            "processing_mode",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'process'"),
        ),
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default=sa.text("'draft'"),
        ),
        sa.Column("total_files", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("supported_files", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("ignored_files", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("duplicate_files", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("error_files", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["default_document_category_id"], ["document_categories.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["target_org_unit_id"], ["org_units.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "source_scope IN ('person', 'service', 'subdirectorate')",
            name="check_import_jobs_source_scope",
        ),
        sa.CheckConstraint(
            "processing_mode IN ('archive', 'process')",
            name="check_import_jobs_processing_mode",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'analyzed', 'running', 'completed', 'completed_with_errors', 'cancelled')",
            name="check_import_jobs_status",
        ),
        sa.CheckConstraint(
            "(target_user_id IS NOT NULL) OR (target_org_unit_id IS NOT NULL)",
            name="check_import_jobs_has_target",
        ),
    )
    op.create_index("idx_import_jobs_tenant_status", "import_jobs", ["tenant_id", "status"], unique=False)
    op.create_index("idx_import_jobs_creator_status", "import_jobs", ["created_by_id", "status"], unique=False)
    op.create_index(op.f("ix_import_jobs_tenant_id"), "import_jobs", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_import_jobs_created_by_id"), "import_jobs", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_import_jobs_target_org_unit_id"), "import_jobs", ["target_org_unit_id"], unique=False)
    op.create_index(op.f("ix_import_jobs_target_user_id"), "import_jobs", ["target_user_id"], unique=False)
    op.create_index(op.f("ix_import_jobs_default_document_category_id"), "import_jobs", ["default_document_category_id"], unique=False)

    op.add_column(
        "documents",
        sa.Column("import_job_id", sa.UUID(), nullable=True),
    )
    op.create_index(op.f("ix_documents_import_job_id"), "documents", ["import_job_id"], unique=False)
    op.create_foreign_key(
        "fk_documents_import_job_id",
        "documents",
        "import_jobs",
        ["import_job_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "import_job_items",
        sa.Column("import_job_id", sa.UUID(), nullable=False),
        sa.Column("original_filename", sa.String(length=500), nullable=False),
        sa.Column("source_relative_path", sa.String(length=1000), nullable=False),
        sa.Column("staging_file_path", sa.String(length=1000), nullable=True),
        sa.Column("mime_type", sa.String(length=100), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=True),
        sa.Column("detected_document_category_id", sa.UUID(), nullable=True),
        sa.Column("resolved_domain_id", sa.UUID(), nullable=True),
        sa.Column("resolved_activity_id", sa.UUID(), nullable=True),
        sa.Column("resolved_year", sa.Integer(), nullable=True),
        sa.Column("resolved_scope", sa.String(length=30), nullable=True),
        sa.Column("resolved_target_org_unit_id", sa.UUID(), nullable=True),
        sa.Column("resolved_target_user_id", sa.UUID(), nullable=True),
        sa.Column("workflow_template_id", sa.UUID(), nullable=True),
        sa.Column("logical_space_path", sa.String(length=1000), nullable=True),
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("document_id", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["detected_document_category_id"], ["document_categories.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["import_job_id"], ["import_jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resolved_activity_id"], ["classification_activities.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resolved_domain_id"], ["classification_domains.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resolved_target_org_unit_id"], ["org_units.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resolved_target_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["workflow_template_id"], ["workflow_templates.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "status IN ('pending', 'classified', 'needs_review', 'duplicate', 'ignored', 'imported', 'failed')",
            name="check_import_job_items_status",
        ),
        sa.CheckConstraint(
            "resolved_scope IS NULL OR resolved_scope IN ('person', 'service', 'subdirectorate', 'directorate')",
            name="check_import_job_items_resolved_scope",
        ),
    )
    op.create_index("idx_import_job_items_job_status", "import_job_items", ["import_job_id", "status"], unique=False)
    op.create_index(op.f("ix_import_job_items_import_job_id"), "import_job_items", ["import_job_id"], unique=False)
    op.create_index(op.f("ix_import_job_items_checksum_sha256"), "import_job_items", ["checksum_sha256"], unique=False)
    op.create_index(op.f("ix_import_job_items_detected_document_category_id"), "import_job_items", ["detected_document_category_id"], unique=False)
    op.create_index(op.f("ix_import_job_items_resolved_domain_id"), "import_job_items", ["resolved_domain_id"], unique=False)
    op.create_index(op.f("ix_import_job_items_resolved_activity_id"), "import_job_items", ["resolved_activity_id"], unique=False)
    op.create_index(op.f("ix_import_job_items_resolved_target_org_unit_id"), "import_job_items", ["resolved_target_org_unit_id"], unique=False)
    op.create_index(op.f("ix_import_job_items_resolved_target_user_id"), "import_job_items", ["resolved_target_user_id"], unique=False)
    op.create_index(op.f("ix_import_job_items_workflow_template_id"), "import_job_items", ["workflow_template_id"], unique=False)
    op.create_index(op.f("ix_import_job_items_document_id"), "import_job_items", ["document_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_import_job_items_document_id"), table_name="import_job_items")
    op.drop_index(op.f("ix_import_job_items_workflow_template_id"), table_name="import_job_items")
    op.drop_index(op.f("ix_import_job_items_resolved_target_user_id"), table_name="import_job_items")
    op.drop_index(op.f("ix_import_job_items_resolved_target_org_unit_id"), table_name="import_job_items")
    op.drop_index(op.f("ix_import_job_items_resolved_activity_id"), table_name="import_job_items")
    op.drop_index(op.f("ix_import_job_items_resolved_domain_id"), table_name="import_job_items")
    op.drop_index(op.f("ix_import_job_items_detected_document_category_id"), table_name="import_job_items")
    op.drop_index(op.f("ix_import_job_items_checksum_sha256"), table_name="import_job_items")
    op.drop_index(op.f("ix_import_job_items_import_job_id"), table_name="import_job_items")
    op.drop_index("idx_import_job_items_job_status", table_name="import_job_items")
    op.drop_table("import_job_items")

    op.drop_constraint("fk_documents_import_job_id", "documents", type_="foreignkey")
    op.drop_index(op.f("ix_documents_import_job_id"), table_name="documents")
    op.drop_column("documents", "import_job_id")

    op.drop_index(op.f("ix_import_jobs_default_document_category_id"), table_name="import_jobs")
    op.drop_index(op.f("ix_import_jobs_target_user_id"), table_name="import_jobs")
    op.drop_index(op.f("ix_import_jobs_target_org_unit_id"), table_name="import_jobs")
    op.drop_index(op.f("ix_import_jobs_created_by_id"), table_name="import_jobs")
    op.drop_index(op.f("ix_import_jobs_tenant_id"), table_name="import_jobs")
    op.drop_index("idx_import_jobs_creator_status", table_name="import_jobs")
    op.drop_index("idx_import_jobs_tenant_status", table_name="import_jobs")
    op.drop_table("import_jobs")
