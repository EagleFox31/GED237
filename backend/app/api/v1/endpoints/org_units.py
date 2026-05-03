# backend/app/api/v1/endpoints/org_units.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.authz import (
    authorize_or_403,
    AuthzContext,
    ctx_from_resource,
    can_perform,
)
from app.core.tenant_guard import assert_org_unit_scope
from app.models.user import User
from app.models.org_unit import OrgUnit, OrgUnitType
from app.models.document import Document
from app.schemas.org_unit import OrgUnitCreate, OrgUnitRead, OrgUnitTreeNode, OrgUnitUpdate

router = APIRouter()


@router.get("/types")
async def list_org_unit_types(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Liste les types d'unité (Ministère, Direction, Sous-Direction, Service…) ordonnés par niveau."""
    result = await db.execute(select(OrgUnitType).order_by(OrgUnitType.level.asc()))
    types = result.scalars().all()
    return [
        {"id": t.id, "code": t.code, "label": t.label, "level": t.level} for t in types
    ]


def _role_code(user: User) -> str:
    return (getattr(getattr(user, "role", None), "code", "") or "").lower()


@router.post("/", response_model=OrgUnitRead, status_code=status.HTTP_201_CREATED)
async def create_org_unit(
    org_unit_in: OrgUnitCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new org unit.
    """
    await authorize_or_403(
        current_user,
        "org_units",
        "create",
        AuthzContext(tenant_id=org_unit_in.tenant_id),
    )
    assert_org_unit_scope(org_unit_in.parent_id, current_user)

    query = select(OrgUnit).filter(
        OrgUnit.code == org_unit_in.code, OrgUnit.tenant_id == org_unit_in.tenant_id
    )
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400, detail="OrgUnit code already exists in this tenant"
        )

    db_org_unit = OrgUnit(**org_unit_in.dict())
    db.add(db_org_unit)
    await db.commit()
    await db.refresh(db_org_unit)
    return db_org_unit


@router.get("/tree", response_model=List[OrgUnitTreeNode])
async def get_org_units_tree(
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the hierarchy of organization units for the current tenant as a tree.
    Used by the frontend OrgDashboard and DisplaySettings components.
    Super_admin peut passer ?tenant_id= pour voir l'arbre d'un autre tenant.
    """
    await authorize_or_403(current_user, "org_units", "read")

    is_super = await can_perform(current_user, "tenants", "manage")
    effective_tenant = tenant_id if (is_super and tenant_id) else current_user.tenant_id

    query = (
        select(OrgUnit)
        .where(OrgUnit.tenant_id == effective_tenant, OrgUnit.is_active.is_(True))
        .order_by(OrgUnit.level, OrgUnit.name)
    )
    result = await db.execute(query)
    units = result.scalars().all()

    if not is_super and _role_code(current_user) in {"manager", "reader"}:
        assert_org_unit_scope(current_user.org_unit_id, current_user)
        units = [u for u in units if str(u.id) == str(current_user.org_unit_id)]

    nodes = {
        str(u.id): {
            "id": str(u.id),
            "name": u.name,
            "code": u.code,
            "level": u.level,
            "parent_id": str(u.parent_id) if u.parent_id else None,
            "children": [],
        }
        for u in units
    }

    tree = []
    for node in nodes.values():
        parent_id = node["parent_id"]
        if parent_id and parent_id in nodes:
            nodes[parent_id]["children"].append(node)
        elif not parent_id:
            tree.append(node)

    return tree


@router.get("/", response_model=List[OrgUnitRead])
async def read_org_units(
    skip: int = 0,
    limit: int = 100,
    parent_id: Optional[UUID] = None,
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve org units.
    - super_admin : peut filtrer par ?tenant_id= pour voir les services d'un tenant.
    - autres roles : scopes au tenant courant.
    """
    await authorize_or_403(current_user, "org_units", "read")

    is_super = await can_perform(current_user, "tenants", "manage")
    effective_tenant = tenant_id if (is_super and tenant_id) else current_user.tenant_id

    query = select(OrgUnit).filter(OrgUnit.tenant_id == effective_tenant)

    if not is_super and _role_code(current_user) in {"manager", "reader"}:
        assert_org_unit_scope(current_user.org_unit_id, current_user)
        query = query.filter(OrgUnit.id == current_user.org_unit_id)
    elif parent_id is not None:
        assert_org_unit_scope(parent_id, current_user)
        query = query.filter(OrgUnit.parent_id == parent_id)

    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/{org_unit_id}", response_model=OrgUnitRead)
async def read_org_unit(
    org_unit_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific org unit by ID.
    """
    query = select(OrgUnit).filter(
        OrgUnit.id == org_unit_id, OrgUnit.tenant_id == current_user.tenant_id
    )
    result = await db.execute(query)
    org_unit = result.scalar_one_or_none()

    if not org_unit:
        raise HTTPException(status_code=404, detail="OrgUnit not found")

    await authorize_or_403(
        current_user, "org_units", "read", ctx_from_resource(org_unit)
    )
    assert_org_unit_scope(org_unit.id, current_user)
    return org_unit


@router.patch("/{org_unit_id}", response_model=OrgUnitRead)
async def update_org_unit(
    org_unit_id: UUID,
    org_unit_in: OrgUnitUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update an org unit.
    """
    query = select(OrgUnit).filter(
        OrgUnit.id == org_unit_id, OrgUnit.tenant_id == current_user.tenant_id
    )
    result = await db.execute(query)
    org_unit = result.scalar_one_or_none()

    if not org_unit:
        raise HTTPException(status_code=404, detail="OrgUnit not found")

    await authorize_or_403(
        current_user, "org_units", "update", ctx_from_resource(org_unit)
    )
    assert_org_unit_scope(org_unit.id, current_user)

    update_data = org_unit_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(org_unit, field, value)

    db.add(org_unit)
    await db.commit()
    await db.refresh(org_unit)
    return org_unit


@router.delete("/{org_unit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_org_unit(
    org_unit_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete an org unit.
    Blocked if the unit has child units, active users, or active documents.
    """
    query = select(OrgUnit).filter(
        OrgUnit.id == org_unit_id, OrgUnit.tenant_id == current_user.tenant_id
    )
    result = await db.execute(query)
    org_unit = result.scalar_one_or_none()

    if not org_unit:
        raise HTTPException(status_code=404, detail="OrgUnit not found")

    await authorize_or_403(
        current_user, "org_units", "delete", ctx_from_resource(org_unit)
    )
    assert_org_unit_scope(org_unit.id, current_user)

    # Block if child org units exist
    children_count_result = await db.execute(
        select(func.count(OrgUnit.id)).where(OrgUnit.parent_id == org_unit_id)
    )
    children_count = children_count_result.scalar_one()
    if children_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot delete org unit: {children_count} child unit(s) exist. "
                "Delete or reassign them first."
            ),
        )

    # Block if active users are attached to this unit
    user_count_result = await db.execute(
        select(func.count(User.id)).where(
            User.org_unit_id == org_unit_id,
            User.is_active.is_(True),
        )
    )
    user_count = user_count_result.scalar_one()
    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot delete org unit: {user_count} active user(s) are attached to it. "
                "Reassign them first."
            ),
        )

    # Block if active documents belong to this unit
    doc_count_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.org_unit_id == org_unit_id,
            Document.deleted_at.is_(None),
        )
    )
    doc_count = doc_count_result.scalar_one()
    if doc_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot delete org unit: {doc_count} active document(s) are stored in it. "
                "Archive or move them first."
            ),
        )

    await db.delete(org_unit)
    await db.commit()
    return None
