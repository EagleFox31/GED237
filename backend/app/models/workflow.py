import enum
from sqlalchemy import (
    Column,
    String,
    Integer,
    ForeignKey,
    TIMESTAMP,
    Text,
    Index,
    CheckConstraint,
    Enum,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class ActionType(str, enum.Enum):
    read_ack = "read_ack"
    visa = "visa"
    approval = "approval"
    final_signature = "final_signature"


class OutcomeType(str, enum.Enum):
    accepted = "accepted"
    rejected = "rejected"
    returned = "returned"
    acknowledged = "acknowledged"


class WorkflowStep(Base, UUIDMixin, TimestampMixin):
    """Workflow step for document validation"""

    __tablename__ = "workflow_steps"

    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step_order = Column(Integer, nullable=False)
    label = Column(String(255), nullable=False)
    status = Column(String(50), default="pending", nullable=False)
    expected_action_type = Column(
        Enum(ActionType), nullable=False, default=ActionType.visa
    )
    assigned_to = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    completed_at = Column(TIMESTAMP)
    comment = Column(Text)

    # Relationships
    document = relationship("Document", back_populates="workflow_steps")
    assigned_user = relationship("User", back_populates="workflow_steps")
    actions = relationship(
        "WorkflowAction", back_populates="step", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_workflow_document", "document_id", "step_order"),
        Index("idx_workflow_assigned", "assigned_to", "status"),
        CheckConstraint(
            "status IN ('pending', 'current', 'completed', 'rejected', 'returned', 'cancelled', 'pending_assignment')",
            name="check_valid_workflow_status",
        ),
    )

    def __repr__(self):
        return f"<WorkflowStep(document={self.document_id}, order={self.step_order}, status={self.status})>"


class WorkflowAction(Base, UUIDMixin, TimestampMixin):
    """Trace explicite de l'acte réellement posé sur une étape"""

    __tablename__ = "workflow_actions"

    workflow_step_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workflow_steps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action_type = Column(Enum(ActionType), nullable=False)
    outcome = Column(Enum(OutcomeType), nullable=False)
    performed_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    performed_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )

    # Très important pour garantir l'action sur une version explicite
    document_version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("document_versions.id", ondelete="RESTRICT"),
        nullable=False,
    )

    comment = Column(Text)

    # Relationships
    step = relationship("WorkflowStep", back_populates="actions")
    actor = relationship("User")
    document_version = relationship("DocumentVersion")

    def __repr__(self):
        return f"<WorkflowAction(type={self.action_type}, outcome={self.outcome})>"
