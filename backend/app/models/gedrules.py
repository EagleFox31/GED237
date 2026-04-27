# backend/app/models/gedrules.py
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    ForeignKey,
    Enum as SQLEnum,
    Table,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin
from app.models.workflow import ActionType


class AssignmentScope(str, enum.Enum):
    same_org_unit = "same_org_unit"
    parent_org_unit = "parent_org_unit"
    grandparent_org_unit = "grandparent_org_unit"


class WorkflowTemplate(Base, UUIDMixin, TimestampMixin):
    """Template métier abstrait décrivant un circuit de validation standard."""

    __tablename__ = "workflow_templates"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code = Column(String(100), nullable=False)  # Unique per tenant
    name = Column(String(255), nullable=False)
    description = Column(String(1000))
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    steps = relationship(
        "WorkflowTemplateStep",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="WorkflowTemplateStep.step_order",
    )
    tenant = relationship("Tenant")

    # To ensure tenant level uniqueness for code
    # __table_args__ = (Index('idx_tenant_template_code', 'tenant_id', 'code', unique=True),)


class WorkflowTemplateStep(Base, UUIDMixin, TimestampMixin):
    """Définition d'une étape abstraite au sein d'un template."""

    __tablename__ = "workflow_template_steps"

    template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workflow_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step_order = Column(Integer, nullable=False)
    label = Column(String(255), nullable=False)
    expected_action_type = Column(
        SQLEnum(ActionType), nullable=False, default=ActionType.visa
    )

    # Assignment resolution specifics
    role_id = Column(
        Integer, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False
    )
    assignment_scope = Column(
        SQLEnum(AssignmentScope), nullable=False, default=AssignmentScope.same_org_unit
    )
    # Type-anchored resolution (recommandé) : on remonte les ancêtres jusqu'au premier
    # OrgUnit ayant ce type. Si NULL, on retombe sur assignment_scope (legacy).
    target_unit_type_id = Column(
        Integer, ForeignKey("org_unit_types.id", ondelete="RESTRICT"), nullable=True
    )

    # Relationships
    template = relationship("WorkflowTemplate", back_populates="steps")
    role = relationship("Role")
    target_unit_type = relationship("OrgUnitType")


routing_rule_categories = Table(
    "routing_rule_categories",
    Base.metadata,
    Column(
        "rule_id",
        UUID(as_uuid=True),
        ForeignKey("routing_rules.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "category_id",
        UUID(as_uuid=True),
        ForeignKey("document_categories.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

routing_rule_org_units = Table(
    "routing_rule_org_units",
    Base.metadata,
    Column(
        "rule_id",
        UUID(as_uuid=True),
        ForeignKey("routing_rules.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "org_unit_id",
        UUID(as_uuid=True),
        ForeignKey("org_units.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class RoutingRule(Base, UUIDMixin, TimestampMixin):
    """Règle métier déterminant le circuit appliqué à un(des) document(s) depuis un(des) service(s)."""

    __tablename__ = "routing_rules"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(String(1000))

    # Priority allows determining execution order (smaller integer = higher priority)
    priority = Column(Integer, nullable=False, default=100)
    is_active = Column(Boolean, default=True, nullable=False)

    # Target behavior
    workflow_template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workflow_templates.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Relationships
    tenant = relationship("Tenant")
    workflow_template = relationship("WorkflowTemplate")

    # Many-to-Many relationships for Multi-types / Multi-services
    document_categories = relationship(
        "DocumentCategory", secondary=routing_rule_categories
    )
    org_units = relationship("OrgUnit", secondary=routing_rule_org_units)

    @property
    def category_codes(self) -> list[str]:
        return (
            [c.code for c in self.document_categories]
            if self.document_categories
            else []
        )

    @property
    def category_names(self) -> list[str]:
        return (
            [c.name for c in self.document_categories]
            if self.document_categories
            else []
        )
