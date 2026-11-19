"""Unit administrator scope: own unit and its sub-units.

Same rule as ``reports_scope`` (``unit_subtree_ids`` / ``is_within_unit_tree``): this
module only adds the async helpers for the routes that scope by a unit set or check a
single unit, so there is one definition of "tree" in the code base.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.reports_scope import is_within_unit_tree, unit_subtree_ids

UNIT_ADMIN = "unit_admin"


def is_unit_admin(user: User) -> bool:
    return (
        getattr(getattr(user, "role", None), "code", "") or ""
    ).lower() == UNIT_ADMIN


async def unit_admin_scope_ids(db: AsyncSession, user: User) -> Optional[List[UUID]]:
    """``None``: not a unit_admin, no restriction here. Otherwise the visible units
    (empty when the account has no unit: nothing is visible)."""
    if not is_unit_admin(user):
        return None
    if not user.org_unit_id:
        return []
    rows = await db.execute(select(unit_subtree_ids(user.org_unit_id).subquery()))
    return [r[0] for r in rows.all()]


async def assert_unit_admin_object_in_tree(
    db: AsyncSession, resource_org_unit_id: Optional[UUID], user: User
) -> None:
    """404 when a unit_admin addresses, by id, an object outside own tree (the
    object must not be revealed); no-op for other roles."""
    if not is_unit_admin(user):
        return
    if (
        resource_org_unit_id is None
        or user.org_unit_id is None
        or not await is_within_unit_tree(db, resource_org_unit_id, user.org_unit_id)
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


async def assert_unit_admin_in_tree(
    db: AsyncSession, resource_org_unit_id: Optional[UUID], user: User
) -> None:
    """403 when a unit_admin targets a unit outside own tree; no-op for other roles."""
    if not is_unit_admin(user):
        return
    if (
        resource_org_unit_id is None
        or user.org_unit_id is None
        or not await is_within_unit_tree(db, resource_org_unit_id, user.org_unit_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès hors périmètre organisationnel refusé.",
        )
