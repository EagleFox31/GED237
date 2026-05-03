from sqlalchemy import Boolean, Column, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class ClassificationDomain(Base, UUIDMixin, TimestampMixin):
    """Tenant-scoped domain used to build logical document spaces."""

    __tablename__ = "classification_domains"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(String(500))
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    tenant = relationship("Tenant")
    activities = relationship(
        "ClassificationActivity",
        back_populates="domain",
        cascade="all, delete-orphan",
    )
    documents = relationship("Document", back_populates="classification_domain")
    classification_rules = relationship(
        "ClassificationRule",
        back_populates="domain",
        foreign_keys="ClassificationRule.domain_id",
    )

    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "code",
            name="uq_classification_domains_tenant_code",
        ),
        Index(
            "idx_classification_domains_tenant_active",
            "tenant_id",
            "is_active",
        ),
    )
