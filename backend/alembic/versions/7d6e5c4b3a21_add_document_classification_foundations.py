"""add document classification foundations

Revision ID: 7d6e5c4b3a21
Revises: 3548fd8f022c
Create Date: 2026-04-27 17:05:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "7d6e5c4b3a21"
down_revision: Union[str, Sequence[str], None] = "3548fd8f022c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "classification_domains",
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id",
            "code",
            name="uq_classification_domains_tenant_code",
        ),
    )
    op.create_index(
        "idx_classification_domains_tenant_active",
        "classification_domains",
        ["tenant_id", "is_active"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_domains_tenant_id"),
        "classification_domains",
        ["tenant_id"],
        unique=False,
    )

    op.create_table(
        "classification_activities",
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("domain_id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["domain_id"], ["classification_domains.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id",
            "domain_id",
            "code",
            name="uq_classification_activities_tenant_domain_code",
        ),
    )
    op.create_index(
        "idx_classification_activities_tenant_domain_active",
        "classification_activities",
        ["tenant_id", "domain_id", "is_active"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_activities_domain_id"),
        "classification_activities",
        ["domain_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_activities_tenant_id"),
        "classification_activities",
        ["tenant_id"],
        unique=False,
    )

    op.create_table(
        "classification_rules",
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column(
            "priority",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("100"),
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "source_scope",
            sa.String(length=30),
            nullable=False,
            server_default="service",
        ),
        sa.Column("source_org_unit_id", sa.UUID(), nullable=True),
        sa.Column("source_user_id", sa.UUID(), nullable=True),
        sa.Column("document_category_id", sa.UUID(), nullable=True),
        sa.Column("filename_pattern", sa.String(length=255), nullable=True),
        sa.Column("mime_type_pattern", sa.String(length=100), nullable=True),
        sa.Column("target_scope", sa.String(length=30), nullable=False),
        sa.Column("target_org_unit_id", sa.UUID(), nullable=True),
        sa.Column("target_user_id", sa.UUID(), nullable=True),
        sa.Column("domain_id", sa.UUID(), nullable=True),
        sa.Column("activity_id", sa.UUID(), nullable=True),
        sa.Column(
            "year_strategy",
            sa.String(length=20),
            nullable=False,
            server_default="current",
        ),
        sa.Column("fixed_year", sa.Integer(), nullable=True),
        sa.Column("workflow_template_id", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "priority >= 0",
            name="check_classification_rules_priority",
        ),
        sa.CheckConstraint(
            "source_scope IN ('person', 'service', 'subdirectorate')",
            name="check_classification_rules_source_scope",
        ),
        sa.CheckConstraint(
            "target_scope IN ('person', 'service', 'subdirectorate', 'directorate')",
            name="check_classification_rules_target_scope",
        ),
        sa.CheckConstraint(
            "year_strategy IN ('current', 'from_filename', 'from_metadata', 'fixed')",
            name="check_classification_rules_year_strategy",
        ),
        sa.ForeignKeyConstraint(
            ["activity_id"],
            ["classification_activities.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["document_category_id"],
            ["document_categories.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["domain_id"],
            ["classification_domains.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["source_org_unit_id"],
            ["org_units.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["source_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["target_org_unit_id"],
            ["org_units.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["target_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["workflow_template_id"],
            ["workflow_templates.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id",
            "code",
            name="uq_classification_rules_tenant_code",
        ),
    )
    op.create_index(
        "idx_classification_rules_source_org_unit",
        "classification_rules",
        ["tenant_id", "source_org_unit_id", "is_active"],
        unique=False,
    )
    op.create_index(
        "idx_classification_rules_tenant_priority",
        "classification_rules",
        ["tenant_id", "priority"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_rules_activity_id"),
        "classification_rules",
        ["activity_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_rules_document_category_id"),
        "classification_rules",
        ["document_category_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_rules_domain_id"),
        "classification_rules",
        ["domain_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_rules_source_org_unit_id"),
        "classification_rules",
        ["source_org_unit_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_rules_source_user_id"),
        "classification_rules",
        ["source_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_rules_target_org_unit_id"),
        "classification_rules",
        ["target_org_unit_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_rules_target_user_id"),
        "classification_rules",
        ["target_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_rules_tenant_id"),
        "classification_rules",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_rules_workflow_template_id"),
        "classification_rules",
        ["workflow_template_id"],
        unique=False,
    )

    op.add_column(
        "documents",
        sa.Column("classification_domain_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("classification_activity_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("classification_year", sa.Integer(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column(
            "classification_scope",
            sa.String(length=30),
            nullable=False,
            server_default="service",
        ),
    )
    op.add_column(
        "documents",
        sa.Column("classification_target_org_unit_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("classification_target_user_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column(
            "classification_status",
            sa.String(length=30),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column("documents", sa.Column("logical_space_path", sa.String(length=1000)))
    op.add_column(
        "documents",
        sa.Column("source_relative_path", sa.String(length=1000), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_documents_classification_domain_id_classification_domains"),
        "documents",
        "classification_domains",
        ["classification_domain_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        op.f("fk_documents_classification_activity_id_classification_activities"),
        "documents",
        "classification_activities",
        ["classification_activity_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        op.f("fk_documents_classification_target_org_unit_id_org_units"),
        "documents",
        "org_units",
        ["classification_target_org_unit_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        op.f("fk_documents_classification_target_user_id_users"),
        "documents",
        "users",
        ["classification_target_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "idx_documents_classification_domain_activity",
        "documents",
        ["tenant_id", "classification_domain_id", "classification_activity_id"],
        unique=False,
    )
    op.create_index(
        "idx_documents_classification_status",
        "documents",
        ["tenant_id", "classification_status"],
        unique=False,
    )
    op.create_index(
        "idx_documents_classification_target_year",
        "documents",
        ["tenant_id", "classification_target_org_unit_id", "classification_year"],
        unique=False,
    )
    op.create_index(
        op.f("ix_documents_classification_activity_id"),
        "documents",
        ["classification_activity_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_documents_classification_domain_id"),
        "documents",
        ["classification_domain_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_documents_classification_target_org_unit_id"),
        "documents",
        ["classification_target_org_unit_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_documents_classification_target_user_id"),
        "documents",
        ["classification_target_user_id"],
        unique=False,
    )
    op.create_check_constraint(
        "check_documents_classification_scope",
        "documents",
        "classification_scope IN ('person', 'service', 'subdirectorate', 'directorate')",
    )
    op.create_check_constraint(
        "check_documents_classification_status",
        "documents",
        "classification_status IN ('pending', 'classified', 'needs_review', 'rejected')",
    )
    op.create_check_constraint(
        "check_documents_classification_target_consistency",
        "documents",
        "("
        "classification_scope = 'person' AND classification_target_user_id IS NOT NULL"
        ") OR ("
        "classification_scope IN ('service', 'subdirectorate', 'directorate') "
        "AND classification_target_org_unit_id IS NOT NULL"
        ") OR ("
        "classification_target_user_id IS NULL "
        "AND classification_target_org_unit_id IS NULL"
        ")",
    )


def downgrade() -> None:
    op.drop_constraint(
        "check_documents_classification_target_consistency",
        "documents",
        type_="check",
    )
    op.drop_constraint(
        "check_documents_classification_status",
        "documents",
        type_="check",
    )
    op.drop_constraint(
        "check_documents_classification_scope",
        "documents",
        type_="check",
    )
    op.drop_index(
        op.f("ix_documents_classification_target_user_id"),
        table_name="documents",
    )
    op.drop_index(
        op.f("ix_documents_classification_target_org_unit_id"),
        table_name="documents",
    )
    op.drop_index(op.f("ix_documents_classification_domain_id"), table_name="documents")
    op.drop_index(
        op.f("ix_documents_classification_activity_id"),
        table_name="documents",
    )
    op.drop_index("idx_documents_classification_target_year", table_name="documents")
    op.drop_index("idx_documents_classification_status", table_name="documents")
    op.drop_index(
        "idx_documents_classification_domain_activity",
        table_name="documents",
    )
    op.drop_constraint(
        op.f("fk_documents_classification_target_user_id_users"),
        "documents",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_documents_classification_target_org_unit_id_org_units"),
        "documents",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_documents_classification_activity_id_classification_activities"),
        "documents",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_documents_classification_domain_id_classification_domains"),
        "documents",
        type_="foreignkey",
    )
    op.drop_column("documents", "source_relative_path")
    op.drop_column("documents", "logical_space_path")
    op.drop_column("documents", "classification_status")
    op.drop_column("documents", "classification_target_user_id")
    op.drop_column("documents", "classification_target_org_unit_id")
    op.drop_column("documents", "classification_scope")
    op.drop_column("documents", "classification_year")
    op.drop_column("documents", "classification_activity_id")
    op.drop_column("documents", "classification_domain_id")

    op.drop_index(
        op.f("ix_classification_rules_workflow_template_id"),
        table_name="classification_rules",
    )
    op.drop_index(
        op.f("ix_classification_rules_tenant_id"),
        table_name="classification_rules",
    )
    op.drop_index(
        op.f("ix_classification_rules_target_user_id"),
        table_name="classification_rules",
    )
    op.drop_index(
        op.f("ix_classification_rules_target_org_unit_id"),
        table_name="classification_rules",
    )
    op.drop_index(
        op.f("ix_classification_rules_source_user_id"),
        table_name="classification_rules",
    )
    op.drop_index(
        op.f("ix_classification_rules_source_org_unit_id"),
        table_name="classification_rules",
    )
    op.drop_index(
        op.f("ix_classification_rules_domain_id"), table_name="classification_rules"
    )
    op.drop_index(
        op.f("ix_classification_rules_document_category_id"),
        table_name="classification_rules",
    )
    op.drop_index(
        op.f("ix_classification_rules_activity_id"),
        table_name="classification_rules",
    )
    op.drop_index(
        "idx_classification_rules_tenant_priority",
        table_name="classification_rules",
    )
    op.drop_index(
        "idx_classification_rules_source_org_unit",
        table_name="classification_rules",
    )
    op.drop_table("classification_rules")

    op.drop_index(
        op.f("ix_classification_activities_tenant_id"),
        table_name="classification_activities",
    )
    op.drop_index(
        op.f("ix_classification_activities_domain_id"),
        table_name="classification_activities",
    )
    op.drop_index(
        "idx_classification_activities_tenant_domain_active",
        table_name="classification_activities",
    )
    op.drop_table("classification_activities")

    op.drop_index(
        op.f("ix_classification_domains_tenant_id"),
        table_name="classification_domains",
    )
    op.drop_index(
        "idx_classification_domains_tenant_active",
        table_name="classification_domains",
    )
    op.drop_table("classification_domains")
