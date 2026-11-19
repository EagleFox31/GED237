"""Delegation during an absence (DEC-2026-007): create, list, revoke.

Business rules live in ``app.services.delegation_service``; the routes only
authorise (Casbin) and translate to HTTP.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy import and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import authorize_or_403
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.delegation import Delegation
from app.models.user import User
from app.schemas.delegation import (
    DelegationCandidate,
    DelegationCreate,
    DelegationRead,
    DelegationStatus,
)
from app.services import delegation_service as svc

router = APIRouter()


@router.post("", response_model=DelegationRead, status_code=status.HTTP_201_CREATED)
async def create_delegation(
    payload: DelegationCreate,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Designate a stand-in for an absent agent. 200 when the same delegation
    already exists (idempotent retry), 409 when another one overlaps."""
    await authorize_or_403(current_user, "delegations", "create")
    delegation, created = await svc.create_delegation(
        db, current_user, payload, request
    )
    if not created:
        response.status_code = status.HTTP_200_OK
    return delegation


@router.get("", response_model=List[DelegationRead])
async def list_delegations(
    status_: Optional[DelegationStatus] = Query(None, alias="status"),
    delegator_id: Optional[UUID] = None,
    delegate_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delegations of the manager's service, or of the whole institution."""
    await authorize_or_403(current_user, "delegations", "read")
    clauses = [svc.scope_filter(current_user)]
    if status_ is not None:
        clauses.append(svc.status_filter(status_, svc.utcnow()))
    if delegator_id is not None:
        clauses.append(Delegation.delegator_id == delegator_id)
    if delegate_id is not None:
        clauses.append(Delegation.delegate_id == delegate_id)
    return await svc.list_delegations(db, and_(*clauses))


@router.get("/mine", response_model=List[DelegationRead])
async def my_delegations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Active or upcoming delegations where the caller is absent or stands in.

    No Casbin check, like ``/users/me``: strictly filtered on the caller.
    """
    return await svc.list_delegations(db, svc.mine_filter(current_user, svc.utcnow()))


@router.get("/candidates", response_model=List[DelegationCandidate])
async def delegation_candidates(
    org_unit_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Agents of the caller's service, for the "absent agent" and "stand-in"
    lists. Same perimeter as POST /delegations; does not open GET /users."""
    await authorize_or_403(current_user, "delegations", "create")
    return await svc.list_candidates(db, current_user, org_unit_id)


@router.post("/{delegation_id}/revoke", response_model=DelegationRead)
async def revoke_delegation(
    delegation_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """End a delegation at once. Revoking twice writes nothing."""
    await authorize_or_403(current_user, "delegations", "update")
    return await svc.revoke_delegation(db, current_user, delegation_id, request)
