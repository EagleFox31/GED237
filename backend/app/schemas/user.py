from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime


class UserBase(BaseModel):
    matricule: str = Field(..., max_length=50)
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    role_id: Optional[int] = None
    role_code: Optional[str] = None
    tenant_id: UUID
    org_unit_id: Optional[UUID] = None
    reports_to_user_id: Optional[UUID] = None
    phone: Optional[str] = Field(None, max_length=20)
    avatar_url: Optional[str] = Field(None, max_length=500)
    profile_data: Optional[Dict[str, Any]] = Field(default_factory=dict)
    is_active: bool = True


class UserCreate(UserBase):
    # Password is optional. If omitted the backend auto-generates a strong
    # one-time password and forces a change at first login.
    password: Optional[str] = Field(None, min_length=6)


class UserCreateResponse(BaseModel):
    """Response of POST /users/ — includes the generated password (only when auto-generated)."""

    user: "UserRead"
    generated_password: Optional[str] = None


class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    avatar_url: Optional[str] = Field(None, max_length=500)
    org_unit_id: Optional[UUID] = None
    reports_to_user_id: Optional[UUID] = None
    role_id: Optional[int] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6)


class ReportsToBrief(BaseModel):
    id: UUID
    matricule: str
    full_name: str
    role: Optional[str] = None


class UserRead(UserBase):
    id: UUID
    full_name: str
    role: Optional[str] = None
    role_label: Optional[str] = None
    must_change_password: Optional[bool] = False
    reports_to: Optional[ReportsToBrief] = None
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

    @model_validator(mode="before")
    @classmethod
    def _populate_role_fields(cls, data: Any) -> Any:
        # Derive role / role_label from the SQLAlchemy User.role relationship.
        if hasattr(data, "role") and not isinstance(data, dict):
            role_obj = getattr(data, "role", None)
            if role_obj is not None:
                reports_to_obj = getattr(data, "reports_to", None)
                reports_to_payload = None
                if reports_to_obj is not None:
                    rt_role_obj = getattr(reports_to_obj, "role", None)
                    reports_to_payload = {
                        "id": reports_to_obj.id,
                        "matricule": reports_to_obj.matricule,
                        "full_name": reports_to_obj.full_name,
                        "role": getattr(rt_role_obj, "code", None),
                    }
                values = {
                    "matricule": data.matricule,
                    "email": data.email,
                    "first_name": data.first_name,
                    "last_name": data.last_name,
                    "role_id": data.role_id,
                    "tenant_id": data.tenant_id,
                    "org_unit_id": data.org_unit_id,
                    "reports_to_user_id": getattr(data, "reports_to_user_id", None),
                    "phone": data.phone,
                    "avatar_url": data.avatar_url,
                    "profile_data": data.profile_data,
                    "is_active": data.is_active,
                    "must_change_password": getattr(
                        data, "must_change_password", False
                    ),
                    "reports_to": reports_to_payload,
                    "id": data.id,
                    "full_name": data.full_name,
                    "last_login": data.last_login,
                    "created_at": data.created_at,
                    "updated_at": data.updated_at,
                    "role": getattr(role_obj, "code", None),
                    "role_label": getattr(role_obj, "label", None),
                }
                return values
        return data


UserCreateResponse.model_rebuild()


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
