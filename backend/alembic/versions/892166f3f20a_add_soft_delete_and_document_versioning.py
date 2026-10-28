"""Add soft delete and document versioning

Revision ID: 892166f3f20a
Revises: a1b2c3d4e5fa
Create Date: 2026-04-14 02:13:32.675078

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "892166f3f20a"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5fa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "document_versions",
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("version_number", sa.String(length=20), nullable=False),
        sa.Column("file_path", sa.String(length=1000), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("mime_type", sa.String(length=100), nullable=True),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=True),
        sa.Column("uploaded_by_id", sa.UUID(), nullable=True),
        sa.Column("uploaded_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("change_note", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_document_versions_document_id"),
        "document_versions",
        ["document_id"],
        unique=False,
    )
    op.create_index(
        "ix_document_versions_checksum",
        "document_versions",
        ["checksum_sha256"],
        unique=False,
    )

    # These indexes have different provenance across legacy/fresh schemas.
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

    op.add_column(
        "documents", sa.Column("current_version_id", sa.UUID(), nullable=True)
    )
    op.add_column(
        "documents", sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True)
    )
    op.add_column("documents", sa.Column("deleted_by", sa.UUID(), nullable=True))

    op.drop_index("idx_documents_created", table_name="documents", if_exists=True)
    op.create_index(
        "idx_documents_created",
        "documents",
        ["created_at"],
        unique=False,
        postgresql_ops={"created_at": "DESC"},
    )
    op.create_index("idx_documents_deleted", "documents", ["deleted_at"], unique=False)
    op.create_foreign_key(
        None, "documents", "users", ["deleted_by"], ["id"], ondelete="SET NULL"
    )
    op.create_foreign_key(
        "fk_doc_current_version",
        "documents",
        "document_versions",
        ["current_version_id"],
        ["id"],
        use_alter=True,
    )

    # current_version only exists on some historical schemas.
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS current_version")
    op.alter_column("ged_rules", "priority", existing_type=sa.INTEGER(), nullable=False)
    op.drop_index("ix_users_matricule", table_name="users", if_exists=True)
    op.create_index(op.f("ix_users_matricule"), "users", ["matricule"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_users_matricule"), table_name="users", if_exists=True)
    op.create_index("ix_users_matricule", "users", ["matricule"], unique=True)
    op.alter_column("ged_rules", "priority", existing_type=sa.INTEGER(), nullable=True)

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    document_columns = {col["name"] for col in inspector.get_columns("documents")}
    if "current_version" not in document_columns:
        op.add_column(
            "documents",
            sa.Column(
                "current_version", sa.VARCHAR(length=20), autoincrement=False, nullable=True
            ),
        )

    op.execute("ALTER TABLE documents DROP CONSTRAINT IF EXISTS fk_doc_current_version")
    # The deleted_by FK was auto-named originally, so find/drop it defensively.
    inspector = sa.inspect(bind)
    for fk in inspector.get_foreign_keys("documents"):
        if fk.get("constrained_columns") == ["deleted_by"] and fk.get("name"):
            op.execute(f'ALTER TABLE documents DROP CONSTRAINT IF EXISTS "{fk["name"]}"')

    op.drop_index("idx_documents_deleted", table_name="documents", if_exists=True)
    op.drop_index("idx_documents_created", table_name="documents", if_exists=True)
    op.create_index(
        "idx_documents_created", "documents", [sa.text("created_at DESC")], unique=False
    )
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS deleted_by")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS deleted_at")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS current_version_id")

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
        op.f("ix_document_versions_document_id"),
        table_name="document_versions",
        if_exists=True,
    )
    op.execute("DROP TABLE IF EXISTS document_versions")
