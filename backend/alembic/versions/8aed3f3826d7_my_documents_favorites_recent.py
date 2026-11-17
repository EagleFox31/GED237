"""my documents: favourites and recently opened

Revision ID: 8aed3f3826d7
Revises: a7c8d9e0f1b2
Create Date: 2026-11-17

Two new tables, one row per (user, document). Nothing existing is changed.
``document_recent_access`` stays empty while RECENT_DOCUMENTS_TRACKING_ENABLED
is off (the default).
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "8aed3f3826d7"
down_revision = "a7c8d9e0f1b2"
branch_labels = None
depends_on = None


def _key_columns() -> list[sa.Column]:
    return [
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "document_favorites",
        *_key_columns(),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_document_favorites_user_created",
        "document_favorites",
        ["user_id", "created_at"],
    )
    op.create_index(
        "ix_document_favorites_document_id", "document_favorites", ["document_id"]
    )
    op.create_table(
        "document_recent_access",
        *_key_columns(),
        sa.Column(
            "accessed_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("access_count", sa.Integer(), server_default="1", nullable=False),
    )
    op.create_index(
        "ix_document_recent_access_user_accessed",
        "document_recent_access",
        ["user_id", "accessed_at"],
    )
    op.create_index(
        "ix_document_recent_access_document_id",
        "document_recent_access",
        ["document_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_document_recent_access_document_id", table_name="document_recent_access"
    )
    op.drop_index(
        "ix_document_recent_access_user_accessed", table_name="document_recent_access"
    )
    op.drop_table("document_recent_access")
    op.drop_index("ix_document_favorites_document_id", table_name="document_favorites")
    op.drop_index("ix_document_favorites_user_created", table_name="document_favorites")
    op.drop_table("document_favorites")
