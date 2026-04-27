from sqlalchemy import Column, String, ForeignKey, TIMESTAMP, Text, Index
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

    table_name = Column(String(100), nullable=False)
    record_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(20), nullable=False)

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
    )

    def __repr__(self):
        return f"<AuditLog(table={self.table_name}, action={self.action}, user={self.user_id})>"
