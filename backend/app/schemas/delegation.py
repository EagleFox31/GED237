"""Delegation during an absence (DEC-2026-007)."""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import AwareDatetime, BaseModel

DelegationStatus = Literal["scheduled", "active", "ended", "revoked"]


class DelegationCreate(BaseModel):
    delegator_id: UUID
    delegate_id: UUID
    # Timezone required: a naive date is ambiguous across the institution's sites.
    starts_at: AwareDatetime
    ends_at: AwareDatetime


class DelegationUser(BaseModel):
    id: UUID
    full_name: str


class DelegationCandidate(BaseModel):
    """An agent the caller may name as absent agent or as stand-in."""

    id: UUID
    full_name: str
    org_unit_id: UUID
    role: str  # role code
    # Holds ``workflows resolve_review``: only these may be named as stand-in.
    can_stand_in: bool


class DelegationRead(BaseModel):
    id: UUID
    org_unit_id: UUID
    delegator: DelegationUser
    delegate: DelegationUser
    starts_at: datetime
    ends_at: datetime
    revoked_at: Optional[datetime] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    status: DelegationStatus
