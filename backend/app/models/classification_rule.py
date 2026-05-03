from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class ClassificationRule(Base, UUIDMixin, TimestampMixin):
    """Rule used to resolve logical document classification."""

    __tablename__ = "classification_rules"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(String(500))
    priority = Column(Integer, nullable=False, default=100, server_default="100")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    source_scope = Column(
        String(30),
        nullable=False,
        default="service",
        server_default="service",
    )
    source_org_unit_id = Column(
        UUID(as_uuid=True),
        ForeignKey("org_units.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    source_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    document_category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("document_categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    filename_pattern = Column(String(255))
    mime_type_pattern = Column(String(100))
    target_scope = Column(String(30), nullable=False)
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
    domain_id = Column(
        UUID(as_uuid=True),
        ForeignKey("classification_domains.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    activity_id = Column(
        UUID(as_uuid=True),
        ForeignKey("classification_activities.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    year_strategy = Column(
        String(20),
        nullable=False,
        default="current",
        server_default="current",
    )
    fixed_year = Column(Integer)
    workflow_template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workflow_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    tenant = relationship("Tenant")
    source_org_unit = relationship("OrgUnit", foreign_keys=[source_org_unit_id])
    source_user = relationship("User", foreign_keys=[source_user_id])
    document_category = relationship("DocumentCategory")
    target_org_unit = relationship("OrgUnit", foreign_keys=[target_org_unit_id])
    target_user = relationship("User", foreign_keys=[target_user_id])
    domain = relationship(
        "ClassificationDomain",
        back_populates="classification_rules",
        foreign_keys=[domain_id],
    )
    activity = relationship(
        "ClassificationActivity",
        back_populates="classification_rules",
        foreign_keys=[activity_id],
    )
    workflow_template = relationship("WorkflowTemplate")

    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "code",
            name="uq_classification_rules_tenant_code",
        ),
        Index(
            "idx_classification_rules_tenant_priority",
            "tenant_id",
            "priority",
        ),
        Index(
            "idx_classification_rules_source_org_unit",
            "tenant_id",
            "source_org_unit_id",
            "is_active",
        ),
        CheckConstraint(
            "source_scope IN ('person', 'service', 'subdirectorate')",
            name="check_classification_rules_source_scope",
        ),
        CheckConstraint(
            "target_scope IN ('person', 'service', 'subdirectorate', 'directorate')",
            name="check_classification_rules_target_scope",
        ),
        CheckConstraint(
            "year_strategy IN ('current', 'from_filename', 'from_metadata', 'fixed')",
            name="check_classification_rules_year_strategy",
        ),
        CheckConstraint("priority >= 0", name="check_classification_rules_priority"),
    )

    @property
    def document_category_name(self) -> str | None:
        return self.document_category.name if self.document_category else None

    @property
    def source_org_unit_name(self) -> str | None:
        return self.source_org_unit.name if self.source_org_unit else None

    @property
    def source_user_name(self) -> str | None:
        return self.source_user.full_name if self.source_user else None

    @property
    def target_org_unit_name(self) -> str | None:
        return self.target_org_unit.name if self.target_org_unit else None

    @property
    def target_user_name(self) -> str | None:
        return self.target_user.full_name if self.target_user else None

    @property
    def domain_name(self) -> str | None:
        return self.domain.name if self.domain else None

    @property
    def activity_name(self) -> str | None:
        return self.activity.name if self.activity else None

    @property
    def workflow_template_name(self) -> str | None:
        return self.workflow_template.name if self.workflow_template else None
