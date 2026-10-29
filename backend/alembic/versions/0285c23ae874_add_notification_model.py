"""Add Notification model

Revision ID: 0285c23ae874
Revises: 001
Create Date: 2026-02-28 19:53:08.571096

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0285c23ae874"
down_revision: Union[str, Sequence[str], None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "notifications",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=False),
        sa.Column("channel", sa.String(length=50), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False),
        sa.Column("meta_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_notifications_tenant_user",
        "notifications",
        ["tenant_id", "user_id"],
        unique=False,
    )
    op.create_index(
        "idx_notifications_user_read",
        "notifications",
        ["user_id", "is_read"],
        unique=False,
    )
    op.create_index(
        op.f("ix_notifications_is_read"), "notifications", ["is_read"], unique=False
    )
    op.create_index(
        op.f("ix_notifications_tenant_id"), "notifications", ["tenant_id"], unique=False
    )
    op.create_index(
        op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False
    )

    # The initial schema evolved over time. Generated/legacy indexes are not
    # guaranteed to exist on every valid database, so all removals are guarded.
    op.drop_index("idx_audit_tenant_created", table_name="audit_logs", if_exists=True)
    op.create_index(
        "idx_audit_tenant_created",
        "audit_logs",
        ["tenant_id", "created_at"],
        unique=False,
        postgresql_ops={"created_at": "DESC"},
    )
    op.drop_index("idx_audit_user_created", table_name="audit_logs", if_exists=True)
    op.create_index(
        "idx_audit_user_created",
        "audit_logs",
        ["user_id", "created_at"],
        unique=False,
        postgresql_ops={"created_at": "DESC"},
    )
    op.create_index(
        op.f("ix_audit_logs_tenant_id"), "audit_logs", ["tenant_id"], unique=False
    )
    op.create_index(
        op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"], unique=False
    )

    op.drop_index("idx_documents_created", table_name="documents", if_exists=True)
    op.create_index(
        "idx_documents_created",
        "documents",
        ["created_at"],
        unique=False,
        postgresql_ops={"created_at": "DESC"},
    )
    op.create_index(
        op.f("ix_documents_org_unit_id"), "documents", ["org_unit_id"], unique=False
    )
    op.create_index(
        op.f("ix_documents_owner_id"), "documents", ["owner_id"], unique=False
    )
    op.create_index(
        op.f("ix_documents_tenant_id"), "documents", ["tenant_id"], unique=False
    )

    op.drop_index("idx_rules_priority", table_name="ged_rules", if_exists=True)
    op.create_index(
        "idx_rules_priority",
        "ged_rules",
        ["tenant_id", "priority"],
        unique=False,
        postgresql_ops={"priority": "DESC"},
    )
    op.create_index(
        op.f("ix_ged_rules_tenant_id"), "ged_rules", ["tenant_id"], unique=False
    )

    op.drop_index("idx_org_units_tenant", table_name="org_units", if_exists=True)
    op.create_index(
        op.f("ix_org_units_parent_id"), "org_units", ["parent_id"], unique=False
    )
    op.create_index(
        op.f("ix_org_units_tenant_id"), "org_units", ["tenant_id"], unique=False
    )

    op.drop_index("idx_roles_hierarchy_level", table_name="roles", if_exists=True)
    op.create_index(
        op.f("ix_roles_hierarchy_level"), "roles", ["hierarchy_level"], unique=False
    )

    op.drop_index("idx_users_org_unit", table_name="users", if_exists=True)
    op.drop_index("idx_users_role", table_name="users", if_exists=True)
    op.drop_index("idx_users_tenant", table_name="users", if_exists=True)

    # Some legacy databases carried a global uniqueness constraint on matricule,
    # while the intended rule is tenant-scoped. On fresh schemas this is a no-op.
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_matricule_key")

    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_matricule"), "users", ["matricule"], unique=False)
    op.create_index(
        op.f("ix_users_org_unit_id"), "users", ["org_unit_id"], unique=False
    )
    op.create_index(op.f("ix_users_role_id"), "users", ["role_id"], unique=False)
    op.create_index(op.f("ix_users_tenant_id"), "users", ["tenant_id"], unique=False)
    op.create_index(
        op.f("ix_workflow_steps_assigned_to"),
        "workflow_steps",
        ["assigned_to"],
        unique=False,
    )
    op.create_index(
        op.f("ix_workflow_steps_document_id"),
        "workflow_steps",
        ["document_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_workflow_steps_document_id"),
        table_name="workflow_steps",
        if_exists=True,
    )
    op.drop_index(
        op.f("ix_workflow_steps_assigned_to"),
        table_name="workflow_steps",
        if_exists=True,
    )
    op.drop_index(op.f("ix_users_tenant_id"), table_name="users", if_exists=True)
    op.drop_index(op.f("ix_users_role_id"), table_name="users", if_exists=True)
    op.drop_index(op.f("ix_users_org_unit_id"), table_name="users", if_exists=True)
    op.drop_index(op.f("ix_users_matricule"), table_name="users", if_exists=True)
    op.drop_index(op.f("ix_users_email"), table_name="users", if_exists=True)
    op.create_index("idx_users_tenant", "users", ["tenant_id"], unique=False)
    op.create_index("idx_users_role", "users", ["role_id"], unique=False)
    op.create_index("idx_users_org_unit", "users", ["org_unit_id"], unique=False)
    op.drop_index(op.f("ix_roles_hierarchy_level"), table_name="roles", if_exists=True)
    op.create_index(
        "idx_roles_hierarchy_level", "roles", ["hierarchy_level"], unique=False
    )
    op.drop_index(
        op.f("ix_org_units_tenant_id"), table_name="org_units", if_exists=True
    )
    op.drop_index(
        op.f("ix_org_units_parent_id"), table_name="org_units", if_exists=True
    )
    op.create_index("idx_org_units_tenant", "org_units", ["tenant_id"], unique=False)
    op.drop_index(
        op.f("ix_ged_rules_tenant_id"), table_name="ged_rules", if_exists=True
    )
    op.drop_index("idx_rules_priority", table_name="ged_rules", if_exists=True)
    op.create_index(
        "idx_rules_priority",
        "ged_rules",
        ["tenant_id", sa.text("priority DESC")],
        unique=False,
    )
    op.drop_index(
        op.f("ix_documents_tenant_id"), table_name="documents", if_exists=True
    )
    op.drop_index(op.f("ix_documents_owner_id"), table_name="documents", if_exists=True)
    op.drop_index(
        op.f("ix_documents_org_unit_id"), table_name="documents", if_exists=True
    )
    op.drop_index("idx_documents_created", table_name="documents", if_exists=True)
    op.create_index(
        "idx_documents_created", "documents", [sa.text("created_at DESC")], unique=False
    )
    op.drop_index(
        op.f("ix_audit_logs_user_id"), table_name="audit_logs", if_exists=True
    )
    op.drop_index(
        op.f("ix_audit_logs_tenant_id"), table_name="audit_logs", if_exists=True
    )
    op.drop_index("idx_audit_user_created", table_name="audit_logs", if_exists=True)
    op.create_index(
        "idx_audit_user_created",
        "audit_logs",
        ["user_id", sa.text("created_at DESC")],
        unique=False,
    )
    op.drop_index("idx_audit_tenant_created", table_name="audit_logs", if_exists=True)
    op.create_index(
        "idx_audit_tenant_created",
        "audit_logs",
        ["tenant_id", sa.text("created_at DESC")],
        unique=False,
    )
    op.drop_index(
        op.f("ix_notifications_user_id"), table_name="notifications", if_exists=True
    )
    op.drop_index(
        op.f("ix_notifications_tenant_id"), table_name="notifications", if_exists=True
    )
    op.drop_index(
        op.f("ix_notifications_is_read"), table_name="notifications", if_exists=True
    )
    op.drop_index(
        "idx_notifications_user_read", table_name="notifications", if_exists=True
    )
    op.drop_index(
        "idx_notifications_tenant_user", table_name="notifications", if_exists=True
    )
    op.execute("DROP TABLE IF EXISTS notifications")
