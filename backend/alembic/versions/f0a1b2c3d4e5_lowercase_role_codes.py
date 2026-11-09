"""lowercase role codes

Revision ID: f0a1b2c3d4e5
Revises: e1f2a3b4c5d6
Create Date: 2026-11-11

The initial migration seeded the roles in upper case (``COLLABORATOR``) while
the application, the Casbin policy and the seed scripts use lower case
(``collaborator``). A database that ran the migrations and then the seed ended
up with two rows per role, and users attached to an upper-case row matched no
policy line at all (LESSON-2026-021).

Reconciliation, idempotent and safe to re-run:

1. a mixed-case role whose lower-case twin already exists: every reference
   (``users.role_id``, ``workflow_template_steps.role_id``) is moved to the
   twin and the duplicate is deleted;
2. a mixed-case role without a twin is simply renamed in place;
3. a CHECK constraint keeps the codes lower case from now on.

Downgrade drops the constraint only: the data stays lower case, which every
version of the application accepts.
"""

from typing import Sequence, Union

from alembic import op


revision: str = "f0a1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CHECK_NAME = "ck_roles_code_lowercase"

# Tables holding a foreign key to roles.id (users since 001, template steps
# since 779d4e59e683). Kept explicit: alembic migrations do not import models.
ROLE_REFERENCES = (
    ("users", "role_id"),
    ("workflow_template_steps", "role_id"),
)


def upgrade() -> None:
    for table, column in ROLE_REFERENCES:
        op.execute(
            f"""
            UPDATE {table} AS ref
            SET {column} = twin.id
            FROM roles AS dup
            JOIN roles AS twin
              ON twin.code = lower(dup.code) AND twin.id <> dup.id
            WHERE ref.{column} = dup.id
              AND dup.code <> lower(dup.code)
            """
        )
    op.execute(
        """
        DELETE FROM roles AS dup
        USING roles AS twin
        WHERE twin.code = lower(dup.code)
          AND twin.id <> dup.id
          AND dup.code <> lower(dup.code)
        """
    )
    op.execute("UPDATE roles SET code = lower(code) WHERE code <> lower(code)")
    op.create_check_constraint(CHECK_NAME, "roles", "code = lower(code)")


def downgrade() -> None:
    op.drop_constraint(CHECK_NAME, "roles", type_="check")
