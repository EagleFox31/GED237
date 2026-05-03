# backend/app/api/v1/endpoints/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.authz import (
    authorize_or_403,
    AuthzContext,
    can_perform,
    ctx_from_resource,
)
from app.core.tenant_guard import assert_org_unit_scope
from app.models.user import User
from app.models.document import Document
from app.models.tenant import Tenant
from app.models.workflow import WorkflowStep
from app.schemas.user import (
    UserCreate,
    UserRead,
    UserUpdate,
    UserCreateResponse,
    ChangePasswordRequest,
)
from app.core.security import hash_password, verify_password
from app.services.email_service import send_account_created
import secrets

router = APIRouter()

# Tenant systeme : ses users (super_admins) sont invisibles aux roles non-super.
PLATFORM_TENANT_SHORT_NAME = "PLATFORM"


def _role_code(user: User) -> str:
    return (getattr(getattr(user, "role", None), "code", "") or "").lower()


async def _validate_reports_to(
    db: AsyncSession,
    *,
    user_id: Optional[UUID],
    tenant_id: UUID,
    reports_to_user_id: Optional[UUID],
) -> None:
    """Ensure the proposed N+1 is in the same tenant, not self, and creates no cycle."""
    if reports_to_user_id is None:
        return
    if user_id is not None and reports_to_user_id == user_id:
        raise HTTPException(
            status_code=422, detail="A user cannot report to themselves"
        )
    target = (
        await db.execute(select(User).filter(User.id == reports_to_user_id))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=422, detail="reports_to user not found")
    if target.tenant_id != tenant_id:
        raise HTTPException(
            status_code=422,
            detail="reports_to user must belong to the same institution",
        )
    # Cycle check : walk up the chain from target; if we meet user_id -> cycle.
    if user_id is not None:
        seen: set = set()
        cur: Optional[User] = target
        while cur is not None and cur.reports_to_user_id is not None:
            if cur.reports_to_user_id == user_id:
                raise HTTPException(status_code=422, detail="Hierarchy cycle detected")
            if cur.reports_to_user_id in seen:
                break
            seen.add(cur.reports_to_user_id)
            cur = (
                await db.execute(select(User).filter(User.id == cur.reports_to_user_id))
            ).scalar_one_or_none()


@router.post(
    "/", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED
)
async def create_user(
    user_in: UserCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new user within the same tenant.
    """
    await authorize_or_403(
        current_user,
        "users",
        "create",
        AuthzContext(tenant_id=user_in.tenant_id),
    )
    assert_org_unit_scope(user_in.org_unit_id, current_user)

    # Resolve role_code -> role_id when the client sent role_code instead of role_id.
    if user_in.role_id is None:
        if not user_in.role_code:
            raise HTTPException(
                status_code=422, detail="role_id or role_code is required"
            )
        from app.models.role import Role

        role_row = (
            await db.execute(select(Role).filter(Role.code == user_in.role_code))
        ).scalar_one_or_none()
        if role_row is None:
            raise HTTPException(
                status_code=422, detail=f"Unknown role_code: {user_in.role_code}"
            )
        user_in.role_id = role_row.id

    query = select(User).filter(
        User.matricule == user_in.matricule, User.tenant_id == user_in.tenant_id
    )
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400, detail="User matricule already exists in this tenant"
        )

    if user_in.email:
        email_query = select(User).filter(User.email == user_in.email)
        email_result = await db.execute(email_query)
        if email_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="User email already exists")

    await _validate_reports_to(
        db,
        user_id=None,
        tenant_id=user_in.tenant_id,
        reports_to_user_id=user_in.reports_to_user_id,
    )

    # Hash the password
    user_dict = user_in.dict()
    plain_password = user_dict.pop("password", None)
    user_dict.pop("role_code", None)  # not a User column

    # Auto-generate a strong one-time password when none was provided.
    # The user is forced to change it at first login (NIST SP 800-63B).
    generated_password: Optional[str] = None
    if not plain_password:
        plain_password = secrets.token_urlsafe(12)
        generated_password = plain_password
        user_dict["must_change_password"] = True

    hashed_password = hash_password(plain_password)

    db_user = User(**user_dict, password_hash=hashed_password)
    db.add(db_user)
    await db.commit()
    db_user = (
        await db.execute(
            select(User)
            .options(
                selectinload(User.role),
                selectinload(User.reports_to).selectinload(User.role),
            )
            .filter(User.id == db_user.id)
        )
    ).scalar_one()

    # Best-effort: email the credentials when we generated the password and have a target address.
    if generated_password and db_user.email:
        tenant_name: Optional[str] = None
        tenant_row = (
            await db.execute(select(Tenant).filter(Tenant.id == db_user.tenant_id))
        ).scalar_one_or_none()
        if tenant_row is not None:
            tenant_name = tenant_row.name
        full_name = (
            " ".join(p for p in [db_user.first_name, db_user.last_name] if p).strip()
            or None
        )
        send_account_created(
            to=db_user.email,
            full_name=full_name,
            matricule=db_user.matricule,
            temporary_password=generated_password,
            institution_name=tenant_name,
        )

    return UserCreateResponse(
        user=UserRead.model_validate(db_user), generated_password=generated_password
    )


@router.get("/me", response_model=UserRead)
async def read_user_me(current_user: User = Depends(get_current_user)):
    """
    Get current user profile.
    """
    return current_user


@router.get("/", response_model=List[UserRead])
async def read_users(
    skip: int = 0,
    limit: int = 100,
    org_unit_id: Optional[UUID] = None,
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve users.

    - super_admin : voit tous les users de tous les tenants (filtre `tenant_id` optionnel).
    - autres roles : scopes au tenant courant, users du tenant systeme PLATFORM masques.
    """
    await authorize_or_403(current_user, "users", "read")

    query = select(User).options(
        selectinload(User.role), selectinload(User.reports_to).selectinload(User.role)
    )
    # Meme heuristique que dans tenants.py : "tenants:manage" = super_admin
    is_super = await can_perform(current_user, "tenants", "manage")

    if is_super:
        if tenant_id is not None:
            query = query.filter(User.tenant_id == tenant_id)
    else:
        query = query.filter(User.tenant_id == current_user.tenant_id)
        # Les super_admins (tenant PLATFORM) ne remontent pas dans les listes tenant standards.
        query = query.join(Tenant, Tenant.id == User.tenant_id).filter(
            Tenant.short_name != PLATFORM_TENANT_SHORT_NAME
        )

    if _role_code(current_user) in {"manager", "reader"}:
        assert_org_unit_scope(current_user.org_unit_id, current_user)
        query = query.filter(User.org_unit_id == current_user.org_unit_id)
    elif org_unit_id:
        assert_org_unit_scope(org_unit_id, current_user)
        query = query.filter(User.org_unit_id == org_unit_id)

    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserRead)
