from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class DocumentRoutingDecision(Base, UUIDMixin, TimestampMixin):
    """
    Table d'audit gardant une trace immuable de chaque décision d'instanciation de workflow.
    """

    __tablename__ = "document_routing_decisions"

    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    routing_rule_id = Column(
        UUID(as_uuid=True),
        ForeignKey("routing_rules.id", ondelete="SET NULL"),
        nullable=True,
    )
    workflow_template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workflow_templates.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Status of the assignment resolution process (e.g. success, warning, partial_failure)
    status = Column(String(50), nullable=False)

    # Detailed unstructured metadata
    matched_conditions_summary = Column(
        JSONB, default={}, nullable=False
    )  # e.g. {"category": "note", "org_unit_id": "..."}
    resolved_steps_summary = Column(
        JSONB, default=[], nullable=False
    )  # e.g. list of instances and their assigned_to resolution

    # Textual description for quick human parsing
    explanation = Column(String(1000))

    # Relationships
    document = relationship("Document")
    routing_rule = relationship("RoutingRule")
    workflow_template = relationship("WorkflowTemplate")
