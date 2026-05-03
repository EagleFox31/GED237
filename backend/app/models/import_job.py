from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class ImportJob(Base, UUIDMixin, TimestampMixin):
    """Represents one analyzed/committed batch import job."""

    __tablename__ = "import_jobs"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_scope = Column(String(30), nullable=False, default="service")
    target_org_unit_id = Column(
        UUID(as_uuid=True),
        ForeignKey("org_units.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    target_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    default_document_category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("document_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    forced_year = Column(Integer, nullable=True)
    processing_mode = Column(String(20), nullable=False, default="process")
    status = Column(String(30), nullable=False, default="draft")
    total_files = Column(Integer, nullable=False, default=0)
    supported_files = Column(Integer, nullable=False, default=0)
    ignored_files = Column(Integer, nullable=False, default=0)
    duplicate_files = Column(Integer, nullable=False, default=0)
    error_files = Column(Integer, nullable=False, default=0)

    tenant = relationship("Tenant")
    created_by = relationship("User", foreign_keys=[created_by_id])
    target_org_unit = relationship("OrgUnit", foreign_keys=[target_org_unit_id])
    target_user = relationship("User", foreign_keys=[target_user_id])
    default_document_category = relationship(
        "DocumentCategory", foreign_keys=[default_document_category_id]
    )
    items = relationship(
        "ImportJobItem",
        back_populates="import_job",
        cascade="all, delete-orphan",
        order_by="ImportJobItem.created_at.asc()",
    )
    documents = relationship("Document", back_populates="import_job")

    __table_args__ = (
        Index("idx_import_jobs_tenant_status", "tenant_id", "status"),
        Index("idx_import_jobs_creator_status", "created_by_id", "status"),
        CheckConstraint(
            "source_scope IN ('person', 'service', 'subdirectorate')",
            name="check_import_jobs_source_scope",
        ),
        CheckConstraint(
            "processing_mode IN ('archive', 'process')",
            name="check_import_jobs_processing_mode",
        ),
        CheckConstraint(
            "status IN ('draft', 'analyzed', 'running', 'completed', 'completed_with_errors', 'cancelled')",
            name="check_import_jobs_status",
        ),
        CheckConstraint(
            "(target_user_id IS NOT NULL) OR (target_org_unit_id IS NOT NULL)",
            name="check_import_jobs_has_target",
        ),
    )
