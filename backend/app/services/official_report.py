"""Official reports: numbered, fingerprinted and logged copies of the report screens.

The data comes from ``ReportsService`` (the same figures as the screens), within the
scope given by ``resolve_report_scope``. Each copy gets an order number per
institution and year, ``N° 0001/2026/<short name>``, taken under a row lock, and a
line in the ``report_issues`` register with the SHA-256 of the delivered file.

Rendering depends only on the stored header and the data, so an identical report
can be produced again byte for byte (``OFFICIAL_REPORT_NEW_NUMBER_EACH_TIME=false``).
"""

from __future__ import annotations

import csv
import hashlib
import html
import io
import json
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.audit import AuditLog
from app.models.org_unit import OrgUnit
from app.models.report_issue import ReportCounter, ReportIssue
from app.models.tenant import Tenant
from app.schemas.official_report import OfficialReportRequest
from app.services.reports_scope import ReportScope
from app.services.reports_service import ReportsService

LOCAL_TZ = timezone(timedelta(hours=1), "WAT")

KIND_TITLES = {
    "evolution": "Évolution de l'activité",
    "document-activity": "Activité documentaire",
    "workflow-activity": "Activité des circuits de validation",
    "service-activity": "Activité des services",
}

# Field names of the report schemas, as printed on the official copy.
LABELS = {
    "total_active_documents": "Documents actifs",
    "validated_documents": "Documents validés",
    "archived_documents": "Documents archivés",
    "reviewed_documents": "Documents revus",
    "by_status": "Par statut",
    "by_file_type": "Par type de fichier",
    "by_org_unit": "Par unité",
    "signals": "Points d'attention",
    "unclassified_documents": "Documents non classés",
    "documents_missing_information": "Documents incomplets",
    "documents_needing_review": "Documents à revoir",
    "imports_needing_review": "Imports à revoir",
    "local_organize_runs": "Rangements sur poste",
    "local_organize_files": "Fichiers rangés sur poste",
    "local_organize_files_unranged": "Fichiers non rangés sur poste",
    "active_steps": "Étapes en cours",
    "completed_steps": "Étapes terminées",
    "rejected_steps": "Étapes rejetées",
    "open_workflows": "Circuits ouverts",
    "completed_workflows": "Circuits terminés",
    "blocked_workflows_estimated": "Circuits bloqués (estimation)",
    "by_step": "Par étape",
    "pending_actions": "Actions en attente",
    "slowest_steps": "Étapes les plus lentes",
    "delay_by_org_unit": "Délai par unité",
    "services": "Services",
    "total_services": "Nombre de services",
    "overloaded_services": "Services surchargés",
    "services_with_reviews": "Services avec documents à revoir",
    "totals": "Totaux",
    "series": "Évolution",
    "breakdowns": "Répartitions",
    "org_units": "Unités",
    "domains": "Domaines",
    "activities": "Activités",
    "imports": "Imports",
    "documents_created": "Documents créés",
    "documents_auto_classified": "Documents classés automatiquement",
    "imports_completed": "Imports terminés",
    "workflow_steps_completed": "Étapes validées",
    "workflow_steps_rejected": "Étapes rejetées",
    "key": "Code",
    "label": "Libellé",
    "value": "Valeur",
    "bucket_start": "Début",
    "bucket_label": "Période",
    "average_days": "Délai moyen (jours)",
    "steps_count": "Étapes",
    "documents_total": "Documents",
    "documents_in_progress": "Documents en cours",
    "estimated_delays": "Retards estimés",
    "average_workflow_days": "Durée moyenne des circuits (jours)",
    "active_users": "Utilisateurs actifs",
    "inactive_users": "Utilisateurs inactifs",
}
# Screen-only metadata, not report content.
SKIPPED_KEYS = frozenset({"availability", "filters", "id"})

HEADER_ROWS = (
    ("title", "Rapport officiel"),
    ("number", "Numéro"),
    ("institution", "Institution"),
    ("unit", "Unité"),
    ("period", "Période"),
    ("issued_by", "Établi par"),
    ("issued_at", "Date d'émission"),
)

# A cell starting with one of these is run as a formula by Excel (OWASP CSV
# injection); same rule as the audit journal export.
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


class OfficialReportError(Exception):
    """The report cannot be issued; the message is meant for the user."""


