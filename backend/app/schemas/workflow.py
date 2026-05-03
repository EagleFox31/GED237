# backend/app/schemas/workflow.py
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from uuid import UUID
from datetime import datetime
from app.models.workflow import ActionType, OutcomeType


class WorkflowStepBase(BaseModel):
    document_id: UUID
    step_order: int = Field(..., ge=1)
    label: str = Field(..., max_length=255)
    expected_action_type: ActionType = ActionType.visa
    assigned_to: Optional[UUID] = None


class WorkflowStepCreate(WorkflowStepBase):
    pass


class WorkflowStepUpdate(BaseModel):
    status: Optional[
        Literal[
            "pending",
            "current",
            "completed",
            "rejected",
            "returned",
            "cancelled",
            "pending_assignment",
        ]
    ] = None
    comment: Optional[str] = None


class AssignStepAdminRequest(BaseModel):
    assigned_to: UUID


class DocumentSummary(BaseModel):
    """Résumé léger du document attaché à un step de workflow."""

    id: UUID
    title: str
    status: str
    document_category_id: Optional[UUID] = None
    file_type: Optional[str] = None
    owner_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class WorkflowStepRead(WorkflowStepBase):
    id: UUID
    status: str
    completed_at: Optional[datetime] = None
    comment: Optional[str] = None

    class Config:
        from_attributes = True


class WorkflowStepWithDocument(WorkflowStepRead):
    """WorkflowStep enrichi avec le document associé — utilisé par /pending."""

    document: Optional[DocumentSummary] = None
    assignment_error: Optional[str] = None


class WorkflowActionCreate(BaseModel):
    """Payload pour enregistrer une véritable action métier sur une étape."""

    action_type: ActionType
    outcome: OutcomeType
    document_version_id: UUID
    comment: Optional[str] = None


class WorkflowActionRead(BaseModel):
    """Historique d'une action posée sur un document."""

    id: UUID
    workflow_step_id: UUID
    action_type: ActionType
    outcome: OutcomeType
    performed_by: UUID
    actor_name: Optional[str] = None
    performed_at: datetime
    document_version_id: Optional[UUID] = None
    comment: Optional[str] = None

    class Config:
        from_attributes = True
