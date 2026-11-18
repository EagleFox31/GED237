from sqlalchemy import Column, String, ForeignKey, TIMESTAMP, Text, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.sql import func
from app.core.database import Base
from app.models.base import UUIDMixin


class AuditLog(Base, UUIDMixin):
    """Audit log for tracking all changes"""

    __tablename__ = "audit_logs"

    tenant_id = Column(UUID(as_uuid=True), index=True)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    # Set when ``user_id`` acted as a stand-in: "by X on behalf of Y" (DEC-2026-007).
    on_behalf_of = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    table_name = Column(String(100), nullable=False)
    record_id = Column(UUID(as_uuid=True), nullable=False)
    # Audit actions are semantic event identifiers, not fixed CRUD verbs. Keep
    # enough room for explicit names such as ``workflow_started_a_posteriori``.
    action = Column(String(64), nullable=False)

    old_data = Column(JSONB)
    new_data = Column(JSONB)

    ip_address = Column(INET)
    user_agent = Column(Text)

    created_at = Column(TIMESTAMP, default=func.now(), nullable=False)

    __table_args__ = (
        Index(
            "idx_audit_tenant_created",
            "tenant_id",
            "created_at",
            postgresql_ops={"created_at": "DESC"},
        ),
        Index(
            "idx_audit_user_created",
            "user_id",
            "created_at",
            postgresql_ops={"created_at": "DESC"},
        ),
        Index("idx_audit_table_record", "table_name", "record_id"),
        Index(
            "idx_audit_on_behalf_of",
            "on_behalf_of",
            "created_at",
            postgresql_where=text("on_behalf_of IS NOT NULL"),
        ),
    )

    def __repr__(self):
        return f"<AuditLog(table={self.table_name}, action={self.action}, user={self.user_id})>"
