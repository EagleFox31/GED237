"""add_ddd_workflow_actions

Revision ID: b7c8d9e0f1a2
Revises: 3720d938ac5b
Create Date: 2026-04-15

Sprint 4.5 — Parafeur Avancé (Phase 2)
Changements apportés sur workflow_steps :
  - Ajout de expected_action_type (type actiontype, NOT NULL, default visa)
  - Ajout de created_at / updated_at (TimestampMixin)
  - Extension du CHECK constraint status pour inclure 'returned' et 'cancelled'

Création de la table workflow_actions :
  - Trace explicite de chaque acte métier posé (visa, approbation, signature)
  - Rattachement à la version exacte du document au moment de l'acte
  - performed_at : horodatage de l'acte (distinct du created_at générique)
  - performed_by FK : RESTRICT (on ne peut pas supprimer un user qui a signé)
  - document_version_id FK : RESTRICT (intégrité de la trace)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b7c8d9e0f1a2"
down_revision = "3720d938ac5b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Créer les types ENUM (idempotent via PL/pgSQL) ──────────────────
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE actiontype AS ENUM ('read_ack', 'visa', 'approval', 'final_signature');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE outcometype AS ENUM ('accepted', 'rejected', 'returned', 'acknowledged');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    # ── 2. Altérer workflow_steps ──────────────────────────────────────────
    # 2a. Ajouter expected_action_type
    op.execute("""
        ALTER TABLE workflow_steps
        ADD COLUMN IF NOT EXISTS expected_action_type actiontype NOT NULL DEFAULT 'visa'
    """)

    # 2b. Ajouter timestamps (TimestampMixin)
    op.execute("""
        ALTER TABLE workflow_steps
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    """)
    op.execute("""
        ALTER TABLE workflow_steps
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    """)

    # 2c. Étendre le CHECK constraint status (returned + cancelled)
    op.execute(
        "ALTER TABLE workflow_steps DROP CONSTRAINT IF EXISTS check_valid_workflow_status"
    )
    op.execute("""
        ALTER TABLE workflow_steps
        ADD CONSTRAINT check_valid_workflow_status
        CHECK (status IN ('pending', 'current', 'completed', 'rejected', 'returned', 'cancelled'))
    """)

    # ── 3. Créer la table workflow_actions ─────────────────────────────────
    # DROP d'abord pour nettoyer un éventuel état partiel (tests, migrations avortées)
    op.execute("DROP TABLE IF EXISTS workflow_actions CASCADE")
    op.execute("""
        CREATE TABLE workflow_actions (
            id              UUID        NOT NULL DEFAULT gen_random_uuid(),
            workflow_step_id UUID       NOT NULL,
            action_type     actiontype  NOT NULL,
            outcome         outcometype NOT NULL,
            performed_by    UUID        NOT NULL,
            performed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            document_version_id UUID   NOT NULL,
            comment         TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

            PRIMARY KEY (id),
            CONSTRAINT fk_wa_step
                FOREIGN KEY (workflow_step_id)
                REFERENCES workflow_steps(id) ON DELETE CASCADE,
            CONSTRAINT fk_wa_actor
                FOREIGN KEY (performed_by)
                REFERENCES users(id) ON DELETE RESTRICT,
            CONSTRAINT fk_wa_version
                FOREIGN KEY (document_version_id)
                REFERENCES document_versions(id) ON DELETE RESTRICT
        )
    """)

    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_workflow_actions_step       ON workflow_actions (workflow_step_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_workflow_actions_actor      ON workflow_actions (performed_by)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_workflow_actions_performed  ON workflow_actions (performed_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS workflow_actions")

    op.execute(
        "ALTER TABLE workflow_steps DROP CONSTRAINT IF EXISTS check_valid_workflow_status"
    )
    op.execute("""
        ALTER TABLE workflow_steps
        ADD CONSTRAINT check_valid_workflow_status
        CHECK (status IN ('pending', 'current', 'completed', 'rejected'))
    """)

    op.execute("ALTER TABLE workflow_steps DROP COLUMN IF EXISTS updated_at")
    op.execute("ALTER TABLE workflow_steps DROP COLUMN IF EXISTS created_at")
    op.execute("ALTER TABLE workflow_steps DROP COLUMN IF EXISTS expected_action_type")

    op.execute("DROP TYPE IF EXISTS actiontype")
    op.execute("DROP TYPE IF EXISTS outcometype")
