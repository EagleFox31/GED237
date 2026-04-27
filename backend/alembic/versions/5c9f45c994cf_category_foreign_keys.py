"""category_foreign_keys

Revision ID: 5c9f45c994cf
Revises: e47de4581da6
Create Date: 2026-04-17 10:38:12.729325

"""

from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "5c9f45c994cf"
down_revision: Union[str, Sequence[str], None] = "e47de4581da6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Créer la table document_categories
    op.create_table(
        "document_categories",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_document_categories_tenant_id"),
        "document_categories",
        ["tenant_id"],
        unique=False,
    )

    # 2. Ajouter les colonnes document_category_id (nullable d'abord)
    op.add_column(
        "documents", sa.Column("document_category_id", sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        "fk_docs_category",
        "documents",
        "document_categories",
        ["document_category_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.add_column(
        "routing_rules", sa.Column("document_category_id", sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        "fk_rules_category",
        "routing_rules",
        "document_categories",
        ["document_category_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 3. Data Migration (Backfill)
    conn = op.get_bind()

    # 3a. Récupérer toutes les catégories actuelles uniques
    res = conn.execute(
        sa.text("""
        SELECT DISTINCT tenant_id, category FROM documents WHERE category IS NOT NULL AND category != ''
        UNION
        SELECT DISTINCT tenant_id, category FROM routing_rules WHERE category IS NOT NULL AND category != ''
    """)
    ).fetchall()

    cat_map = {}  # (tenant_id, category_string) -> category_uuid

    for row in res:
        tenant_id = row[0]
        cat_str = row[1]

        # Générer un UUID pour la nouvelle catégorie
        cat_id = uuid.uuid4()
        cat_map[(tenant_id, cat_str)] = str(cat_id)

        # Insérer la catégorie
        conn.execute(
            sa.text("""
            INSERT INTO document_categories (id, tenant_id, code, name, is_active)
            VALUES (:id, :tenant_id, :code, :name, true)
        """),
            {
                "id": cat_id,
                "tenant_id": tenant_id,
                "code": cat_str.lower().replace(" ", "_"),
                "name": cat_str.replace("_", " ").title(),
            },
        )

    # 3b. Mettre à jour les documents et routing_rules avec les UUIDs
    for (tenant_id, cat_str), cat_id in cat_map.items():
        conn.execute(
            sa.text("""
            UPDATE documents
            SET document_category_id = :cat_id
            WHERE tenant_id = :tenant_id AND category = :cat_str
        """),
            {"cat_id": cat_id, "tenant_id": tenant_id, "cat_str": cat_str},
        )

        conn.execute(
            sa.text("""
            UPDATE routing_rules
            SET document_category_id = :cat_id
            WHERE tenant_id = :tenant_id AND category = :cat_str
        """),
            {"cat_id": cat_id, "tenant_id": tenant_id, "cat_str": cat_str},
        )

    # 4. Rendre routing_rules.document_category_id NOT NULL
    op.alter_column(
        "routing_rules", "document_category_id", existing_type=sa.UUID(), nullable=False
    )

    # 5. Supprimer les vieilles colonnes textuelles
    op.drop_column("documents", "category")
    op.drop_column("routing_rules", "category")


def downgrade() -> None:
    # 1. Recréer les colonnes 'category'
    op.add_column(
        "routing_rules", sa.Column("category", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "documents", sa.Column("category", sa.String(length=100), nullable=True)
    )

    # 2. Reverse Data Migration
    conn = op.get_bind()

    res = conn.execute(
        sa.text("""
        SELECT id, code FROM document_categories
    """)
    ).fetchall()

    for row in res:
        cat_id = str(row[0])
        cat_code = row[1]

        conn.execute(
            sa.text("""
            UPDATE documents
            SET category = :cat_code
            WHERE document_category_id = :cat_id
        """),
            {"cat_code": cat_code, "cat_id": cat_id},
        )

        conn.execute(
            sa.text("""
            UPDATE routing_rules
            SET category = :cat_code
            WHERE document_category_id = :cat_id
        """),
            {"cat_code": cat_code, "cat_id": cat_id},
        )

    op.alter_column(
        "routing_rules", "category", existing_type=sa.String(length=100), nullable=False
    )

    # 3. Supprimer les clés étrangères et colonnes FK
    op.drop_constraint("fk_rules_category", "routing_rules", type_="foreignkey")
    op.drop_column("routing_rules", "document_category_id")

    op.drop_constraint("fk_docs_category", "documents", type_="foreignkey")
    op.drop_column("documents", "document_category_id")

    # 4. Supprimer la table
    op.drop_index(
        op.f("ix_document_categories_tenant_id"), table_name="document_categories"
    )
    op.drop_table("document_categories")
