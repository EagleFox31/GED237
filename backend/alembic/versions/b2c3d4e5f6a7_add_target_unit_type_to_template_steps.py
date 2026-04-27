"""add target_unit_type_id to workflow_template_steps

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "workflow_template_steps",
        sa.Column("target_unit_type_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_template_steps_target_unit_type",
        "workflow_template_steps",
        "org_unit_types",
        ["target_unit_type_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "idx_template_steps_target_unit_type",
        "workflow_template_steps",
        ["target_unit_type_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_template_steps_target_unit_type", table_name="workflow_template_steps"
    )
    op.drop_constraint(
        "fk_template_steps_target_unit_type",
        "workflow_template_steps",
        type_="foreignkey",
    )
    op.drop_column("workflow_template_steps", "target_unit_type_id")
