"""category_unique_constraint_and_restrict_fk

Revision ID: f1a2b3c4d5e6
Revises: 5c9f45c994cf
Create Date: 2026-04-17 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "5c9f45c994cf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Ajouter la contrainte unique (tenant_id, code) sur document_categories
    op.create_unique_constraint(
        "uq_category_tenant_code", "document_categories", ["tenant_id", "code"]
    )

    # 2. Changer ondelete CASCADE → RESTRICT sur routing_rules.document_category_id
    op.drop_constraint("fk_rules_category", "routing_rules", type_="foreignkey")
    op.create_foreign_key(
        "fk_rules_category",
        "routing_rules",
        "document_categories",
        ["document_category_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    # Remettre CASCADE
    op.drop_constraint("fk_rules_category", "routing_rules", type_="foreignkey")
    op.create_foreign_key(
        "fk_rules_category",
        "routing_rules",
        "document_categories",
        ["document_category_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Supprimer la contrainte unique
    op.drop_constraint("uq_category_tenant_code", "document_categories", type_="unique")
