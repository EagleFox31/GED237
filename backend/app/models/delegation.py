"""Delegation during an absence (DEC-2026-007).

The stand-in (``delegate_id``) handles the absent agent's (``delegator_id``) current
workflow steps over a fixed period ``[starts_at, ends_at)``. The period is read
against ``now()`` in every query, so the automatic end and a revocation take
effect at once, without a scheduled job.
"""

from sqlalchemy import CheckConstraint, Column, ForeignKey, Index, TIMESTAMP, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.base import UUIDMixin


class Delegation(Base, UUIDMixin):
    __tablename__ = "delegations"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Service of the absent agent, frozen at creation: a manager's scope.
    org_unit_id = Column(UUID(as_uuid=True), ForeignKey("org_units.id"), nullable=False)
    delegator_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    delegate_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    revoked_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    starts_at = Column(TIMESTAMP(timezone=True), nullable=False)
    ends_at = Column(TIMESTAMP(timezone=True), nullable=False)
    revoked_at = Column(TIMESTAMP(timezone=True))
    created_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("ends_at > starts_at", name="ck_delegations_period"),
        CheckConstraint(
            "delegator_id <> delegate_id", name="ck_delegations_distinct_users"
        ),
        # Hot path of the assignee clause: "whom am I standing in for, now?"
        Index(
            "ix_delegations_delegate_active",
            "delegate_id",
            "ends_at",
            postgresql_where=text("revoked_at IS NULL"),
        ),
        Index(
            "ix_delegations_delegator_period", "delegator_id", "starts_at", "ends_at"
        ),
        Index("ix_delegations_tenant_unit", "tenant_id", "org_unit_id"),
    )

    def __repr__(self):
        return f"<Delegation({self.delegator_id} -> {self.delegate_id})>"
