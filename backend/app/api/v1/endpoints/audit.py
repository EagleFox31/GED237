# backend/app/api/v1/endpoints/audit.py
import csv
import io
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
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
    "local_organize_events": "Rangement local",
    "user_local_arrangement_snapshots": "Bibliotheque locale (compte)",
    "audit_logs": "Journal d'audit",
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
    "local_organize": "Rangement local sur poste",
    "local_snap_put": "Bibliotheque locale (sync)",
    "dup_detected": "Doublon refuse",
    "exported": "Export du journal",
}

# Cameroon time (UTC+1, no daylight saving). created_at is stored naive in UTC.
LOCAL_TZ = timezone(timedelta(hours=1), "WAT")
EXPORT_MAX_ROWS = 50_000
_EXPORT_BATCH = 2_000
EXPORT_COLUMNS = (
    "Date",
    "Matricule",
    "Utilisateur",
    "Objet",
    "Ressource",
    "Action",
    "Détail",
    "Adresse IP",
)


def _extract_resource_label(
    log: AuditLog, documents_by_id: dict[UUID, Document]
) -> str:
    if log.table_name == "documents":
        document = documents_by_id.get(log.record_id)
        if document is not None:
            return document.title

    for payload in (log.new_data, log.old_data):
        if not isinstance(payload, dict):
            continue
        for key in (
            "document_title",
            "title",
            "name",
            "rule_name",
            "label",
            "filename",
        ):
            value = payload.get(key)
            if value:
                return str(value)

    table_label = TABLE_LABELS.get(
        log.table_name, log.table_name.replace("_", " ").title()
    )
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


def _filtered_query(
    tenant_id: UUID,
    *,
    table_name: Optional[str],
    action: Optional[str],
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    """Tenant logs matching the screen filters; dates are local calendar days, both inclusive."""
    query = select(AuditLog).where(AuditLog.tenant_id == tenant_id)
    if table_name:
        query = query.where(AuditLog.table_name == table_name)
    if action:
        query = query.where(func.lower(AuditLog.action) == action.lower())
    if date_from:
        query = query.where(AuditLog.created_at >= _utc_naive(date_from))
    if date_to:
        query = query.where(
            AuditLog.created_at < _utc_naive(date_to + timedelta(days=1))
        )
    return query


def _utc_naive(day: date) -> datetime:
    """Local midnight of ``day`` as the naive UTC value stored in created_at."""
    local_midnight = datetime.combine(day, time.min, tzinfo=LOCAL_TZ)
    return local_midnight.astimezone(timezone.utc).replace(tzinfo=None)


async def _load_references(
    db: AsyncSession, logs: list[AuditLog]
) -> tuple[dict[UUID, User], dict[UUID, Document]]:
    """Actors and documents named by ``logs``, loaded in two queries."""
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
    return actors_by_id, documents_by_id


def _local_iso(value: Optional[datetime]) -> str:
    if value is None:
        return ""
    aware = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return aware.astimezone(LOCAL_TZ).isoformat(timespec="seconds")


def _csv_row(entry: dict[str, Any], created_at: Optional[datetime]) -> list[str]:
    return [
        _local_iso(created_at),
        entry["user_matricule"] or "",
        entry["user_name"] or "",
        entry["table_label"],
        entry["resource_label"],
        entry["action_label"],
        entry["detail"],
        entry["ip_address"] or "",
    ]


@router.get("/logs/export")
async def export_audit_logs(
    table_name: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """CSV of the filtered journal (Excel in French: UTF-8 BOM, ``;``). The export is itself logged."""
    await authorize_or_403(current_user, "audit_logs", "read")
    filters = {
        "table_name": table_name,
        "action": action,
        "date_from": date_from.isoformat() if date_from else None,
        "date_to": date_to.isoformat() if date_to else None,
    }
    query = _filtered_query(
        current_user.tenant_id,
        table_name=table_name,
        action=action,
        date_from=date_from,
        date_to=date_to,
    )
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    if total > EXPORT_MAX_ROWS:
        raise HTTPException(
            status_code=422,
            detail=f"Plus de {EXPORT_MAX_ROWS} lignes : affinez la periode ou les filtres.",
        )

    # Rows are read in batches; the CSV is built before the response so the DB session
    # is not used after the dependency closes it.
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    writer.writerow(EXPORT_COLUMNS)
    ordered = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    for offset in range(0, total, _EXPORT_BATCH):
        logs = list(
            (await db.execute(ordered.offset(offset).limit(_EXPORT_BATCH)))
            .scalars()
            .all()
        )
        actors_by_id, documents_by_id = await _load_references(db, logs)
        for log in logs:
            entry = _serialize_audit_log(
                log, actors_by_id=actors_by_id, documents_by_id=documents_by_id
            )
            writer.writerow(_csv_row(entry, log.created_at))

    db.add(
        AuditLog(
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            table_name="audit_logs",
            record_id=current_user.id,
            action="exported",
            new_data={
                "rows": total,
                "filters": {key: value for key, value in filters.items() if value},
            },
        )
    )
    await db.commit()

    content = "\ufeff" + buffer.getvalue()
    stamp = datetime.now(LOCAL_TZ).strftime("%Y%m%d-%H%M")
    return Response(
        content=content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="journal-audit-{stamp}.csv"'
        },
    )


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

    query = _filtered_query(
        current_user.tenant_id, table_name=table_name, action=action
    )
    query = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    logs = list(result.scalars().all())
    actors_by_id, documents_by_id = await _load_references(db, logs)

    return [
        _serialize_audit_log(
            log,
            actors_by_id=actors_by_id,
            documents_by_id=documents_by_id,
        )
        for log in logs
    ]
