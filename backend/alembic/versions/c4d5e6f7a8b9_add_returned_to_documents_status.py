"""add_returned_to_documents_status

Revision ID: c4d5e6f7a8b9
Revises: b7c8d9e0f1a2
Create Date: 2026-04-15

"""

from alembic import op


revision = "c4d5e6f7a8b9"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update check constraint on documents.status to include 'returned'
    op.execute("ALTER TABLE documents DROP CONSTRAINT IF EXISTS check_valid_status")
    op.execute("""
        ALTER TABLE documents
        ADD CONSTRAINT check_valid_status
        CHECK (status IN ('draft', 'in_review', 'validated', 'signed', 'archived', 'rejected', 'returned'))
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE documents DROP CONSTRAINT IF EXISTS check_valid_status")
    op.execute("""
        ALTER TABLE documents
        ADD CONSTRAINT check_valid_status
        CHECK (status IN ('draft', 'in_review', 'validated', 'signed', 'archived', 'rejected'))
    """)
