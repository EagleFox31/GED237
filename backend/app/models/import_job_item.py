from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class ImportJobItem(Base, UUIDMixin, TimestampMixin):
    """One analyzed file inside an import batch job."""

    __tablename__ = "import_job_items"

    import_job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("import_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    original_filename = Column(String(500), nullable=False)
    source_relative_path = Column(String(1000), nullable=False)
    staging_file_path = Column(String(1000), nullable=True)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=False, default=0)
    checksum_sha256 = Column(String(64), nullable=True, index=True)
    detected_document_category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("document_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resolved_domain_id = Column(
        UUID(as_uuid=True),
        ForeignKey("classification_domains.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resolved_activity_id = Column(
        UUID(as_uuid=True),
        ForeignKey("classification_activities.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resolved_year = Column(Integer, nullable=True)
    resolved_scope = Column(String(30), nullable=True)
    resolved_target_org_unit_id = Column(
        UUID(as_uuid=True),
        ForeignKey("org_units.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resolved_target_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    workflow_template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workflow_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    logical_space_path = Column(String(1000), nullable=True)
    status = Column(String(30), nullable=False, default="pending")
    error_message = Column(Text, nullable=True)
    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    import_job = relationship("ImportJob", back_populates="items")
    detected_document_category = relationship(
        "DocumentCategory", foreign_keys=[detected_document_category_id]
    )
    resolved_domain = relationship("ClassificationDomain", foreign_keys=[resolved_domain_id])
    resolved_activity = relationship(
        "ClassificationActivity", foreign_keys=[resolved_activity_id]
    )
    resolved_target_org_unit = relationship(
        "OrgUnit", foreign_keys=[resolved_target_org_unit_id]
    )
    resolved_target_user = relationship("User", foreign_keys=[resolved_target_user_id])
    workflow_template = relationship("WorkflowTemplate")
    document = relationship("Document", foreign_keys=[document_id])

    __table_args__ = (
        Index("idx_import_job_items_job_status", "import_job_id", "status"),
        CheckConstraint(
            "status IN ('pending', 'classified', 'needs_review', 'duplicate', 'ignored', 'imported', 'failed')",
            name="check_import_job_items_status",
        ),
        CheckConstraint(
            "resolved_scope IS NULL OR resolved_scope IN ('person', 'service', 'subdirectorate', 'directorate')",
            name="check_import_job_items_resolved_scope",
        ),
    )
