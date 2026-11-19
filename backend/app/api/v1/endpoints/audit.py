# backend/app/api/v1/endpoints/audit.py
import csv
import hashlib
import io
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Literal, Optional, TypeVar
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
from app.models.tenant import Tenant
from app.models.user import User
from app.services.audit_pdf import content_digest, render_audit_pdf

router = APIRouter()
_T = TypeVar("_T")


TABLE_LABELS = {
    "documents": "Documents",
    "workflows": "Workflows",
    "users": "Utilisateurs",
    "imports": "Imports",
    "ged_rules": "Règles GED",
    "local_organize_events": "Rangement local",
    "user_local_arrangement_snapshots": "Bibliothèque locale (compte)",
    "ingest_watch": "Dossiers surveillés",
    "audit_logs": "Journal d'audit",
}

ACTION_LABELS = {
    "account_locked": "Compte verrouillé",
    "create": "Création",
    "update": "Modification",
    "delete": "Suppression",
    "upload": "Dépôt de document",
    "login": "Connexion",
    "login_failed": "Connexion refusée",
    "import_committed": "Import exécuté",
    "content_viewed": "Consultation du document",
    "classification": "Tentative de classement",
    "needs_review": "Mise en attente pour arbitrage",
    "review_resolved": "Arbitrage de classement validé",
    "workflow_started": "Circuit déclenché",
    "workflow_step_completed": "Étape de workflow traitée",
    "workflow_approved": "Validation",
    "workflow_rejected": "Rejet",
    "workflow_returned": "Retour pour correction",
    "lock": "Verrouillage",
    "unlock": "Déverrouillage",
    "archive": "Archivage",
    "document_trashed": "Mise à la corbeille",
    "document_restored": "Restauration depuis la corbeille",
    "document_purged": "Suppression définitive",
    "version_uploaded": "Nouvelle version",
    "workflow_started_a_posteriori": "Circuit déclenché a posteriori",
    "local_organize": "Rangement local sur poste",
    "local_snap_put": "Bibliothèque locale (sync)",
    "watch_ingested": "Import automatique d'un dossier",
    "dup_detected": "Doublon refusé",
    "exported": "Export du journal",
}

# Cameroon time (UTC+1, no daylight saving). created_at is stored naive in UTC.
LOCAL_TZ = timezone(timedelta(hours=1), "WAT")
EXPORT_MAX_ROWS = 50_000
# About 70 landscape pages: a longer printed journal is slow to build and nobody reads it; use the CSV.
EXPORT_MAX_ROWS_PDF = 2_000
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
    return "Action tracée automatiquement par le système."


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
    table_name: str | list[str] | None,
    action: str | list[str] | None,
    user_id: UUID | list[UUID] | None = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    until: Optional[datetime] = None,
):
    """Tenant logs matching the screen filters; dates are local calendar days, both inclusive.

    ``table_name``, ``action`` and ``user_id`` take one value or several (any of them matches).
    ``until`` freezes the result at an instant (same clock and type as created_at).
    """
    query = select(AuditLog).where(AuditLog.tenant_id == tenant_id)
    table_names = _values(table_name)
    if table_names:
        query = query.where(AuditLog.table_name.in_(table_names))
    actions = [value.lower() for value in _values(action)]
    if actions:
        query = query.where(func.lower(AuditLog.action).in_(actions))
    user_ids = _values(user_id)
    if user_ids:
        query = query.where(AuditLog.user_id.in_(user_ids))
    if date_from:
        query = query.where(AuditLog.created_at >= _utc_naive(date_from))
    if date_to:
        query = query.where(
            AuditLog.created_at < _utc_naive(date_to + timedelta(days=1))
        )
    if until is not None:
        query = query.where(AuditLog.created_at <= until)
    return query


def _values(value: _T | list[_T] | None) -> list[_T]:
    """One query value or a repeated one, empty strings dropped."""
    items = value if isinstance(value, list) else [value]
    return [item for item in items if item]


