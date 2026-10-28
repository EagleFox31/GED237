"""Lightweight usage telemetry endpoints.

POST ``/local-organize`` persists anonymous counters in ``local_organize_events``
(and mirrors /audit) so tenant admins can measure adoption in /reports.

GET/PUT/DELETE ``/local-arrangement-snapshot`` store the **latest** detailed
manifest per user (names + relative paths produced by the client organizer)
when the front sends it — so the bibliothèque view can follow the user across
browsers. Filenames only reach the server if the client chooses to sync.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.audit import AuditLog
from app.models.local_organize_event import LocalOrganizeEvent
from app.models.user import User
from app.models.user_local_arrangement_snapshot import UserLocalArrangementSnapshot
from app.schemas.usage import (
    LocalArrangementSnapshotEnvelope,
    LocalArrangementSnapshotUpsert,
    LocalOrganizeEventCreate,
    LocalOrganizeEventOut,
)

router = APIRouter()


@router.post(
    "/local-organize",
    response_model=LocalOrganizeEventOut,
    status_code=status.HTTP_201_CREATED,
)
async def record_local_organize_event(
    payload: LocalOrganizeEventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LocalOrganizeEvent:
    event = LocalOrganizeEvent(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        file_count=payload.file_count,
        folders_created=payload.folders_created,
        files_unranged=payload.files_unranged,
        strategy=payload.strategy,
        mode=payload.mode,
    )
    db.add(event)
    await db.flush()  # nécessaire pour récupérer event.id avant l'audit log

    audit_entry = AuditLog(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        table_name="local_organize_events",
        record_id=event.id,
        action="local_organize",
        new_data={
            "file_count": payload.file_count,
            "folders_created": payload.folders_created,
            "files_unranged": payload.files_unranged,
            "strategy": payload.strategy,
            "mode": payload.mode,
        },
    )
    db.add(audit_entry)
    await db.commit()
    await db.refresh(event)
    return event


@router.get(
    "/local-arrangement-snapshot",
    response_model=LocalArrangementSnapshotEnvelope,
)
async def get_local_arrangement_snapshot(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LocalArrangementSnapshotEnvelope:
    row = await db.scalar(
        select(UserLocalArrangementSnapshot).where(
            UserLocalArrangementSnapshot.user_id == current_user.id,
            UserLocalArrangementSnapshot.tenant_id == current_user.tenant_id,
        )
    )
    if row is None:
        return LocalArrangementSnapshotEnvelope(snapshot=None)
    snapshot = LocalArrangementSnapshotUpsert.model_validate(row.payload)
    return LocalArrangementSnapshotEnvelope(snapshot=snapshot)


@router.put(
    "/local-arrangement-snapshot",
    response_model=LocalArrangementSnapshotEnvelope,
)
async def upsert_local_arrangement_snapshot(
    payload: LocalArrangementSnapshotUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LocalArrangementSnapshotEnvelope:
    dumped = payload.model_dump(mode="json")
    existing = await db.scalar(
        select(UserLocalArrangementSnapshot).where(
            UserLocalArrangementSnapshot.user_id == current_user.id,
        )
    )
    if existing:
        existing.payload = dumped
        existing.tenant_id = current_user.tenant_id
    else:
        db.add(
            UserLocalArrangementSnapshot(
                user_id=current_user.id,
                tenant_id=current_user.tenant_id,
                payload=dumped,
            )
        )

    audit_entry = AuditLog(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        table_name="user_local_arrangement_snapshots",
        record_id=current_user.id,
        action="local_snap_put",
        new_data={
            "total_files": payload.total_files,
            "total_folders": payload.total_folders,
            "files_unranged": payload.files_unranged,
            "strategy": payload.strategy,
            "mode": payload.mode,
        },
    )
    db.add(audit_entry)
    await db.commit()

    return LocalArrangementSnapshotEnvelope(snapshot=payload)


@router.delete(
    "/local-arrangement-snapshot",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_local_arrangement_snapshot(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.execute(
        delete(UserLocalArrangementSnapshot).where(
            UserLocalArrangementSnapshot.user_id == current_user.id,
            UserLocalArrangementSnapshot.tenant_id == current_user.tenant_id,
        )
    )
    await db.commit()
