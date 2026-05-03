"""add classification reviews

Revision ID: c4f8b2a19d3e
Revises: 9c3f1a2b4d6e
Create Date: 2026-04-29 10:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c4f8b2a19d3e"
down_revision: Union[str, Sequence[str], None] = "9c3f1a2b4d6e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "classification_reviews",
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column(
            "review_status",
            sa.String(length=20),
            nullable=False,
            server_default="open",
        ),
        sa.Column("arbitration_reason", sa.String(length=1000), nullable=True),
        sa.Column("suggested_domain_id", sa.UUID(), nullable=True),
        sa.Column("suggested_activity_id", sa.UUID(), nullable=True),
        sa.Column("suggested_year", sa.Integer(), nullable=True),
        sa.Column("suggested_scope", sa.String(length=30), nullable=True),
        sa.Column("suggested_target_org_unit_id", sa.UUID(), nullable=True),
        sa.Column("suggested_target_user_id", sa.UUID(), nullable=True),
        sa.Column("resolved_by_id", sa.UUID(), nullable=True),
        sa.Column("resolved_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("resolution_comment", sa.String(length=1000), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), nullable=False),
        sa.CheckConstraint(
            "review_status IN ('open', 'resolved', 'cancelled')",
            name="check_classification_reviews_status",
        ),
        sa.CheckConstraint(
            "suggested_scope IS NULL OR suggested_scope IN ('person', 'service', 'subdirectorate', 'directorate')",
            name="check_classification_reviews_scope",
        ),
        sa.ForeignKeyConstraint(
            ["document_id"], ["documents.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["resolved_by_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["suggested_activity_id"],
            ["classification_activities.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["suggested_domain_id"],
            ["classification_domains.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["suggested_target_org_unit_id"], ["org_units.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["suggested_target_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_id", name="uq_classification_reviews_document_id"),
    )
    op.create_index(
        "idx_classification_reviews_tenant_status",
        "classification_reviews",
        ["tenant_id", "review_status", "updated_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_reviews_document_id"),
        "classification_reviews",
        ["document_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_reviews_resolved_by_id"),
        "classification_reviews",
        ["resolved_by_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_reviews_suggested_activity_id"),
        "classification_reviews",
        ["suggested_activity_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_reviews_suggested_domain_id"),
        "classification_reviews",
        ["suggested_domain_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_reviews_suggested_target_org_unit_id"),
        "classification_reviews",
        ["suggested_target_org_unit_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_reviews_suggested_target_user_id"),
        "classification_reviews",
        ["suggested_target_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_classification_reviews_tenant_id"),
        "classification_reviews",
        ["tenant_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_classification_reviews_tenant_id"), table_name="classification_reviews")
    op.drop_index(
        op.f("ix_classification_reviews_suggested_target_user_id"),
        table_name="classification_reviews",
    )
    op.drop_index(
        op.f("ix_classification_reviews_suggested_target_org_unit_id"),
        table_name="classification_reviews",
    )
    op.drop_index(
        op.f("ix_classification_reviews_suggested_domain_id"),
        table_name="classification_reviews",
    )
    op.drop_index(
        op.f("ix_classification_reviews_suggested_activity_id"),
        table_name="classification_reviews",
    )
    op.drop_index(
        op.f("ix_classification_reviews_resolved_by_id"),
        table_name="classification_reviews",
    )
    op.drop_index(op.f("ix_classification_reviews_document_id"), table_name="classification_reviews")
    op.drop_index("idx_classification_reviews_tenant_status", table_name="classification_reviews")
    op.drop_table("classification_reviews")
