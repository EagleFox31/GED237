"""delegations and audit_logs.on_behalf_of

Revision ID: 7680f303299d
Revises: a7c8d9e0f1b2
Create Date: 2026-11-18

Delegation during an absence (DEC-2026-007): a ``delegations`` table and an
``on_behalf_of`` column on ``audit_logs`` for "by X on behalf of Y". New table and
nullable column, no data to migrate. Downgrade drops both (DEC-2026-007 § 6): the
names stay readable in the ``new_data`` of the audit rows.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "7680f303299d"
down_revision = "a7c8d9e0f1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "delegations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "org_unit_id",
            UUID(as_uuid=True),
            sa.ForeignKey("org_units.id"),
            nullable=False,
        ),
        sa.Column(
            "delegator_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "delegate_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "revoked_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column("starts_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("ends_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.TIMESTAMP(timezone=True)),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("ends_at > starts_at", name="ck_delegations_period"),
        sa.CheckConstraint(
            "delegator_id <> delegate_id", name="ck_delegations_distinct_users"
        ),
    )
    op.create_index("ix_delegations_tenant_id", "delegations", ["tenant_id"])
    op.create_index(
        "ix_delegations_delegate_active",
        "delegations",
        ["delegate_id", "ends_at"],
        postgresql_where=sa.text("revoked_at IS NULL"),
    )
    op.create_index(
        "ix_delegations_delegator_period",
        "delegations",
        ["delegator_id", "starts_at", "ends_at"],
    )
    op.create_index(
        "ix_delegations_tenant_unit", "delegations", ["tenant_id", "org_unit_id"]
    )

    op.add_column(
        "audit_logs",
        sa.Column(
            "on_behalf_of",
            UUID(as_uuid=True),
            sa.ForeignKey(
                "users.id",
                ondelete="SET NULL",
                name="audit_logs_on_behalf_of_fkey",
            ),
        ),
    )
    op.create_index(
        "idx_audit_on_behalf_of",
        "audit_logs",
        ["on_behalf_of", "created_at"],
        postgresql_where=sa.text("on_behalf_of IS NOT NULL"),
    )
    _sync_casbin_rules(add=True)


# Same rules as ``app/core/authz/policy.csv`` (the default ``csv`` backend reads
# that file). With ``AUTHZ_BACKEND=sql|shadow`` the rules live in ``casbin_rule``:
# they are written there only when that table is already in use (non-empty), so a
# base still on CSV is not half-seeded before its own cutover.
_CASBIN_RULES = (
    ("tenant_admin", "delegations", "manage"),
    ("manager", "delegations", "read"),
    ("manager", "delegations", "create"),
    ("manager", "delegations", "update"),
)


def _sync_casbin_rules(add: bool) -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if not inspector.has_table("casbin_rule"):
        return
    if conn.execute(sa.text("SELECT 1 FROM casbin_rule LIMIT 1")).first() is None:
        return
    for role, resource, action in _CASBIN_RULES:
        params = {"role": role, "resource": resource, "action": action}
        if add:
            sql = (
                "INSERT INTO casbin_rule (ptype, v0, v1, v2) "
                "SELECT 'p', :role, :resource, :action WHERE NOT EXISTS ("
                "SELECT 1 FROM casbin_rule WHERE ptype = 'p' AND v0 = :role "
                "AND v1 = :resource AND v2 = :action)"
            )
        else:
            sql = (
                "DELETE FROM casbin_rule WHERE ptype = 'p' AND v0 = :role "
                "AND v1 = :resource AND v2 = :action"
            )
        conn.execute(sa.text(sql), params)
    # Running SQL enforcers reload when this version moves.
    if inspector.has_table("authz_policy_version"):
        conn.execute(
            sa.text(
                "UPDATE authz_policy_version SET version = version + 1 WHERE id = 1"
            )
        )


def downgrade() -> None:
    _sync_casbin_rules(add=False)
    op.drop_index("idx_audit_on_behalf_of", table_name="audit_logs")
    op.drop_column("audit_logs", "on_behalf_of")
    op.drop_index("ix_delegations_tenant_unit", table_name="delegations")
    op.drop_index("ix_delegations_delegator_period", table_name="delegations")
    op.drop_index("ix_delegations_delegate_active", table_name="delegations")
    op.drop_index("ix_delegations_tenant_id", table_name="delegations")
    op.drop_table("delegations")
