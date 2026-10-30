# backend/app/schemas/gedrules.py
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from app.models.workflow import ActionType
from app.models.gedrules import AssignmentScope

# --- Workflow Template ---


class WorkflowTemplateStepBase(BaseModel):
    step_order: int
    label: str
    expected_action_type: ActionType
    role_id: int
    assignment_scope: AssignmentScope = AssignmentScope.same_org_unit
    target_unit_type_id: Optional[int] = None


class WorkflowTemplateStepCreate(WorkflowTemplateStepBase):
    pass


class WorkflowTemplateStepRead(WorkflowTemplateStepBase):
    id: UUID
    template_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkflowTemplateBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool = True


class WorkflowTemplateCreate(WorkflowTemplateBase):
    steps: List[WorkflowTemplateStepCreate]


class WorkflowTemplateRead(WorkflowTemplateBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime
    steps: List[WorkflowTemplateStepRead]

    class Config:
        from_attributes = True


class WorkflowTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    steps: Optional[List[WorkflowTemplateStepCreate]] = None


# --- Routing Rule ---


class RoutingRuleBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    priority: int = 100
    is_active: bool = True
    document_category_ids: List[UUID]
    org_unit_ids: Optional[List[UUID]] = []
    workflow_template_id: UUID


class RoutingRuleCreate(RoutingRuleBase):
    pass


class RoutingRuleRead(RoutingRuleBase):
    id: UUID
    tenant_id: UUID
    category_codes: List[str] = []
    category_names: List[str] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RoutingRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    document_category_ids: Optional[List[UUID]] = None
    org_unit_ids: Optional[List[UUID]] = None
    workflow_template_id: Optional[UUID] = None


# --- Routing Simulation ---


class SimulateRequest(BaseModel):
    document_category_id: UUID
    org_unit_id: Optional[UUID] = None
    owner_id: Optional[UUID] = None


class SimulateResolvedActor(BaseModel):
    step_order: int
    label: str
    expected_action_type: str
    assignment_scope: str
    resolution_status: str
    resolution_note: Optional[str] = None
    resolved_user_id: Optional[UUID] = None
    resolved_user_name: Optional[str] = None
    resolved_role_label: Optional[str] = None
    resolved_org_unit_name: Optional[str] = None


class SimulateResponse(BaseModel):
    matched_rule_id: Optional[UUID] = None
    matched_rule_name: Optional[str] = None
    template_id: Optional[UUID] = None
    template_name: Optional[str] = None
    selected_owner_id: Optional[UUID] = None
    selected_owner_name: Optional[str] = None
    selected_owner_role: Optional[str] = None
    resolved_steps: List[SimulateResolvedActor]
    explanation: str


# --- Routing Audit ---


class DocumentRoutingDecisionRead(BaseModel):
    id: UUID
    document_id: UUID
    routing_rule_id: Optional[UUID] = None
    workflow_template_id: Optional[UUID] = None
    status: str
    matched_conditions_summary: dict
    resolved_steps_summary: list
    explanation: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
