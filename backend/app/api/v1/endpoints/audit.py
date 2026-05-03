# backend/app/api/v1/endpoints/audit.py
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.authz import authorize_or_403
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.user import User

router = APIRouter()


TABLE_LABELS = {
    "documents": "Documents",
    "workflows": "Workflows",
    "users": "Utilisateurs",
    "ged_rules": "Regles GED",
}

ACTION_LABELS = {
    "create": "Creation",
    "update": "Modification",
    "delete": "Suppression",
    "upload": "Depot de document",
    "content_viewed": "Consultation du document",
    "classification": "Tentative de classement",
    "needs_review": "Mise en attente pour arbitrage",
    "review_resolved": "Arbitrage de classement valide",
    "workflow_started": "Circuit declenche",
    "workflow_step_completed": "Etape de workflow traitee",
    "workflow_approved": "Validation",
    "workflow_rejected": "Rejet",
    "workflow_returned": "Retour pour correction",
    "lock": "Verrouillage",
    "unlock": "Deverrouillage",
    "archive": "Archivage",
}


def _extract_resource_label(log: AuditLog, documents_by_id: dict[UUID, Document]) -> str:
    if log.table_name == "documents":
        document = documents_by_id.get(log.record_id)
        if document is not None:
            return document.title

    for payload in (log.new_data, log.old_data):
        if not isinstance(payload, dict):
            continue
        for key in ("document_title", "title", "name", "rule_name", "label", "filename"):
            value = payload.get(key)
            if value:
                return str(value)

    table_label = TABLE_LABELS.get(log.table_name, log.table_name.replace("_", " ").title())
    return f"{table_label} #{str(log.record_id)[:8]}"


def _extract_detail(log: AuditLog) -> str:
    payloads = [log.new_data, log.old_data]
    detail_candidates = (
        "comment",
        "message",
        "reason",
        "arbitration_reason",
        "logical_space_path",
        "status",
        "classification_scope",
    )
    for payload in payloads:
        if not isinstance(payload, dict):
            continue
        for key in detail_candidates:
            value = payload.get(key)
            if value:
                return str(value)
    return "Action tracee automatiquement par le systeme."


def _serialize_audit_log(
    log: AuditLog,
    *,
    actors_by_id: dict[UUID, User],
    documents_by_id: dict[UUID, Document],
) -> dict[str, Any]:
    actor = actors_by_id.get(log.user_id) if log.user_id else None
    return {
        "id": str(log.id),
        "tenant_id": str(log.tenant_id) if log.tenant_id else None,
        "user_id": str(log.user_id) if log.user_id else None,
        "user_name": actor.full_name if actor else None,
        "user_matricule": actor.matricule if actor else None,
        "table_name": log.table_name,
        "table_label": TABLE_LABELS.get(
            log.table_name, log.table_name.replace("_", " ").title()
        ),
        "record_id": str(log.record_id),
        "resource_label": _extract_resource_label(log, documents_by_id),
        "action": log.action,
        "action_label": ACTION_LABELS.get(
            (log.action or "").lower(), log.action.replace("_", " ").title()
        ),
        "detail": _extract_detail(log),
        "old_data": log.old_data,
        "new_data": log.new_data,
        "ip_address": str(log.ip_address) if log.ip_address else None,
        "user_agent": log.user_agent,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


@router.get("/logs")
async def list_audit_logs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    table_name: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "audit_logs", "read")

    query = select(AuditLog).where(AuditLog.tenant_id == current_user.tenant_id)

    if table_name:
        query = query.where(AuditLog.table_name == table_name)
    if action:
        query = query.where(func.lower(AuditLog.action) == action.lower())

    query = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    logs = list(result.scalars().all())

    user_ids = sorted({log.user_id for log in logs if log.user_id}, key=str)
    document_ids = sorted(
        {log.record_id for log in logs if log.table_name == "documents"}, key=str
    )

    actors_by_id: dict[UUID, User] = {}
    if user_ids:
        actors_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        actors_by_id = {actor.id: actor for actor in actors_result.scalars().all()}

    documents_by_id: dict[UUID, Document] = {}
    if document_ids:
        documents_result = await db.execute(
            select(Document).where(Document.id.in_(document_ids))
        )
        documents_by_id = {
            document.id: document for document in documents_result.scalars().all()
        }

    return [
        _serialize_audit_log(
            log,
            actors_by_id=actors_by_id,
            documents_by_id=documents_by_id,
        )
        for log in logs
    ]
