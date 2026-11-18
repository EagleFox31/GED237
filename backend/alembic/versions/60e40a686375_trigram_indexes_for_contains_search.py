"""trigram indexes for « contains » search on documents

Revision ID: 60e40a686375
Revises: 7680f303299d
Create Date: 2026-11-18

The document list filter (« q ») and the search engine match titles and tags
with ILIKE '%…%', which no B-tree index can serve: every query read the whole
table. Creates the ``pg_trgm`` extension (trusted since PostgreSQL 13), an
IMMUTABLE ``f_unaccent`` wrapper (``unaccent()`` itself is only STABLE, so it
cannot be indexed) and three GIN indexes:

- ``f_unaccent(title)`` with trigrams, for the title « contains » match;
- ``f_unaccent_tags(tags)`` with trigrams, for the tags « contains » match;
- ``to_tsvector('french_unaccent', title)``, for the search engine's stemmed
  title match.

The setup statements are a frozen copy of
``app.core.search.fts.TRIGRAM_SETUP_SQL``. Every statement is idempotent.
"""

from alembic import op

revision = "60e40a686375"
down_revision = "7680f303299d"
branch_labels = None
depends_on = None

SETUP_SQL = (
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

INDEXES = (
    (
        "idx_documents_title_trgm",
        "gin (f_unaccent(title) gin_trgm_ops)",
    ),
    (
        "idx_documents_tags_trgm",
        "gin (f_unaccent_tags(tags) gin_trgm_ops)",
    ),
    (
        "idx_documents_title_fts",
        "gin (to_tsvector('french_unaccent'::regconfig, title))",
    ),
)


def upgrade() -> None:
    for statement in SETUP_SQL:
        op.execute(statement)
    for name, definition in INDEXES:
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON documents USING {definition}")


def downgrade() -> None:
    # The indexes go first: they depend on the functions. The pg_trgm extension
    # stays, as unaccent did in 0f6f64260460: other objects may rely on it.
    for name, _ in reversed(INDEXES):
        op.execute(f"DROP INDEX IF EXISTS {name}")
    op.execute("DROP FUNCTION IF EXISTS f_unaccent_tags(text[])")
    op.execute("DROP FUNCTION IF EXISTS f_unaccent(text)")
