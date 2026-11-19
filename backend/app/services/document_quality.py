"""Documentary quality: how many documents lack what makes them findable.

Indicators are counted in one pass over the documents in scope (same scope and
filters as ``/reports/*``). « Métadonnées manquantes » follows the PO decision of
17/11: no category, or no domain, or no year.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.org_unit import OrgUnitClosure
from app.services.reports_scope import ReportScope


@dataclass(frozen=True)
class Indicator:
    key: str
    label: str
    condition: ColumnElement[bool]


_MISSING_METADATA = or_(
    Document.document_category_id.is_(None),
    Document.classification_domain_id.is_(None),
    Document.classification_year.is_(None),
)
_NEEDS_REVIEW = Document.classification_status == "needs_review"
_NO_TEXT = or_(Document.ocr_content.is_(None), func.btrim(Document.ocr_content) == "")

INDICATORS: tuple[Indicator, ...] = (
    Indicator("missing_metadata", "Métadonnées manquantes", _MISSING_METADATA),
    Indicator(
        "missing_category", "Sans catégorie", Document.document_category_id.is_(None)
    ),
    Indicator(
        "missing_domain", "Sans domaine", Document.classification_domain_id.is_(None)
    ),
    Indicator("missing_year", "Sans année", Document.classification_year.is_(None)),
    Indicator("needs_review", "Classement à revoir", _NEEDS_REVIEW),
    Indicator("no_text", "Sans texte reconnu (recherche impossible)", _NO_TEXT),
)
INDICATOR_KEYS = tuple(indicator.key for indicator in INDICATORS)
_BY_KEY = {indicator.key: indicator for indicator in INDICATORS}
# A document « à corriger » has at least one of these (the detailed missing_*
# indicators are already covered by missing_metadata).
_ANY_ISSUE = or_(_MISSING_METADATA, _NEEDS_REVIEW, _NO_TEXT)


def scope_filters(
    scope: ReportScope,
    *,
    domain_id: Optional[UUID] = None,
    activity_id: Optional[UUID] = None,
    document_category_id: Optional[UUID] = None,
) -> list:
    """Active documents of the tenant within the report scope."""
    filters: list = [
        Document.tenant_id == scope.tenant_id,
        Document.deleted_at.is_(None),
    ]
    if scope.org_unit_id is not None:
        if scope.recursive:
            descendants = select(OrgUnitClosure.descendant_id).where(
                OrgUnitClosure.ancestor_id == scope.org_unit_id
            )
            filters.append(
                or_(
                    Document.org_unit_id == scope.org_unit_id,
                    Document.org_unit_id.in_(descendants),
                )
            )
        else:
            filters.append(Document.org_unit_id == scope.org_unit_id)
    if domain_id is not None:
        filters.append(Document.classification_domain_id == domain_id)
    if activity_id is not None:
        filters.append(Document.classification_activity_id == activity_id)
    if document_category_id is not None:
        filters.append(Document.document_category_id == document_category_id)
    return filters


def _rate(part: int, total: int) -> Optional[float]:
    return round(100.0 * part / total, 1) if total else None


async def quality_summary(db: AsyncSession, filters: list) -> dict:
    columns = [func.count(Document.id), func.count(Document.id).filter(_ANY_ISSUE)]
    columns += [
        func.count(Document.id).filter(indicator.condition) for indicator in INDICATORS
    ]
    row = (await db.execute(select(*columns).where(*filters))).one()
    total, with_issue, counts = int(row[0]), int(row[1]), row[2:]
    return {
        "total_documents": total,
        "documents_to_fix": with_issue,
        "quality_rate": _rate(total - with_issue, total),
        "indicators": [
            {
                "key": indicator.key,
                "label": indicator.label,
                "count": int(count),
                "rate": _rate(int(count), total),
            }
            for indicator, count in zip(INDICATORS, counts)
        ],
    }


async def documents_for_indicator(
    db: AsyncSession, filters: list, indicator: str, *, skip: int, limit: int
) -> tuple[int, list[Document]]:
    """Documents matching one indicator, newest first (stable order)."""
    where = [*filters, _BY_KEY[indicator].condition]
    total = await db.scalar(select(func.count(Document.id)).where(*where))
    rows = await db.scalars(
        select(Document)
        .where(*where)
        .order_by(Document.created_at.desc(), Document.id.desc())
        .offset(skip)
        .limit(limit)
    )
    return int(total or 0), list(rows.all())
