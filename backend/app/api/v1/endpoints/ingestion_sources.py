# backend/app/api/v1/endpoints/ingestion_sources.py
"""Ingestion sources of a tenant (F-NEXT-01): CRUD and on-demand run.

A local or smb source is a server path under INGEST_ALLOWED_ROOTS, collected by
the same DirectoryIngestionService as POST /documents/ingest-directory. An agent
source gets a key shown once; its push route comes with the agent.
"""

import hashlib
import logging
import secrets
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import authorize_or_403, ctx_from_resource
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.errors.domain import IngestPathForbiddenError
from app.core.redis import get_redis
from app.models.document_category import DocumentCategory
from app.models.ingestion_source import IngestionSource
from app.models.org_unit import OrgUnit
from app.models.user import User
from app.schemas.ingestion_source import (
    IngestionSourceCreate,
    IngestionSourceResponse,
    IngestionSourceRunResponse,
    IngestionSourceUpdate,
    IngestionSourceWithKey,
)
from app.services.audit_trail import audit_entry
from app.services.ingestion import DirectoryIngestionService

router = APIRouter()
logger = logging.getLogger(__name__)

RESOURCE = "ingestion_sources"
# A run holds this lock; a crashed run frees the source after this delay.
RUN_LOCK_SECONDS = 3600


def _new_agent_key() -> tuple[str, str, str]:
    """(key shown once, its SHA-256 stored, its prefix stored)."""
    agent_key = "ged_src_" + secrets.token_urlsafe(32)
    return agent_key, hashlib.sha256(agent_key.encode()).hexdigest(), agent_key[:12]


def _run_lock_key(source_id: uuid.UUID) -> str:
    return f"ingestion_source_run:{source_id}"


def _audit(request: Request, user: User, source_id, action: str, details: dict):
    return audit_entry(
        tenant_id=user.tenant_id,
        user_id=user.id,
        table_name=RESOURCE,
        record_id=source_id,
        action=action,
        details=details,
        request=request,
    )


async def _get_source_or_404(
    db: AsyncSession, tenant_id: uuid.UUID, source_id: uuid.UUID
) -> IngestionSource:
    source = (
        await db.execute(
            select(IngestionSource).where(
                IngestionSource.id == source_id,
                IngestionSource.tenant_id == tenant_id,
            )
        )
    ).scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=404, detail="Ingestion source not found")
    return source


async def _check_targets(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    org_unit_id: Optional[uuid.UUID],
    owner_id: Optional[uuid.UUID],
    document_category_id: Optional[uuid.UUID],
) -> None:
    """Everything a source points to belongs to the caller's tenant."""
    checks = (
        (org_unit_id, OrgUnit, "org_unit_id"),
        (owner_id, User, "owner_id"),
        (document_category_id, DocumentCategory, "document_category_id"),
    )
    for value, model, field in checks:
        if value is None:
            continue
        found = (
            await db.execute(
                select(model.id).where(model.id == value, model.tenant_id == tenant_id)
            )
        ).scalar_one_or_none()
        if found is None:
            raise HTTPException(status_code=400, detail=f"Unknown {field}")
    if owner_id is not None:
        active = (
            await db.execute(select(User.is_active).where(User.id == owner_id))
        ).scalar_one()
        if not active:
            raise HTTPException(status_code=400, detail="owner_id is disabled")


def _check_path(db: AsyncSession, path: str) -> str:
    """The path as stored: stripped, and under INGEST_ALLOWED_ROOTS (403 otherwise)."""
    path = path.strip()
    DirectoryIngestionService(db).resolve_source_dir(path)
    return path


async def _ensure_unique_name(
    db: AsyncSession, tenant_id: uuid.UUID, name: str, exclude: Optional[uuid.UUID]
) -> None:
    stmt = select(IngestionSource.id).where(
        IngestionSource.tenant_id == tenant_id, IngestionSource.name == name
    )
    if exclude is not None:
        stmt = stmt.where(IngestionSource.id != exclude)
    if (await db.execute(stmt)).first() is not None:
        raise HTTPException(
            status_code=409, detail="An ingestion source with this name already exists"
        )


