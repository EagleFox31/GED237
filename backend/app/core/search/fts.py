"""Text search settings shared by everything that writes or queries search vectors.

A stored vector and the query that reads it must use the same configuration:
``french_unaccent`` is the stock ``french`` configuration with accents removed
before stemming, so « décret », « DECRET » and « decret » match each other.

Literal « contains » matches (ILIKE '%…%') go through ``f_unaccent``: unlike
``unaccent()`` it is IMMUTABLE, so a trigram index (``pg_trgm``) can be built on
``f_unaccent(column)`` and the query must use that very expression to hit it.
"""

from sqlalchemy import func, literal_column

FTS_CONFIG = "french_unaccent"

# Inlined as a literal, not bound: an expression index on
# ``to_tsvector('french_unaccent'::regconfig, title)`` only matches a query that
# carries the same constant, which a bind parameter in a generic plan does not.
FTS_REGCONFIG = literal_column(f"'{FTS_CONFIG}'::regconfig")

# Idempotent: safe on a fresh database and on one already migrated. Each Alembic
# migration holds a frozen copy of its group (``0f6f64260460`` for unaccent,
# ``60e40a686375`` for trigrams); the test suite builds its schema with
# ``create_all`` and runs them all itself, before the tables and their indexes.
UNACCENT_SETUP_SQL: tuple[str, ...] = (
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

# ``unaccent()`` is only STABLE (its dictionary could change); naming the
# dictionary makes the wrapper safe to declare IMMUTABLE, the usual recipe.
TRIGRAM_SETUP_SQL: tuple[str, ...] = (
    "CREATE EXTENSION IF NOT EXISTS pg_trgm",
    """
    CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
        AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$
    """,
    """
    CREATE OR REPLACE FUNCTION f_unaccent_tags(text[]) RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
        AS $$ SELECT public.f_unaccent(array_to_string($1, ' ')) $$
    """,
)

SEARCH_SETUP_SQL: tuple[str, ...] = UNACCENT_SETUP_SQL + TRIGRAM_SETUP_SQL


def fold_accents(expression):
    """``f_unaccent(expression)``, for literal ILIKE matches that ignore accents."""
    return func.f_unaccent(expression)


def fold_tag_accents(tags_column):
    """Tags joined by spaces then unaccented: the expression the tag index holds."""
    return func.f_unaccent_tags(tags_column)