async def read_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific user by ID.
    """
    query = (
        select(User)
        .options(
            selectinload(User.role),
            selectinload(User.reports_to).selectinload(User.role),
        )
        .filter(User.id == user_id, User.tenant_id == current_user.tenant_id)
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await authorize_or_403(current_user, "users", "read", ctx_from_resource(user))
    assert_org_unit_scope(user.org_unit_id, current_user)
    return user


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: UUID,
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update a user.
    """
    query = select(User).filter(
        User.id == user_id, User.tenant_id == current_user.tenant_id
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Mise à jour de son propre profil (update_own) ou admin (update)
    is_self = user_id == current_user.id
    action = "update_own" if is_self else "update"
    await authorize_or_403(current_user, "users", action, ctx_from_resource(user))
    assert_org_unit_scope(user.org_unit_id, current_user)

    update_data = user_in.dict(exclude_unset=True)

    if "org_unit_id" in update_data:
        assert_org_unit_scope(update_data["org_unit_id"], current_user)

    if "reports_to_user_id" in update_data:
        await _validate_reports_to(
            db,
            user_id=user.id,
            tenant_id=user.tenant_id,
            reports_to_user_id=update_data["reports_to_user_id"],
        )

    if "password" in update_data:
        plain_password = update_data.pop("password")
        user.password_hash = hash_password(plain_password)

    for field, value in update_data.items():
        setattr(user, field, value)

    db.add(user)
    await db.commit()
    user = (
        await db.execute(
            select(User)
            .options(
                selectinload(User.role),
                selectinload(User.reports_to).selectinload(User.role),
            )
            .filter(User.id == user.id)
        )
    ).scalar_one()
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a user.
    Blocked if the user owns active (non-trashed) documents or
    has workflow steps currently assigned to them.
    """
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    query = select(User).filter(
        User.id == user_id, User.tenant_id == current_user.tenant_id
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await authorize_or_403(current_user, "users", "delete", ctx_from_resource(user))
    assert_org_unit_scope(user.org_unit_id, current_user)

    # Check for active documents owned by this user
    doc_count_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.owner_id == user_id,
            Document.deleted_at.is_(None),
        )
    )
    doc_count = doc_count_result.scalar_one()
    if doc_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot delete user: {doc_count} active document(s) are owned by this user. "
                "Reassign or archive them first."
            ),
        )

    # Check for active workflow steps assigned to this user
    step_count_result = await db.execute(
        select(func.count(WorkflowStep.id)).where(
            WorkflowStep.assigned_to == user_id,
            WorkflowStep.status.in_(["current", "pending"]),
        )
    )
    step_count = step_count_result.scalar_one()
    if step_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot delete user: {step_count} active workflow step(s) are assigned to this user. "
                "Reassign or complete them first."
            ),
        )

    await db.delete(user)
    await db.commit()
    return None


@router.get("/{user_id}/hierarchy-up", response_model=List[UserRead])
async def get_hierarchy_up(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the chain of managers above this user, ordered N+1, N+2, ..."""
    user = (
        await db.execute(
            select(User)
            .options(selectinload(User.role))
            .filter(User.id == user_id, User.tenant_id == current_user.tenant_id)
        )
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await authorize_or_403(current_user, "users", "read", ctx_from_resource(user))

    chain: List[User] = []
    seen: set = set()
    cur_id = user.reports_to_user_id
    while cur_id and cur_id not in seen:
        seen.add(cur_id)
        nxt = (
            await db.execute(
                select(User)
                .options(
                    selectinload(User.role),
                    selectinload(User.reports_to).selectinload(User.role),
                )
                .filter(User.id == cur_id)
            )
        ).scalar_one_or_none()
        if nxt is None:
            break
        chain.append(nxt)
        cur_id = nxt.reports_to_user_id
    return chain


@router.get("/{user_id}/hierarchy-down", response_model=List[UserRead])
async def get_hierarchy_down(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all direct subordinates (one level down)."""
    user = (
        await db.execute(
            select(User).filter(
                User.id == user_id, User.tenant_id == current_user.tenant_id
            )
        )
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await authorize_or_403(current_user, "users", "read", ctx_from_resource(user))

    rows = (
        (
            await db.execute(
                select(User)
                .options(
                    selectinload(User.role),
                    selectinload(User.reports_to).selectinload(User.role),
                )
                .filter(User.reports_to_user_id == user_id)
                .order_by(User.matricule)
            )
        )
        .scalars()
        .all()
    )
    return rows
