"""french_unaccent text search configuration

Revision ID: 0f6f64260460
Revises: a7c8d9e0f1b2
Create Date: 2026-11-18

Search ignores accents (V1.1 lot 10-3): « décret », « DECRET » and « decret »
match each other. Creates the ``unaccent`` extension (trusted since PostgreSQL 13:
the database owner may create it) and a ``french_unaccent`` configuration, then
recomputes the stored OCR vectors with it, in batches, so stored vectors and
queries use the same configuration.

The setup statements are a frozen copy of ``app.core.search.fts.SEARCH_SETUP_SQL``.
Rerunning the upgrade is a no-op apart from recomputing identical vectors.
"""

import sqlalchemy as sa
from alembic import op

revision = "0f6f64260460"
down_revision = "a7c8d9e0f1b2"
branch_labels = None
depends_on = None

BATCH_SIZE = 500

SETUP_SQL = (
    "CREATE EXTENSION IF NOT EXISTS unaccent",
    """
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'french_unaccent') THEN
            CREATE TEXT SEARCH CONFIGURATION french_unaccent (COPY = french);
            ALTER TEXT SEARCH CONFIGURATION french_unaccent
                ALTER MAPPING FOR hword, hword_part, word WITH unaccent, french_stem;
        END IF;
    END
    $$
    """,
)


def _reindex_ocr_vectors(config: str) -> None:
    """Recompute every stored OCR vector with ``config``, ``BATCH_SIZE`` rows at a time."""
    conn = op.get_bind()
    ids = [
        str(row[0])
        for row in conn.execute(
            sa.text(
                "SELECT id FROM documents WHERE ocr_content IS NOT NULL ORDER BY id"
            )
        )
    ]
    update = sa.text(
        "UPDATE documents"
        " SET ocr_content_vector = to_tsvector(CAST(:config AS regconfig), ocr_content)"
        " WHERE id = ANY(CAST(:ids AS uuid[]))"
    )
    for start in range(0, len(ids), BATCH_SIZE):
        conn.execute(update, {"config": config, "ids": ids[start : start + BATCH_SIZE]})


def upgrade() -> None:
    for statement in SETUP_SQL:
        op.execute(statement)
    _reindex_ocr_vectors("french_unaccent")


def downgrade() -> None:
    # Vectors go back to the stock configuration before it disappears. The
    # unaccent extension stays: other objects may depend on it, and it is harmless.
    _reindex_ocr_vectors("french")
    op.execute("DROP TEXT SEARCH CONFIGURATION IF EXISTS french_unaccent")
