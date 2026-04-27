# backend/app/schemas/document_category.py
import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class DocumentCategoryBase(BaseModel):
    code: str = Field(..., max_length=100)
    name: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    is_active: bool = True


class DocumentCategoryCreate(DocumentCategoryBase):
    pass


class DocumentCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    is_active: Optional[bool] = None
    # On ne permet pas de modifier le code une fois défini (pour l'intégrité)


class DocumentCategoryResponse(DocumentCategoryBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        orm_mode = True  # compat pydantic v1