def _logged_filter(value: str | list[str] | None) -> str | list[str] | None:
    """Filter as written in the export's own audit row: a single value stays a string."""
    items = _values(value)
    return items[0] if len(items) == 1 else (items or None)


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


# A cell starting with one of these is run as a formula by Excel (OWASP CSV injection).
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _csv_cell(value: Optional[str]) -> str:
    """User-typed text as inert text: a leading apostrophe stops formula evaluation."""
    text = value or ""
    return f"'{text}" if text.startswith(_FORMULA_PREFIXES) else text


def _csv_row(entry: dict[str, Any], created_at: Optional[datetime]) -> list[str]:
    return [_local_iso(created_at)] + [
        _csv_cell(entry[key])
        for key in (
            "user_matricule",
            "user_name",
            "table_label",
            "resource_label",
            "action_label",
            "detail",
            "ip_address",
        )
    ]


def _pdf_row(entry: dict[str, Any], created_at: Optional[datetime]) -> list[str]:
    """Same columns as the CSV, local date written the French way; no formula guard (not a sheet)."""
    when = ""
    if created_at is not None:
        aware = (
            created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
        )
        when = aware.astimezone(LOCAL_TZ).strftime("%d/%m/%Y %H:%M:%S")
    return [when] + [
        entry[key] or ""
        for key in (
            "user_matricule",
            "user_name",
            "table_label",
            "resource_label",
            "action_label",
            "detail",
            "ip_address",
        )
    ]


def _period_label(date_from: Optional[str], date_to: Optional[str]) -> str:
    def french(value: str) -> str:
        return date.fromisoformat(value).strftime("%d/%m/%Y")

    if date_from and date_to:
        return f"Du {french(date_from)} au {french(date_to)} inclus"
    if date_from:
        return f"Depuis le {french(date_from)}"
    if date_to:
        return f"Jusqu'au {french(date_to)} inclus"
    return "Tout le journal"


def _labels(
    value: str | list[str] | None, labels: dict[str, str], everything: str
) -> str:
    items = _values(value)
    return ", ".join(labels.get(item.lower(), item) for item in items) or everything


async def _pdf_meta(
    db: AsyncSession,
    current_user: User,
    *,
    filters: dict[str, Any],
    user_ids: list[UUID],
    total: int,
    now: datetime,
    data_sha256: str,
) -> list[tuple[str, str]]:
    """Label/value block printed above the table: who, when, which filters, fingerprint."""
    tenant_name = await db.scalar(
        select(Tenant.name).where(Tenant.id == current_user.tenant_id)
    )
    users = "Tous"
    if user_ids:
        found = (
            await db.execute(
                select(User).where(
                    User.tenant_id == current_user.tenant_id, User.id.in_(user_ids)
                )
            )
        ).scalars()
        users = ", ".join(sorted(f"{u.full_name} ({u.matricule})" for u in found)) or (
            "Aucun utilisateur connu"
        )
    return [
        ("Établissement", tenant_name or ""),
        ("Exporté par", f"{current_user.full_name} ({current_user.matricule})"),
        ("Exporté le", f"{now:%d/%m/%Y à %H:%M} (heure du Cameroun)"),
        ("Période", _period_label(filters.get("date_from"), filters.get("date_to"))),
        ("Objets", _labels(filters.get("table_name"), TABLE_LABELS, "Tous")),
        ("Actions", _labels(filters.get("action"), ACTION_LABELS, "Toutes")),
        ("Utilisateurs", users),
        ("Nombre de lignes", str(total)),
        ("Empreinte des données (SHA-256)", data_sha256),
        (
            "Empreinte du fichier",
            "SHA-256 de ce fichier PDF, consignée dans le journal d'audit "
            "(ligne « Export du journal » de cet export).",
        ),
    ]


