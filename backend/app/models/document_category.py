# backend/app/models/document_category.py
from sqlalchemy import Column, String, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class DocumentCategory(Base, UUIDMixin, TimestampMixin):
    """Référentiel des catégories de documents, propre à chaque tenant."""

    __tablename__ = "document_categories"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_category_tenant_code"),
    )

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    code = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(String(1000))
    is_active = Column(Boolean, default=True, nullable=False)

    tenant = relationship("Tenant")
