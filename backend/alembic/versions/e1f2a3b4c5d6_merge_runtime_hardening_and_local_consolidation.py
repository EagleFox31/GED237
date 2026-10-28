"""merge runtime hardening and local consolidation heads

Revision ID: e1f2a3b4c5d6
Revises: c9a2d4e6f8b0, d4e5f6a7b8c9
Create Date: 2026-10-28

Both chains start from ``f8e9d7c6b5a4`` and touch disjoint objects
(users / audit_logs / documents indexes vs classification_rules and the
local organizer tables), so they can be applied in any order. A merge
revision is used instead of re-parenting one chain, so databases already
upgraded on either branch still receive the migrations of the other one.
"""

from typing import Sequence, Union


revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = ("c9a2d4e6f8b0", "d4e5f6a7b8c9")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