@router.get("/logs/export")
async def export_audit_logs(
    # Repeat the parameter for several values (?action=upload&action=delete), like the screen.
    table_name: Optional[list[str]] = Query(default=None),
    action: Optional[list[str]] = Query(default=None),
    user_id: Optional[list[UUID]] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    export_format: Literal["csv", "pdf"] = Query(default="csv", alias="format"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The filtered journal, as CSV (default) or as an official PDF. The export is itself logged.

    CSV: Excel in French (UTF-8 BOM, ``;``). PDF: printable copy with the data fingerprint
    printed in it; the file's SHA-256 is in ``X-Report-SHA256`` and in the export's audit row.
    """
    await authorize_or_403(current_user, "audit_logs", "read")
    filters = {
        "table_name": _logged_filter(table_name),
        "action": _logged_filter(action),
        "user_id": _logged_filter([str(value) for value in user_id or []]),
        "date_from": date_from.isoformat() if date_from else None,
        "date_to": date_to.isoformat() if date_to else None,
    }
    # Rows logged after this instant (by anyone) would shift the offset pages: freeze them out.
    # localtimestamp is the clock created_at is filled from (now() stored without zone).
    snapshot = await db.scalar(select(func.localtimestamp()))
    query = _filtered_query(
        current_user.tenant_id,
        table_name=table_name,
        action=action,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        until=snapshot,
    )
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    if total > EXPORT_MAX_ROWS:
        raise HTTPException(
            status_code=422,
            detail=f"Plus de {EXPORT_MAX_ROWS} lignes : affinez la periode ou les filtres.",
        )
    as_pdf = export_format == "pdf"
    if as_pdf and total > EXPORT_MAX_ROWS_PDF:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Plus de {EXPORT_MAX_ROWS_PDF} lignes pour un PDF : affinez la p\u00e9riode "
                "ou les filtres, ou exportez en CSV."
            ),
        )

    # Rows are read in batches; the file is built before the response so the DB session
    # is not used after the dependency closes it.
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    writer.writerow(EXPORT_COLUMNS)
    pdf_rows: list[list[str]] = []
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
            if as_pdf:
                pdf_rows.append(_pdf_row(entry, log.created_at))
            else:
                writer.writerow(_csv_row(entry, log.created_at))

    logged_filters = {key: value for key, value in filters.items() if value}
    now = datetime.now(LOCAL_TZ)
    stamp = now.strftime("%Y%m%d-%H%M")
    new_data: dict[str, Any] = {"rows": total, "filters": logged_filters}
    if as_pdf:
        data_sha256 = content_digest(EXPORT_COLUMNS, pdf_rows, logged_filters)
        content = render_audit_pdf(
            title="Journal d'audit",
            meta=await _pdf_meta(
                db,
                current_user,
                filters=logged_filters,
                user_ids=_values(user_id),
                total=total,
                now=now,
                data_sha256=data_sha256,
            ),
            columns=EXPORT_COLUMNS,
            rows=pdf_rows,
            footer=f"Journal d'audit, export\u00e9 le {now:%d/%m/%Y \u00e0 %H:%M}",
        )
        file_sha256 = hashlib.sha256(content).hexdigest()
        new_data.update(
            format="pdf", content_sha256=data_sha256, file_sha256=file_sha256
        )
        media_type = "application/pdf"
        headers = {
            "Content-Disposition": f'attachment; filename="journal-audit-{stamp}.pdf"',
            "X-Report-SHA256": file_sha256,
        }
    else:
        content = ("\ufeff" + buffer.getvalue()).encode("utf-8")
        media_type = "text/csv; charset=utf-8"
        headers = {
            "Content-Disposition": f'attachment; filename="journal-audit-{stamp}.csv"'
        }

    db.add(
        AuditLog(
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            table_name="audit_logs",
            record_id=current_user.id,
            action="exported",
            new_data=new_data,
        )
    )
    await db.commit()

    return Response(content=content, media_type=media_type, headers=headers)


@router.get("/logs")
async def list_audit_logs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    table_name: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    # Same actor filter as the export: filtering server-side keeps it right across pages.
    user_id: Optional[list[UUID]] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "audit_logs", "read")

    query = _filtered_query(
        current_user.tenant_id, table_name=table_name, action=action, user_id=user_id
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
