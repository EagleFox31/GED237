from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

ClassificationSourceScope = Literal["person", "service", "subdirectorate"]
ClassificationTargetScope = Literal[
    "person", "service", "subdirectorate", "directorate"
]
ClassificationYearStrategy = Literal[
    "current", "from_filename", "from_metadata", "fixed"
]


class ClassificationDomainBase(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=500)
    is_active: bool = True


class ClassificationDomainCreate(ClassificationDomainBase):
    pass


class ClassificationDomainUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=100)
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=500)
    is_active: Optional[bool] = None


class ClassificationDomainRead(ClassificationDomainBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClassificationActivityBase(BaseModel):
    domain_id: UUID
    code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=500)
    is_active: bool = True


class ClassificationActivityCreate(ClassificationActivityBase):
    pass


class ClassificationActivityUpdate(BaseModel):
    domain_id: Optional[UUID] = None
    code: Optional[str] = Field(default=None, min_length=1, max_length=100)
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=500)
    is_active: Optional[bool] = None


class ClassificationActivityRead(ClassificationActivityBase):
    id: UUID
    tenant_id: UUID
    domain_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClassificationRuleBase(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=500)
    priority: int = Field(default=100, ge=0)
    is_active: bool = True
    source_scope: ClassificationSourceScope = "service"
    source_org_unit_id: Optional[UUID] = None
    source_user_id: Optional[UUID] = None
    document_category_id: Optional[UUID] = None
    # Multi-select OR. Liste non vide → prime sur le single FK ci-dessus.
    document_category_ids: Optional[List[UUID]] = None
    source_org_unit_ids: Optional[List[UUID]] = None
    source_org_unit_excluded_ids: Optional[List[UUID]] = None
    source_user_ids: Optional[List[UUID]] = None
    filename_pattern: Optional[str] = Field(default=None, max_length=255)
    mime_type_pattern: Optional[str] = Field(default=None, max_length=100)
    target_scope: ClassificationTargetScope
    target_org_unit_id: Optional[UUID] = None
    target_user_id: Optional[UUID] = None
    domain_id: Optional[UUID] = None
    activity_id: Optional[UUID] = None
    year_strategy: ClassificationYearStrategy = "current"
    fixed_year: Optional[int] = Field(default=None, ge=1900, le=2100)
    workflow_template_id: Optional[UUID] = None


class ClassificationRuleCreate(ClassificationRuleBase):
    pass


class ClassificationRuleUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=100)
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=500)
    priority: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None
    source_scope: Optional[ClassificationSourceScope] = None
    source_org_unit_id: Optional[UUID] = None
    source_user_id: Optional[UUID] = None
    document_category_id: Optional[UUID] = None
    document_category_ids: Optional[List[UUID]] = None
    source_org_unit_ids: Optional[List[UUID]] = None
    source_org_unit_excluded_ids: Optional[List[UUID]] = None
    source_user_ids: Optional[List[UUID]] = None
    filename_pattern: Optional[str] = Field(default=None, max_length=255)
    mime_type_pattern: Optional[str] = Field(default=None, max_length=100)
    target_scope: Optional[ClassificationTargetScope] = None
    target_org_unit_id: Optional[UUID] = None
    target_user_id: Optional[UUID] = None
    domain_id: Optional[UUID] = None
    activity_id: Optional[UUID] = None
    year_strategy: Optional[ClassificationYearStrategy] = None
    fixed_year: Optional[int] = Field(default=None, ge=1900, le=2100)
    workflow_template_id: Optional[UUID] = None


class ClassificationRuleRead(ClassificationRuleBase):
    id: UUID
    tenant_id: UUID
    document_category_name: Optional[str] = None
    source_org_unit_name: Optional[str] = None
    source_user_name: Optional[str] = None
    target_org_unit_name: Optional[str] = None
    target_user_name: Optional[str] = None
    domain_name: Optional[str] = None
    activity_name: Optional[str] = None
    workflow_template_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
