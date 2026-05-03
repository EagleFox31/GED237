from sqlalchemy import Column, String, Boolean, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class Notification(Base, UUIDMixin, TimestampMixin):
    """Notification model for tracking user alerts."""

    __tablename__ = "notifications"

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ex: 'WORKFLOW_ASSIGNED', 'DOCUMENT_REJECTED', 'SYSTEM_ALERT'
    event_type = Column(String(100), nullable=False)

    # User-friendly message
    message = Column(String(500), nullable=False)

    # 'in_app', 'email', 'sms'
    channel = Column(String(50), nullable=False, default="in_app")

    is_read = Column(Boolean, default=False, nullable=False, index=True)

    # Additional context (e.g., entity_id, link)
    meta_data = Column(JSONB, default={}, nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    tenant = relationship("Tenant", foreign_keys=[tenant_id])

    __table_args__ = (
        Index("idx_notifications_user_read", "user_id", "is_read"),
        Index("idx_notifications_tenant_user", "tenant_id", "user_id"),
    )

    def __repr__(self):
        return f"<Notification(user_id={self.user_id}, type={self.event_type}, read={self.is_read})>"
