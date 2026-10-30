from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime


class TenantBase(BaseModel):
    name: str = Field(..., max_length=255)
    short_name: Optional[str] = Field(None, max_length=50)
    logo_url: Optional[str] = Field(None, max_length=500)
    domain: Optional[str] = Field(None, max_length=100)
    settings: Optional[Dict[str, Any]] = Field(default_factory=dict)
    is_active: bool = True


class TenantCreate(TenantBase):
    pass


class TenantUpdate(TenantBase):
    name: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None


class TenantRead(TenantBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
