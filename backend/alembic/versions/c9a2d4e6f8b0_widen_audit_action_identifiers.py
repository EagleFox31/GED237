"""widen audit action identifiers

Revision ID: c9a2d4e6f8b0
Revises: b8e1f3a5c7d9
Create Date: 2026-09-01

Audit actions are semantic event identifiers and some valid events exceed the
historical 20-character limit (for example ``workflow_started_a_posteriori``).
Widen the column without changing existing values.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c9a2d4e6f8b0"
down_revision: Union[str, Sequence[str], None] = "b8e1f3a5c7d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"]: column for column in inspector.get_columns("audit_logs")}
    action = columns.get("action")
    if action is None:
        return

    length = getattr(action["type"], "length", None)
    if length is None or length < 64:
        op.alter_column(
            "audit_logs",
            "action",
            existing_type=action["type"],
            type_=sa.String(length=64),
            existing_nullable=False,
        )


def downgrade() -> None:
    # Forward-only safety: once semantic action identifiers longer than 20
    # characters exist, shrinking the column would truncate or reject audit data.
    pass
