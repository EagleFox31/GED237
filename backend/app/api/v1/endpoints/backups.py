"""Scheduled backup state (post-rc1 lot 13), for the platform super admin."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.scheduled_backup import backup_status

router = APIRouter()


@router.get("/status")
async def get_backup_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Last run, last success and ``alert``: None, "failed" or "stale"."""
    role_code = (getattr(getattr(current_user, "role", None), "code", "") or "").lower()
    if role_code != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Super admin required."
        )
    return await backup_status(db)
