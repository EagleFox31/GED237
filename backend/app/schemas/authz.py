# backend/app/schemas/authz.py
from typing import Optional, Literal

from pydantic import BaseModel, field_validator, model_validator


class PolicyRule(BaseModel):
    ptype: Literal["p"] = "p"
    v0: str
    v1: str
    v2: str
    v3: Optional[str] = None
    v4: Optional[str] = None
    v5: Optional[str] = None

    @field_validator("v0", "v1", "v2", "v3", "v4", "v5", mode="before")
    @classmethod
    def strip_optional_str(cls, value):
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    @model_validator(mode="after")
    def validate_no_internal_holes(self):
        # Prevent semantic column shifts: v4/v5 cannot be set when previous cols are empty.
        if self.v4 is not None and self.v3 is None:
            raise ValueError("Invalid policy shape: v4 requires v3.")
        if self.v5 is not None and self.v4 is None:
            raise ValueError("Invalid policy shape: v5 requires v4.")
        return self


class PolicyMutationResponse(BaseModel):
    created: bool
    policy: PolicyRule


class PolicyDeleteResponse(BaseModel):
    deleted: bool
    policy: PolicyRule


class AuthzMetricPoint(BaseModel):
    decision: Literal["allow", "deny"]
    role: str
    resource: str
    action: str
    tenant_id: str
    reason: str
    count: int


class AuthzMetricsResetResponse(BaseModel):
    reset: bool


class AuthzMetricsHealthResponse(BaseModel):
    backend: Literal["memory", "redis"]
    dropped_count: int
    degraded: bool
