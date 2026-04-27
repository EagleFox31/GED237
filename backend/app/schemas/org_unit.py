from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime


class OrgUnitBase(BaseModel):
    code: str = Field(..., max_length=100)
    name: str = Field(..., max_length=255)
    short_name: Optional[str] = Field(None, max_length=100)
    type_id: Optional[int] = None
    level: int = Field(..., gt=0)
    parent_id: Optional[UUID] = None
    tenant_id: UUID
    extra_data: Optional[Dict[str, Any]] = Field(default_factory=dict)
    is_active: bool = True


class OrgUnitCreate(OrgUnitBase):
    pass


class OrgUnitUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    short_name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None
    extra_data: Optional[Dict[str, Any]] = None


class OrgUnitRead(OrgUnitBase):
    id: UUID
    path: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class OrgUnitTree(OrgUnitRead):
    children: List["OrgUnitTree"] = []

    class Config:
        from_attributes = True
