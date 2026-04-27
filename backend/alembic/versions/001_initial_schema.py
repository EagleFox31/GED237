"""Initial database schema

Revision ID: 001
Revises:
Create Date: 2026-02-02

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create tenants table
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("short_name", sa.String(length=50), nullable=True),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("domain", sa.String(length=100), nullable=True),
        sa.Column("settings", postgresql.JSONB(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("domain"),
    )

    # Create roles table
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("hierarchy_level", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("permissions", postgresql.JSONB(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(
        "idx_roles_hierarchy_level", "roles", ["hierarchy_level"], unique=False
    )

    # Insert default roles
    op.execute("""
        INSERT INTO roles (code, label, hierarchy_level, permissions) VALUES
        ('SUPER_ADMIN', 'Super Administrateur', 1, '["*"]'),
        ('TENANT_ADMIN', 'Administrateur Ministère', 2, '["tenant.*", "org.*", "users.*"]'),
        ('UNIT_ADMIN', 'Chef de Service', 3, '["unit.*", "documents.*", "users.read"]'),
        ('MANAGER', 'Manager / Valideur', 4, '["documents.validate", "documents.read", "workflows.*"]'),
        ('COLLABORATOR', 'Collaborateur', 5, '["documents.create", "documents.read", "documents.update"]'),
        ('READER', 'Lecteur', 6, '["documents.read"]'),
        ('AUDITOR', 'Auditeur', 3, '["audit.*", "documents.read", "logs.read"]')
    """)

    # Create org_unit_types table
    op.create_table(
        "org_unit_types",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(
        "idx_org_unit_type_level_code", "org_unit_types", ["level", "code"], unique=True
    )

    # Insert default org unit types
    op.execute("""
        INSERT INTO org_unit_types (code, label, level) VALUES
        ('MINISTRY', 'Ministère', 1),
        ('SEC_GEN', 'Secrétariat Général', 2),
        ('DIRECTION', 'Direction', 2),
        ('DEPARTMENT', 'Département', 3),
        ('SERVICE', 'Service', 4),
        ('BUREAU', 'Bureau', 5),
        ('CELLULE', 'Cellule', 5)
    """)

    # Create org_units table
    op.create_table(
        "org_units",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("short_name", sa.String(length=100), nullable=True),
        sa.Column("type_id", sa.Integer(), nullable=True),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("path", sa.String(length=1000), nullable=True),
        sa.Column("extra_data", postgresql.JSONB(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
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
        sa.CheckConstraint("level > 0", name="check_level_positive"),
        sa.CheckConstraint(
            "(parent_id IS NULL AND level = 1) OR (parent_id IS NOT NULL AND level > 1)",
            name="check_parent_level_consistency",
        ),
        sa.ForeignKeyConstraint(["parent_id"], ["org_units.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["type_id"], ["org_unit_types.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_org_units_tenant_code", "org_units", ["tenant_id", "code"], unique=True
    )
    op.create_index("idx_org_units_parent", "org_units", ["parent_id"])
    op.create_index("idx_org_units_level", "org_units", ["tenant_id", "level"])
    op.create_index("idx_org_units_tenant", "org_units", ["tenant_id"])

    # Create org_unit_closure table
    op.create_table(
        "org_unit_closure",
        sa.Column("ancestor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("descendant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("depth", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["ancestor_id"], ["org_units.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["descendant_id"], ["org_units.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("ancestor_id", "descendant_id"),
    )
    op.create_index(
        "idx_closure_ancestor", "org_unit_closure", ["ancestor_id", "depth"]
    )
    op.create_index("idx_closure_descendant", "org_unit_closure", ["descendant_id"])

    # Create users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_unit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("matricule", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("first_name", sa.String(length=100), nullable=True),
        sa.Column("last_name", sa.String(length=100), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("mfa_secret", sa.String(length=100), nullable=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("profile_data", postgresql.JSONB(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("last_login", sa.TIMESTAMP(), nullable=True),
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
        sa.ForeignKeyConstraint(["org_unit_id"], ["org_units.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_users_tenant_matricule", "users", ["tenant_id", "matricule"], unique=True
    )
    op.create_index("idx_users_email", "users", ["email"], unique=True)
    op.create_index("idx_users_tenant", "users", ["tenant_id"])
    op.create_index("idx_users_org_unit", "users", ["org_unit_id"])
    op.create_index("idx_users_role", "users", ["role_id"])

    # Create documents table
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_unit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("file_path", sa.String(length=1000), nullable=False),
        sa.Column("file_type", sa.String(length=50), nullable=True),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("mime_type", sa.String(length=100), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("current_version", sa.String(length=20), nullable=True),
        sa.Column("ocr_content", sa.Text(), nullable=True),
        sa.Column("ocr_content_vector", postgresql.TSVECTOR(), nullable=True),
        sa.Column("extra_data", postgresql.JSONB(), nullable=True),
        sa.Column("archived_at", sa.TIMESTAMP(), nullable=True),
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
        sa.CheckConstraint(
            "status IN ('draft', 'in_review', 'validated', 'signed', 'archived', 'rejected')",
            name="check_valid_status",
        ),
        sa.ForeignKeyConstraint(["org_unit_id"], ["org_units.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_documents_tenant", "documents", ["tenant_id"])
    op.create_index("idx_documents_org_unit", "documents", ["org_unit_id"])
    op.create_index("idx_documents_owner", "documents", ["owner_id"])
    op.create_index("idx_documents_status", "documents", ["tenant_id", "status"])
    op.create_index(
        "idx_documents_created",
        "documents",
        ["created_at"],
        postgresql_ops={"created_at": "DESC"},
    )
    op.create_index(
        "idx_documents_ocr_vector",
        "documents",
        ["ocr_content_vector"],
        postgresql_using="gin",
    )

    # Create workflow_steps table
    op.create_table(
        "workflow_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("completed_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending', 'current', 'completed', 'rejected')",
            name="check_valid_workflow_status",
        ),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_workflow_document", "workflow_steps", ["document_id", "step_order"]
    )
    op.create_index(
        "idx_workflow_assigned", "workflow_steps", ["assigned_to", "status"]
    )

    # Create ged_rules table
    op.create_table(
        "ged_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("trigger_type", sa.String(length=50), nullable=False),
        sa.Column("conditions", postgresql.JSONB(), nullable=False),
        sa.Column("actions", postgresql.JSONB(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
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
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_rules_tenant_active", "ged_rules", ["tenant_id", "is_active"])
    op.create_index(
        "idx_rules_priority",
        "ged_rules",
        ["tenant_id", "priority"],
        postgresql_ops={"priority": "DESC"},
    )

    # Create audit_logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("table_name", sa.String(length=100), nullable=False),
        sa.Column("record_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("old_data", postgresql.JSONB(), nullable=True),
        sa.Column("new_data", postgresql.JSONB(), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_audit_tenant_created",
        "audit_logs",
        ["tenant_id", "created_at"],
        postgresql_ops={"created_at": "DESC"},
    )
    op.create_index(
        "idx_audit_user_created",
        "audit_logs",
        ["user_id", "created_at"],
        postgresql_ops={"created_at": "DESC"},
    )
    op.create_index("idx_audit_table_record", "audit_logs", ["table_name", "record_id"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("ged_rules")
    op.drop_table("workflow_steps")
    op.drop_table("documents")
    op.drop_table("users")
    op.drop_table("org_unit_closure")
    op.drop_table("org_units")
    op.drop_table("org_unit_types")
    op.drop_table("roles")
    op.drop_table("tenants")
