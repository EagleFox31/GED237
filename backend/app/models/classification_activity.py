from sqlalchemy import Boolean, Column, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class ClassificationActivity(Base, UUIDMixin, TimestampMixin):
    """Tenant-scoped activity nested under a classification domain."""

    __tablename__ = "classification_activities"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    domain_id = Column(
        UUID(as_uuid=True),
        ForeignKey("classification_domains.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(String(500))
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    tenant = relationship("Tenant")
    domain = relationship("ClassificationDomain", back_populates="activities")
    documents = relationship("Document", back_populates="classification_activity")
    classification_rules = relationship(
        "ClassificationRule",
        back_populates="activity",
        foreign_keys="ClassificationRule.activity_id",
    )

    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "domain_id",
            "code",
            name="uq_classification_activities_tenant_domain_code",
        ),
        Index(
            "idx_classification_activities_tenant_domain_active",
            "tenant_id",
            "domain_id",
            "is_active",
        ),
    )

    @property
    def domain_name(self) -> str | None:
        return self.domain.name if self.domain else None
