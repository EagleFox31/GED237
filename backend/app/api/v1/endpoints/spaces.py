from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.documents import get_org_unit_tree, list_workspace_documents
from app.core.authz import authorize_or_403
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.document import DocumentRead
from app.schemas.org_unit import OrgUnitTreeNode

router = APIRouter()


@router.get("/tree", response_model=List[OrgUnitTreeNode])
async def get_spaces_tree(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "spaces", "read")
    # Reuse the workspace tree builder, which only builds the tenant-scoped tree.
    # Calling the org-units HTTP endpoint here would apply a second,
    # contradictory org_units:read authorization after spaces:read succeeded.
    return await get_org_unit_tree(current_user=current_user, db=db)


@router.get("/documents", response_model=List[DocumentRead])
async def list_space_documents(
    org_unit_id: Optional[UUID] = None,
    recursive: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "spaces", "read")
    return await list_workspace_documents(
        org_unit_id=org_unit_id,
        recursive=recursive,
        current_user=current_user,
        db=db,
    )