@dataclass(frozen=True)
class Section:
    title: str
    headers: tuple[str, ...]
    rows: tuple[tuple[str, ...], ...]


@dataclass(frozen=True)
class IssuedReport:
    issue: ReportIssue
    content: bytes
    media_type: str
    filename: str
    reused: bool


def _label(key: str) -> str:
    return LABELS.get(key, key.replace("_", " ").capitalize())


def _format(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Oui" if value else "Non"
    if isinstance(value, float):
        return f"{value:.2f}".replace(".", ",")
    return str(value)


def build_sections(data: dict[str, Any]) -> list[Section]:
    """Turn a report response (``model_dump(mode="json")``) into printable tables.

    Scalars of one level make an « Indicateur / Valeur » table; each list of items
    makes its own table; nested objects are walked with their path as title.
    """
    sections: list[Section] = []
    _walk(data, (), sections)
    return sections


def _walk(data: dict[str, Any], path: tuple[str, ...], sections: list[Section]):
    title = " – ".join(_label(part) for part in path) or "Synthèse"
    scalars = [
        (key, value)
        for key, value in data.items()
        if key not in SKIPPED_KEYS and not isinstance(value, (dict, list))
    ]
    if scalars:
        sections.append(
            Section(
                title,
                ("Indicateur", "Valeur"),
                tuple((_label(key), _format(value)) for key, value in scalars),
            )
        )
    for key, value in data.items():
        if key in SKIPPED_KEYS:
            continue
        if isinstance(value, dict):
            _walk(value, path + (key,), sections)
        elif isinstance(value, list):
            items = [item for item in value if isinstance(item, dict)]
            columns = (
                [column for column in items[0] if column not in SKIPPED_KEYS]
                if items
                else ["label", "value"]
            )
            sections.append(
                Section(
                    " – ".join(_label(part) for part in path + (key,)),
                    tuple(_label(column) for column in columns),
                    tuple(
                        tuple(_format(item.get(column)) for column in columns)
                        for item in items
                    ),
                )
            )


def _csv_cell(value: str) -> str:
    return f"'{value}" if value.startswith(_FORMULA_PREFIXES) else value


def render_csv(header: dict[str, str], sections: list[Section]) -> bytes:
    """Excel in French: UTF-8 BOM, ``;``, CRLF, like the audit journal export."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    for key, label in HEADER_ROWS:
        writer.writerow([label, _csv_cell(header.get(key, ""))])
    for section in sections:
        writer.writerow([])
        writer.writerow([_csv_cell(section.title)])
        writer.writerow([_csv_cell(cell) for cell in section.headers])
        if not section.rows:
            writer.writerow(["Aucune donnée"])
        for row in section.rows:
            writer.writerow([_csv_cell(cell) for cell in row])
    return ("﻿" + buffer.getvalue()).encode("utf-8")


_HTML_STYLE = (
    "body{font-family:Arial,Helvetica,sans-serif;margin:2rem;color:#111}"
    "h1{font-size:1.3rem}h2{font-size:1.05rem;margin-top:1.5rem}"
    "table{border-collapse:collapse;width:100%;margin-top:.4rem}"
    "th,td{border:1px solid #999;padding:.25rem .5rem;text-align:left}"
    "th{background:#eee}dl{display:grid;grid-template-columns:max-content 1fr;"
    "gap:.2rem 1rem}dt{font-weight:bold}@media print{body{margin:0}}"
)


def render_html(header: dict[str, str], sections: list[Section]) -> bytes:
    """Self-contained printable page: no external resource (offline rooms)."""
    esc = html.escape
    parts = [
        "<!doctype html>",
        '<html lang="fr"><head><meta charset="utf-8">',
        f"<title>{esc(header.get('number', ''))}</title>",
        f"<style>{_HTML_STYLE}</style></head><body>",
        f"<h1>{esc(header.get('title', ''))}</h1><dl>",
    ]
    for key, label in HEADER_ROWS[1:]:
        parts.append(f"<dt>{esc(label)}</dt><dd>{esc(header.get(key, ''))}</dd>")
    parts.append("</dl>")
    for section in sections:
        parts.append(f"<h2>{esc(section.title)}</h2><table><thead><tr>")
        parts.extend(f"<th>{esc(cell)}</th>" for cell in section.headers)
        parts.append("</tr></thead><tbody>")
        if not section.rows:
            parts.append(
                f'<tr><td colspan="{len(section.headers)}">Aucune donnée</td></tr>'
            )
        for row in section.rows:
            parts.append("<tr>")
            parts.extend(f"<td>{esc(cell)}</td>" for cell in row)
            parts.append("</tr>")
        parts.append("</tbody></table>")
    parts.append("</body></html>")
    return "\n".join(parts).encode("utf-8")


def render(header: dict[str, str], data: dict[str, Any], fmt: str) -> bytes:
    sections = build_sections(data)
    return (
        render_html(header, sections) if fmt == "html" else render_csv(header, sections)
    )


def content_digest(kind: str, filters: dict[str, Any], data: dict[str, Any]) -> str:
    canonical = json.dumps(
        {"kind": kind, "filters": filters, "data": data},
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def format_number(sequence: int, year: int, short_name: Optional[str]) -> str:
    suffix = f"/{short_name}" if short_name else ""
    return f"N° {sequence:04d}/{year}{suffix}"


def _filename(kind: str, sequence: int, year: int, short_name: Optional[str], fmt: str):
    safe = re.sub(r"[^A-Za-z0-9_-]", "", short_name or "")
    suffix = f"-{safe}" if safe else ""
    return f"rapport-{kind}-{sequence:04d}-{year}{suffix}.{fmt}"


_MEDIA_TYPES = {"csv": "text/csv; charset=utf-8", "html": "text/html; charset=utf-8"}


async def _fetch_data(
    db: AsyncSession, request: OfficialReportRequest, scope: ReportScope
) -> dict[str, Any]:
    service = ReportsService(db)
    common = dict(
        tenant_id=scope.tenant_id,
        org_unit_id=scope.org_unit_id,
        recursive=scope.recursive,
        domain_id=request.domain_id,
        activity_id=request.activity_id,
        document_category_id=request.document_category_id,
    )
    if request.kind == "evolution":
        response = await service.get_evolution(
            date_from=request.date_from,
            date_to=request.date_to,
            granularity=request.granularity,
            **common,
        )
    elif request.kind == "document-activity":
        response = await service.get_document_activity(**common)
    elif request.kind == "workflow-activity":
        response = await service.get_workflow_activity(**common)
    else:
        response = await service.get_service_activity(**common)
    return response.model_dump(mode="json")


def _applied_filters(
    request: OfficialReportRequest, scope: ReportScope, data: dict[str, Any]
) -> dict[str, Any]:
    filters: dict[str, Any] = {
        "org_unit_id": str(scope.org_unit_id) if scope.org_unit_id else None,
        "recursive": scope.recursive,
        "domain_id": str(request.domain_id) if request.domain_id else None,
        "activity_id": str(request.activity_id) if request.activity_id else None,
        "document_category_id": (
            str(request.document_category_id) if request.document_category_id else None
        ),
    }
    if request.kind == "evolution":
        applied = data.get("filters") or {}
        filters.update(
            date_from=applied.get("date_from"),
            date_to=applied.get("date_to"),
            granularity=applied.get("granularity"),
        )
    return {key: value for key, value in filters.items() if value is not None}


async def _unit_label(db: AsyncSession, scope: ReportScope) -> str:
    if scope.org_unit_id is None:
        return "Toutes les unités"
    name = await db.scalar(
        select(OrgUnit.name).where(
            OrgUnit.id == scope.org_unit_id, OrgUnit.tenant_id == scope.tenant_id
        )
    )
    label = name or str(scope.org_unit_id)
    return f"{label} (et sous-unités)" if scope.recursive else label


def _period_label(filters: dict[str, Any], now: datetime) -> str:
    if "date_from" in filters and "date_to" in filters:
        start = date.fromisoformat(filters["date_from"])
        end = date.fromisoformat(filters["date_to"])
        return f"Du {start:%d/%m/%Y} au {end:%d/%m/%Y}"
    return f"Situation au {now:%d/%m/%Y}"


def _author(user) -> str:
    name = getattr(user, "full_name", None)
    return name if isinstance(name, str) and name.strip() else (user.email or "")


async def _next_sequence(db: AsyncSession, tenant_id: UUID, year: int) -> int:
    """Atomic increment: the upsert locks the counter row until the commit."""
    statement = (
        pg_insert(ReportCounter)
        .values(tenant_id=tenant_id, year=year, last_value=1)
        .on_conflict_do_update(
            index_elements=[ReportCounter.tenant_id, ReportCounter.year],
            set_={"last_value": ReportCounter.last_value + 1},
        )
        .returning(ReportCounter.last_value)
    )
    return (await db.execute(statement)).scalar_one()


async def issue_official_report(
    db: AsyncSession, user, request: OfficialReportRequest, scope: ReportScope
) -> IssuedReport:
    """Build, number, register and log one official report; commits."""
    tenant = await db.get(Tenant, scope.tenant_id)
    if tenant is None:
        raise LookupError("Institution introuvable.")
    short_name = (tenant.short_name or "").strip() or None
    if short_name is None and settings.OFFICIAL_REPORT_REQUIRE_SHORT_NAME:
        raise OfficialReportError(
            "L'institution n'a pas de sigle : un administrateur doit le renseigner "
            "avant l'émission d'un rapport officiel."
        )

    data = await _fetch_data(db, request, scope)
    filters = _applied_filters(request, scope, data)
    digest = content_digest(request.kind, filters, data)
    now = datetime.now(LOCAL_TZ)

    reused: Optional[ReportIssue] = None
    if not settings.OFFICIAL_REPORT_NEW_NUMBER_EACH_TIME:
        reused = await db.scalar(
            select(ReportIssue)
            .where(
                ReportIssue.tenant_id == scope.tenant_id,
                ReportIssue.year == now.year,
                ReportIssue.kind == request.kind,
                ReportIssue.format == request.format,
                ReportIssue.content_sha256 == digest,
            )
            .order_by(ReportIssue.issued_at, ReportIssue.sequence)
            .limit(1)
        )

    if reused is not None:
        issue = reused
        content = render(issue.header, data, issue.format)
    else:
        sequence = await _next_sequence(db, scope.tenant_id, now.year)
        header = {
            "title": f"Rapport officiel – {KIND_TITLES[request.kind]}",
            "number": format_number(sequence, now.year, short_name),
            "institution": tenant.name,
            "unit": await _unit_label(db, scope),
            "period": _period_label(filters, now),
            "issued_by": _author(user),
            "issued_at": f"{now:%d/%m/%Y %H:%M} (heure de Yaoundé)",
        }
        content = render(header, data, request.format)
        issue = ReportIssue(
            tenant_id=scope.tenant_id,
            year=now.year,
            sequence=sequence,
            number=header["number"],
            kind=request.kind,
            format=request.format,
            filters=filters,
            header=header,
            content_sha256=digest,
            file_sha256=hashlib.sha256(content).hexdigest(),
            issued_by=user.id,
        )
        db.add(issue)
        await db.flush()

    db.add(
        AuditLog(
            tenant_id=scope.tenant_id,
            user_id=user.id,
            table_name="report_issues",
            record_id=issue.id,
            action="report_generated",
            new_data={
                "number": issue.number,
                "kind": issue.kind,
                "format": issue.format,
                "file_sha256": hashlib.sha256(content).hexdigest(),
                "reissued": reused is not None,
            },
        )
    )
    await db.commit()
    await db.refresh(issue)
    return IssuedReport(
        issue=issue,
        content=content,
        media_type=_MEDIA_TYPES[issue.format],
        filename=_filename(
            issue.kind, issue.sequence, issue.year, short_name, issue.format
        ),
        reused=reused is not None,
    )


async def list_issues(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    issued_by: Optional[UUID] = None,
    year: Optional[int] = None,
    kind: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[int, list[ReportIssue]]:
    query = select(ReportIssue).where(ReportIssue.tenant_id == tenant_id)
    if issued_by is not None:
        query = query.where(ReportIssue.issued_by == issued_by)
    if year is not None:
        query = query.where(ReportIssue.year == year)
    if kind is not None:
        query = query.where(ReportIssue.kind == kind)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    rows = await db.scalars(
        query.order_by(ReportIssue.year.desc(), ReportIssue.sequence.desc())
        .offset(skip)
        .limit(limit)
    )
    return total or 0, list(rows.all())
