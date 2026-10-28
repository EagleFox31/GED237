from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel

EngineClassificationStatus = Literal[
    "classified", "needs_review", "no_rule", "rejected"
]
ClassificationSourceScope = Literal["person", "service", "subdirectorate"]
ClassificationTargetScope = Literal[
    "person", "service", "subdirectorate", "directorate"
]


class ClassificationSimulationRequest(BaseModel):
    document_category_id: Optional[UUID] = None
    source_scope: ClassificationSourceScope = "service"
    source_org_unit_id: Optional[UUID] = None
    source_user_id: Optional[UUID] = None
    filename: str
    mime_type: Optional[str] = None


class ClassificationRuleCheck(BaseModel):
    key: str
    label: str
    passed: bool
    detail: str


class ClassificationRuleDiagnostic(BaseModel):
    rule_id: UUID
    rule_code: str
    rule_name: str
    rule_priority: int
    matched: bool
    checks: list[ClassificationRuleCheck]


class ClassificationStageRule(BaseModel):
    rule_id: UUID
    rule_code: str
    rule_name: str
    rule_priority: int
    detail: str


class ClassificationSimulationStage(BaseModel):
    key: str
    label: str
    summary: str
    remaining_rules: list[ClassificationStageRule] = []
    removed_rules: list[ClassificationStageRule] = []


class ClassificationSimulationResponse(BaseModel):
    status: EngineClassificationStatus
    rule_id: Optional[UUID] = None
    rule_code: Optional[str] = None
    rule_name: Optional[str] = None
    rule_priority: Optional[int] = None
    message: str
    logical_space_path: Optional[str] = None
    classification_scope: Optional[ClassificationTargetScope] = None
    classification_target_org_unit_id: Optional[UUID] = None
    classification_target_org_unit_name: Optional[str] = None
    classification_target_user_id: Optional[UUID] = None
    classification_target_user_name: Optional[str] = None
    classification_domain_id: Optional[UUID] = None
    classification_domain_name: Optional[str] = None
    classification_activity_id: Optional[UUID] = None
    classification_activity_name: Optional[str] = None
    classification_year: Optional[int] = None
    diagnostics: list[ClassificationRuleDiagnostic] = []
    stages: list[ClassificationSimulationStage] = []
