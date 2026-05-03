from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    TIMESTAMP,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class ClassificationReview(Base, UUIDMixin, TimestampMixin):
    """Manual classification review attached to one document or one staged import item."""

    __tablename__ = "classification_reviews"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    import_job_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("import_job_items.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    review_status = Column(String(20), nullable=False, default="open", server_default="open")
    arbitration_reason = Column(String(1000), nullable=True)

    suggested_domain_id = Column(
        UUID(as_uuid=True),
        ForeignKey("classification_domains.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    suggested_activity_id = Column(
        UUID(as_uuid=True),
        ForeignKey("classification_activities.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    suggested_year = Column(Integer, nullable=True)
    suggested_scope = Column(String(30), nullable=True)
    suggested_target_org_unit_id = Column(
        UUID(as_uuid=True),
        ForeignKey("org_units.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    suggested_target_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    resolved_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resolved_at = Column(TIMESTAMP(timezone=True), nullable=True)
    resolution_comment = Column(String(1000), nullable=True)

    tenant = relationship("Tenant")
    document = relationship("Document")
    import_job_item = relationship("ImportJobItem")
    suggested_domain = relationship("ClassificationDomain", foreign_keys=[suggested_domain_id])
    suggested_activity = relationship("ClassificationActivity", foreign_keys=[suggested_activity_id])
    suggested_target_org_unit = relationship("OrgUnit", foreign_keys=[suggested_target_org_unit_id])
    suggested_target_user = relationship("User", foreign_keys=[suggested_target_user_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])

    __table_args__ = (
        UniqueConstraint("document_id", name="uq_classification_reviews_document_id"),
        UniqueConstraint(
            "import_job_item_id", name="uq_classification_reviews_import_job_item_id"
        ),
        Index(
            "idx_classification_reviews_tenant_status",
            "tenant_id",
            "review_status",
            "updated_at",
        ),
        CheckConstraint(
            "(document_id IS NOT NULL) OR (import_job_item_id IS NOT NULL)",
            name="check_classification_reviews_has_target",
        ),
        CheckConstraint(
            "review_status IN ('open', 'resolved', 'cancelled')",
            name="check_classification_reviews_status",
        ),
        CheckConstraint(
            "suggested_scope IS NULL OR suggested_scope IN ('person', 'service', 'subdirectorate', 'directorate')",
            name="check_classification_reviews_scope",
        ),
    )