@router.get("/", response_model=List[IngestionSourceResponse])
async def list_ingestion_sources(
    enabled: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sources of the caller's tenant, by name."""
    await authorize_or_403(current_user, RESOURCE, "read")
    stmt = select(IngestionSource).where(
        IngestionSource.tenant_id == current_user.tenant_id
    )
    if enabled is not None:
        stmt = stmt.where(IngestionSource.enabled.is_(enabled))
    result = await db.execute(stmt.order_by(IngestionSource.name.asc()))
    return result.scalars().all()


@router.post(
    "/", response_model=IngestionSourceWithKey, status_code=status.HTTP_201_CREATED
)
async def create_ingestion_source(
    payload: IngestionSourceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a source. An agent source's key is in this response only."""
    await authorize_or_403(current_user, RESOURCE, "create")
    tenant_id = current_user.tenant_id
    org_unit_id = payload.org_unit_id or current_user.org_unit_id
    if org_unit_id is None:
        raise HTTPException(status_code=400, detail="org_unit_id is required")
    owner_id = payload.owner_id or current_user.id
    await _check_targets(
        db, tenant_id, org_unit_id, owner_id, payload.document_category_id
    )
    name = payload.name.strip()
    await _ensure_unique_name(db, tenant_id, name, exclude=None)

    source = IngestionSource(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        name=name,
        source_type=payload.source_type,
        credentials_ref=payload.credentials_ref,
        org_unit_id=org_unit_id,
        owner_id=owner_id,
        document_category_id=payload.document_category_id,
        recursive=payload.recursive,
        processing_mode=payload.processing_mode,
        enabled=payload.enabled,
    )
    agent_key = None
    if payload.source_type == "agent":
        agent_key, source.agent_key_hash, source.agent_key_prefix = _new_agent_key()
    else:
        source.path = _check_path(db, payload.path)

    db.add(source)
    db.add(
        _audit(
            request,
            current_user,
            source.id,
            "create",
            {"name": name, "source_type": payload.source_type},
        )
    )
    await db.commit()
    await db.refresh(source)
    response = IngestionSourceWithKey.model_validate(source)
    response.agent_key = agent_key
    return response


@router.get("/{source_id}", response_model=IngestionSourceResponse)
async def get_ingestion_source(
    source_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = await _get_source_or_404(db, current_user.tenant_id, source_id)
    await authorize_or_403(current_user, RESOURCE, "read", ctx_from_resource(source))
    return source


@router.patch("/{source_id}", response_model=IngestionSourceResponse)
async def update_ingestion_source(
    source_id: uuid.UUID,
    payload: IngestionSourceUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = await _get_source_or_404(db, current_user.tenant_id, source_id)
    await authorize_or_403(current_user, RESOURCE, "update", ctx_from_resource(source))
    changes = payload.model_dump(exclude_unset=True)
    for field in ("org_unit_id", "owner_id", "name", "recursive", "processing_mode"):
        if field in changes and changes[field] is None:
            raise HTTPException(status_code=400, detail=f"{field} cannot be null")

    if source.source_type == "agent" and (
        changes.get("path") or changes.get("credentials_ref")
    ):
        raise HTTPException(
            status_code=400, detail="An agent source has no server path"
        )
    if source.source_type == "local" and changes.get("credentials_ref"):
        raise HTTPException(
            status_code=400, detail="credentials_ref is for smb sources only"
        )
    if source.source_type != "agent" and "path" in changes:
        if changes["path"] is None:
            raise HTTPException(status_code=400, detail="path cannot be null")
        changes["path"] = _check_path(db, changes["path"])
    if "name" in changes:
        changes["name"] = changes["name"].strip()
        await _ensure_unique_name(
            db, current_user.tenant_id, changes["name"], exclude=source.id
        )
    await _check_targets(
        db,
        current_user.tenant_id,
        changes.get("org_unit_id"),
        changes.get("owner_id"),
        changes.get("document_category_id"),
    )

    changed = sorted(f for f, v in changes.items() if getattr(source, f) != v)
    for field in changed:
        setattr(source, field, changes[field])
    if changed:
        db.add(_audit(request, current_user, source.id, "update", {"fields": changed}))
        await db.commit()
        await db.refresh(source)
    return source


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ingestion_source(
    source_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Removes the source; documents it already collected stay where they are."""
    source = await _get_source_or_404(db, current_user.tenant_id, source_id)
    await authorize_or_403(current_user, RESOURCE, "delete", ctx_from_resource(source))
    db.add(
        _audit(
            request,
            current_user,
            source.id,
            "delete",
            {"name": source.name, "source_type": source.source_type},
        )
    )
    await db.delete(source)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{source_id}/rotate-key", response_model=IngestionSourceWithKey)
async def rotate_agent_key(
    source_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """New key for an agent source; the old one stops working at once."""
    source = await _get_source_or_404(db, current_user.tenant_id, source_id)
    await authorize_or_403(current_user, RESOURCE, "update", ctx_from_resource(source))
    if source.source_type != "agent":
        raise HTTPException(status_code=409, detail="Only an agent source has a key")
    agent_key, source.agent_key_hash, source.agent_key_prefix = _new_agent_key()
    db.add(
        _audit(
            request,
            current_user,
            source.id,
            "agent_key_rotated",
            {"agent_key_prefix": source.agent_key_prefix},
        )
    )
    await db.commit()
    await db.refresh(source)
    response = IngestionSourceWithKey.model_validate(source)
    response.agent_key = agent_key
    return response


def _run_status(report: dict) -> str:
    if report["error_count"] == 0:
        return "success"
    return "partial" if report["imported"] > 0 else "failed"


@router.post("/{source_id}/run", response_model=IngestionSourceRunResponse)
async def run_ingestion_source(
    source_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Collects a local or smb source now. One run at a time per source (409)."""
    source = await _get_source_or_404(db, current_user.tenant_id, source_id)
    await authorize_or_403(current_user, RESOURCE, "update", ctx_from_resource(source))
    if source.source_type == "agent":
        raise HTTPException(
            status_code=409, detail="An agent source is pushed by its agent"
        )
    if not source.enabled:
        raise HTTPException(status_code=409, detail="This source is disabled")

    redis = await get_redis()
    lock = _run_lock_key(source.id)
    if not await redis.set(lock, "1", nx=True, ex=RUN_LOCK_SECONDS):
        raise HTTPException(
            status_code=409, detail="This source is already being collected"
        )
    # The ingestion commits file by file and rolls back on a failed one, which
    # expires the loaded source: keep what the run needs in plain values.
    params = {
        "source_dir": source.path,
        "tenant_id": source.tenant_id,
        "org_unit_id": source.org_unit_id,
        "owner_id": source.owner_id,
        "recursive": source.recursive,
        "document_category_id": source.document_category_id,
        "processing_mode": source.processing_mode,
    }
    forbidden: Optional[IngestPathForbiddenError] = None
    try:
        try:
            result = await DirectoryIngestionService(db).ingest(**params)
            report = result.to_dict()
        except IngestPathForbiddenError as exc:
            # INGEST_ALLOWED_ROOTS changed since the source was saved.
            logger.warning(
                "[Ingestion] source %s refused: %r is outside INGEST_ALLOWED_ROOTS",
                source_id,
                params["source_dir"],
            )
            forbidden = exc
            report = {
                "total_found": 0,
                "imported": 0,
                "skipped": 0,
                "error_count": 1,
                "errors": [
                    {"file": params["source_dir"], "error": "Emplacement non autorisé"}
                ],
                "details": [],
                "duplicate_count": 0,
            }

        ran_at = datetime.utcnow()
        run_status = _run_status(report)
        summary = {
            key: report[key]
            for key in (
                "total_found",
                "imported",
                "skipped",
                "error_count",
                "duplicate_count",
            )
        }
        source = await db.get(IngestionSource, source_id, populate_existing=True)
        source.last_run_at = ran_at
        source.last_run_status = run_status
        source.last_run_report = summary
        db.add(
            _audit(
                request,
                current_user,
                source_id,
                "ingestion_source_run",
                {"status": run_status, **summary},
            )
        )
        await db.commit()
    finally:
        await redis.delete(lock)

    if forbidden is not None:
        raise forbidden
    return IngestionSourceRunResponse(
        **report, source_id=source_id, status=run_status, ran_at=ran_at
    )
