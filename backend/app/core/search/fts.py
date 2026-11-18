"""Text search settings shared by everything that writes or queries search vectors.

A stored vector and the query that reads it must use the same configuration:
``french_unaccent`` is the stock ``french`` configuration with accents removed
before stemming, so « décret », « DECRET » and « decret » match each other.
"""

from sqlalchemy import func

FTS_CONFIG = "french_unaccent"

# Idempotent: safe on a fresh database and on one already migrated. The Alembic
# migration ``0f6f64260460`` holds a frozen copy of these statements; the test
# suite builds its schema with ``create_all`` and runs them itself.
SEARCH_SETUP_SQL: tuple[str, ...] = (
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


def fold_accents(expression):
    """``unaccent(expression)``, for literal ILIKE matches that ignore accents."""
    return func.unaccent(expression)
