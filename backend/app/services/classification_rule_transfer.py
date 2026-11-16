"""Portable export/import format for classification rules.

Rules reference other rows by UUID, which differ from one database to another. The exchange format
replaces every reference with the row's readable code (org unit, category, domain, activity, workflow
template) or the user's matricule, and translates back on import against the importing tenant.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.classification_activity import ClassificationActivity
from app.models.classification_domain import ClassificationDomain
from app.models.document_category import DocumentCategory
from app.models.gedrules import WorkflowTemplate
from app.models.org_unit import OrgUnit
from app.models.user import User

FORMAT = "ged237-classification-rules"
VERSION = 1
MAX_RULES = 500

# Fields copied as-is between a rule and its exported form.
PLAIN_FIELDS = (
    "code",
    "name",
    "description",
    "priority",
    "is_active",
    "source_scope",
    "filename_pattern",
    "content_pattern",
    "year_min",
    "year_max",
    "mime_type_pattern",
    "target_scope",
    "year_strategy",
    "fixed_year",
)

# id field -> (exported field, referenced kind, is a list). Activities are resolved within their domain.
REFERENCE_FIELDS: dict[str, tuple[str, str, bool]] = {
    "document_category_id": ("document_category_code", "category", False),
    "document_category_ids": ("document_category_codes", "category", True),
    "source_org_unit_id": ("source_org_unit_code", "org_unit", False),
    "source_org_unit_ids": ("source_org_unit_codes", "org_unit", True),
    "source_org_unit_excluded_ids": (
        "source_org_unit_excluded_codes",
        "org_unit",
        True,
    ),
    "source_user_id": ("source_user_matricule", "user", False),
    "source_user_ids": ("source_user_matricules", "user", True),
    "target_org_unit_id": ("target_org_unit_code", "org_unit", False),
    "target_user_id": ("target_user_matricule", "user", False),
    "domain_id": ("domain_code", "domain", False),
    "workflow_template_id": ("workflow_template_code", "workflow_template", False),
}

_KIND_COLUMNS = {
    "category": (DocumentCategory, DocumentCategory.code),
    "org_unit": (OrgUnit, OrgUnit.code),
    "user": (User, User.matricule),
    "domain": (ClassificationDomain, ClassificationDomain.code),
    "workflow_template": (WorkflowTemplate, WorkflowTemplate.code),
}


@dataclass
class Directory:
    """Code <-> id lookups for one tenant, loaded once per export or import."""

    by_id: dict[str, dict[UUID, str]] = field(default_factory=dict)
    by_code: dict[str, dict[str, UUID]] = field(default_factory=dict)
    ambiguous: dict[str, set[str]] = field(default_factory=dict)
    # activity id -> (domain code, activity code), and the reverse
    activity_by_id: dict[UUID, tuple[str, str]] = field(default_factory=dict)
    activity_by_code: dict[tuple[str, str], UUID] = field(default_factory=dict)


async def load_directory(db: AsyncSession, tenant_id: UUID) -> Directory:
    directory = Directory()
    for kind, (model, code_column) in _KIND_COLUMNS.items():
        rows = (
            await db.execute(
                select(model.id, code_column).where(model.tenant_id == tenant_id)
            )
        ).all()
        directory.by_id[kind] = {row_id: code for row_id, code in rows}
        by_code: dict[str, UUID] = {}
        for row_id, code in rows:
            if code is None:
                continue
            if code in by_code:
                directory.ambiguous.setdefault(kind, set()).add(code)
            by_code[code] = row_id
        directory.by_code[kind] = by_code
    domains = directory.by_id["domain"]
    activities = (
        await db.execute(
            select(
                ClassificationActivity.id,
                ClassificationActivity.domain_id,
                ClassificationActivity.code,
            ).where(ClassificationActivity.tenant_id == tenant_id)
        )
    ).all()
    for activity_id, domain_id, code in activities:
        key = (domains.get(domain_id, ""), code)
        directory.activity_by_id[activity_id] = key
        directory.activity_by_code[key] = activity_id
    return directory


def export_rule(rule: Any, directory: Directory) -> dict[str, Any]:
    """A row without a code is exported by id so the reference is never silently dropped."""
    exported: dict[str, Any] = {name: getattr(rule, name) for name in PLAIN_FIELDS}
    for id_field, (code_field, kind, is_list) in REFERENCE_FIELDS.items():
        value = getattr(rule, id_field)
        lookup = directory.by_id[kind]
        if is_list:
            exported[code_field] = (
                [lookup.get(UUID(str(item))) or str(item) for item in value]
                if value
                else None
            )
        else:
            exported[code_field] = (lookup.get(value) or str(value)) if value else None
    activity = (
        directory.activity_by_id.get(rule.activity_id) if rule.activity_id else None
    )
    exported["activity_code"] = activity[1] if activity else None
    return exported


class UnknownReference(ValueError):
    pass


def _known_id(value: str, known: dict[UUID, str]) -> UUID | None:
    """An id exported in place of a missing code, accepted only if it exists in the importing tenant."""
    try:
        candidate = UUID(str(value))
    except ValueError:
        return None
    return candidate if candidate in known else None


def resolve_rule(exported: dict[str, Any], directory: Directory) -> dict[str, Any]:
    """Exported rule -> ClassificationRuleCreate fields. Raises UnknownReference naming field and code."""

    def resolve(code_field: str, kind: str, code: str) -> UUID:
        if code in directory.ambiguous.get(kind, set()):
            raise UnknownReference(
                f"{code_field} : « {code} » désigne plusieurs éléments"
            )
        found = directory.by_code[kind].get(code)
        if found is None:
            found = _known_id(code, directory.by_id[kind])
        if found is None:
            raise UnknownReference(f"{code_field} : « {code} » introuvable")
        return found

    values: dict[str, Any] = {
        name: exported[name] for name in PLAIN_FIELDS if name in exported
    }
    for id_field, (code_field, kind, is_list) in REFERENCE_FIELDS.items():
        value = exported.get(code_field)
        if value in (None, [], ""):
            values[id_field] = None
        elif is_list:
            values[id_field] = [resolve(code_field, kind, code) for code in value]
        else:
            values[id_field] = resolve(code_field, kind, value)
    activity_code = exported.get("activity_code")
    if activity_code:
        domain_code = exported.get("domain_code") or ""
        activity_id = directory.activity_by_code.get((domain_code, activity_code))
        if activity_id is None:
            raise UnknownReference(
                f"activity_code : « {activity_code} » introuvable dans le domaine « {domain_code} »"
            )
        values["activity_id"] = activity_id
    else:
        values["activity_id"] = None
    return values
