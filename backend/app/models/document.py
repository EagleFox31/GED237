# backend/app/models/document.py
from typing import Optional
from sqlalchemy import (
    Column,
    String,
    BigInteger,
    ForeignKey,
    TIMESTAMP,
    Index,
    CheckConstraint,
    Text,
    Integer,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY, TSVECTOR
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class Document(Base, UUIDMixin, TimestampMixin):
    """Document model"""

    __tablename__ = "documents"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_unit_id = Column(
        UUID(as_uuid=True),
        ForeignKey("org_units.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # File info
    title = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_type = Column(String(50))
    file_size = Column(BigInteger)
    mime_type = Column(String(100))

    # Classification
    document_category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("document_categories.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    tags = Column(ARRAY(String))

    classification_domain_id = Column(
        UUID(as_uuid=True),
        ForeignKey("classification_domains.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    classification_activity_id = Column(
        UUID(as_uuid=True),
        ForeignKey("classification_activities.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    classification_year = Column(Integer, nullable=True)
    classification_scope = Column(String(30), nullable=False, default="service")
    classification_target_org_unit_id = Column(
        UUID(as_uuid=True),
        ForeignKey("org_units.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    classification_target_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    classification_status = Column(String(30), nullable=False, default="pending")
    logical_space_path = Column(String(1000))
    source_relative_path = Column(String(1000))
    import_job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("import_jobs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    document_category = relationship("DocumentCategory")
    classification_domain = relationship(
        "ClassificationDomain", back_populates="documents"
    )
    classification_activity = relationship(
        "ClassificationActivity", back_populates="documents"
    )

    # Status and version
    status = Column(String(50), default="draft", nullable=False)
    # Processing mode: 'archive' (rangement seul, aucune règle déclenchée) ou 'process' (routage automatique).
    processing_mode = Column(String(20), default="process", nullable=False)
    current_version_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "document_versions.id", use_alter=True, name="fk_doc_current_version"
        ),
        nullable=True,
    )

    # Soft Delete (Corbeille Applicative)
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    deleted_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Pessimistic Application Lock (Edition Guard)
    locked_by_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    locked_at = Column(TIMESTAMP(timezone=True), nullable=True)
    lock_expires_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # OCR content
    ocr_content = Column(Text)
    ocr_content_vector = Column(TSVECTOR)

    # Extra data
    extra_data = Column(JSONB, default={})

    # Archival
    archived_at = Column(TIMESTAMP)

    # Relationships
    tenant = relationship("Tenant", back_populates="documents")
    org_unit = relationship(
        "OrgUnit", back_populates="documents", foreign_keys=[org_unit_id]
    )
    owner = relationship("User", back_populates="documents", foreign_keys=[owner_id])
    classification_target_org_unit = relationship(
        "OrgUnit", foreign_keys=[classification_target_org_unit_id]
    )
    classification_target_user = relationship(
        "User", foreign_keys=[classification_target_user_id]
    )
    workflow_steps = relationship(
        "WorkflowStep", back_populates="document", cascade="all, delete-orphan"
    )
    versions = relationship(
        "DocumentVersion",
        back_populates="document",
        cascade="all, delete-orphan",
        foreign_keys="DocumentVersion.document_id",
    )
    current_version = relationship(
        "DocumentVersion", foreign_keys=[current_version_id], post_update=True
    )
    import_job = relationship("ImportJob", back_populates="documents")

    __table_args__ = (
        Index("idx_documents_tenant", "tenant_id"),
        Index("idx_documents_org_unit", "org_unit_id"),
        Index("idx_documents_owner", "owner_id"),
        Index("idx_documents_status", "tenant_id", "status"),
        Index(
            "idx_documents_classification_status",
            "tenant_id",
            "classification_status",
        ),
        Index(
            "idx_documents_classification_target_year",
            "tenant_id",
            "classification_target_org_unit_id",
            "classification_year",
        ),
        Index(
            "idx_documents_classification_domain_activity",
            "tenant_id",
            "classification_domain_id",
            "classification_activity_id",
        ),
        Index("idx_documents_deleted", "deleted_at"),
        Index("idx_documents_locked", "locked_by_user_id"),
        Index(
            "idx_documents_created", "created_at", postgresql_ops={"created_at": "DESC"}
        ),
        Index("idx_documents_ocr_vector", "ocr_content_vector", postgresql_using="gin"),
        CheckConstraint(
            "status IN ('draft', 'in_review', 'validated', 'signed', 'archived', 'rejected', 'returned')",
            name="check_valid_status",
        ),
        CheckConstraint(
            "processing_mode IN ('archive', 'process')",
            name="check_valid_processing_mode",
        ),
        CheckConstraint(
            "classification_scope IN ('person', 'service', 'subdirectorate', 'directorate')",
            name="check_documents_classification_scope",
        ),
        CheckConstraint(
            "classification_status IN ('pending', 'classified', 'needs_review', 'rejected')",
            name="check_documents_classification_status",
        ),
        CheckConstraint(
            "("
            "classification_scope = 'person' AND classification_target_user_id IS NOT NULL"
            ") OR ("
            "classification_scope IN ('service', 'subdirectorate', 'directorate') "
            "AND classification_target_org_unit_id IS NOT NULL"
            ") OR ("
            "classification_target_user_id IS NULL "
            "AND classification_target_org_unit_id IS NULL"
            ")",
            name="check_documents_classification_target_consistency",
        ),
    )

    def __repr__(self):
        return f"<Document(title={self.title}, status={self.status})>"

    @property
    def current_version_number(self) -> Optional[str]:
        if self.current_version:
            return self.current_version.version_number
        return None

    @property
    def category_code(self) -> Optional[str]:
        return self.document_category.code if self.document_category else None

    @property
    def category_name(self) -> Optional[str]:
        return self.document_category.name if self.document_category else None

    @property
    def classification_domain_name(self) -> Optional[str]:
        if self.classification_domain:
            return self.classification_domain.name
        return None

    @property
    def classification_activity_name(self) -> Optional[str]:
        if self.classification_activity:
            return self.classification_activity.name
        return None
