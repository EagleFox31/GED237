"""
Seed the reference data the end-to-end suite relies on, from a JSON manifest.

The manifest (frontend/e2e/data/seed-manifest.json) declares, per tenant: document categories,
a classification plan, a workflow template with its routing rule, and documents in known states
(pending validation, in the trash, with several versions). This script converges the database to it:

- reference rows are matched by (tenant, code), created when missing, updated when they differ;
- documents are matched by ``extra_data.e2e_seed`` and only created when missing, because the
  suite then acts on them (a document already validated by a test is not reset).

A second run on a converged database writes nothing. Run it after ``seed_db.py`` (demo accounts):

    python scripts/seed_e2e.py --manifest /e2e-data/seed-manifest.json --profile e2e
"""

from __future__ import annotations

import argparse
import asyncio
import io
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from starlette.datastructures import Headers, UploadFile

from app.core.database import AsyncSessionLocal
from app.models.classification_activity import ClassificationActivity
from app.models.classification_domain import ClassificationDomain
from app.models.classification_rule import ClassificationRule
from app.models.document import Document
from app.models.document_category import DocumentCategory
from app.models.document_version import DocumentVersion
from app.models.gedrules import (
    AssignmentScope,
    RoutingRule,
    WorkflowTemplate,
    WorkflowTemplateStep,
)
from app.models.org_unit import OrgUnit, OrgUnitType
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User
from app.models.workflow import ActionType
from app.services.classification_review_service import ClassificationReviewService
from app.services.classification_rule_engine import ClassificationRuleEngine
from app.services.gedrules_listeners import _run_routing
from app.services.storage.factory import get_storage_service

SUPPORTED_SCHEMA = 1


class ManifestError(ValueError):
    """The manifest references something the database does not hold."""


class Seeder:
    def __init__(self, db, tenant: Tenant):
        self.db = db
        self.tenant = tenant
        self.stats: Counter[str] = Counter()

    # ── lookups ─────────────────────────────────────────────────────────────
    async def _one(self, stmt, what: str):
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if row is None:
            raise ManifestError(f"{what} not found in tenant {self.tenant.short_name}")
        return row

    async def org_unit(self, code: str) -> OrgUnit:
        return await self._one(
            select(OrgUnit).where(
                OrgUnit.tenant_id == self.tenant.id, OrgUnit.code == code
            ),
            f"org unit {code!r}",
        )

    async def user(self, matricule: str) -> User:
        return await self._one(
            select(User).where(
                User.tenant_id == self.tenant.id, User.matricule == matricule
            ),
            f"user {matricule!r}",
        )

    async def role(self, code: str) -> Role:
        return await self._one(select(Role).where(Role.code == code), f"role {code!r}")

    async def unit_type(self, code: str) -> OrgUnitType:
        return await self._one(
            select(OrgUnitType).where(OrgUnitType.code == code),
            f"org unit type {code!r}",
        )

    async def by_code(self, model, code: str, **scope):
        stmt = select(model).where(
            model.tenant_id == self.tenant.id, model.code == code
        )
        for column, value in scope.items():
            stmt = stmt.where(getattr(model, column) == value)
        return await self._one(stmt, f"{model.__tablename__} {code!r}")

    # ── reconciliation ──────────────────────────────────────────────────────
    async def upsert(
        self, model, keys: dict[str, Any], values: dict[str, Any], label: str
    ):
        """Create the row matched by ``keys`` or align its ``values``; count what happened."""
        stmt = select(model)
        for column, value in keys.items():
            stmt = stmt.where(getattr(model, column) == value)
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if row is None:
            row = model(**keys, **values)
            self.db.add(row)
            await self.db.flush()
            self._log("created", label)
            return row
        changed = [c for c, v in values.items() if getattr(row, c) != v]
        for column in changed:
            setattr(row, column, values[column])
        self._log("updated" if changed else "unchanged", label, changed)
        return row

    def _log(self, state: str, label: str, changed: list[str] | None = None) -> None:
        self.stats[state] += 1
        suffix = f" ({', '.join(changed)})" if changed else ""
        print(f"  [{state}] {label}{suffix}")

    async def categories(self, items: list[dict]) -> None:
        for item in items:
            await self.upsert(
                DocumentCategory,
                {"tenant_id": self.tenant.id, "code": item["code"]},
                {
                    "name": item["name"],
                    "description": item.get("description"),
                    "is_active": True,
                },
                f"category {item['code']}",
            )

    async def classification(self, plan: dict) -> None:
        for domain_item in plan.get("domains", []):
            domain = await self.upsert(
                ClassificationDomain,
                {"tenant_id": self.tenant.id, "code": domain_item["code"]},
                {"name": domain_item["name"], "is_active": True},
                f"domain {domain_item['code']}",
            )
            for activity in domain_item.get("activities", []):
                await self.upsert(
                    ClassificationActivity,
                    {
                        "tenant_id": self.tenant.id,
                        "domain_id": domain.id,
                        "code": activity["code"],
                    },
                    {"name": activity["name"], "is_active": True},
                    f"activity {activity['code']}",
                )
        for rule in plan.get("rules", []):
            domain = await self.by_code(ClassificationDomain, rule["domain"])
            activity = await self.by_code(
                ClassificationActivity, rule["activity"], domain_id=domain.id
            )
            target = (
                await self.org_unit(rule["targetOrgUnit"])
                if rule.get("targetOrgUnit")
                else None
            )
            await self.upsert(
                ClassificationRule,
                {"tenant_id": self.tenant.id, "code": rule["code"]},
                {
                    "name": rule["name"],
                    "priority": rule.get("priority", 100),
                    "is_active": True,
                    "source_scope": rule.get("sourceScope", "service"),
                    "filename_pattern": rule.get("filenamePattern"),
                    "target_scope": rule["targetScope"],
                    "target_org_unit_id": target.id if target else None,
                    "domain_id": domain.id,
                    "activity_id": activity.id,
                    "year_strategy": rule.get("yearStrategy", "current"),
                },
                f"classification rule {rule['code']}",
            )

    async def workflows(self, items: list[dict]) -> None:
        for item in items:
            template = await self.upsert(
                WorkflowTemplate,
                {"tenant_id": self.tenant.id, "code": item["code"]},
                {"name": item["name"], "is_active": True},
                f"workflow template {item['code']}",
            )
            for step in item["steps"]:
                role = await self.role(step["role"])
                unit_type = (
                    await self.unit_type(step["targetUnitType"])
                    if step.get("targetUnitType")
                    else None
                )
                await self.upsert(
                    WorkflowTemplateStep,
                    {"template_id": template.id, "step_order": step["order"]},
                    {
                        "label": step["label"],
                        "expected_action_type": ActionType(step["action"]),
                        "role_id": role.id,
                        "assignment_scope": AssignmentScope(
                            step.get("scope", "same_org_unit")
                        ),
                        "target_unit_type_id": unit_type.id if unit_type else None,
                    },
                    f"workflow step {item['code']}#{step['order']}",
                )
            await self.routing(item["routing"], template)

    async def routing(self, item: dict, template: WorkflowTemplate) -> None:
        rule = await self.upsert(
            RoutingRule,
            {"tenant_id": self.tenant.id, "code": item["code"]},
            {
                "name": item["name"],
                "priority": item.get("priority", 100),
                "is_active": True,
                "workflow_template_id": template.id,
            },
            f"routing rule {item['code']}",
        )
        rule = (
            await self.db.execute(
                select(RoutingRule)
                .options(
                    selectinload(RoutingRule.document_categories),
                    selectinload(RoutingRule.org_units),
                )
                .where(RoutingRule.id == rule.id)
                .execution_options(populate_existing=True)
            )
        ).scalar_one()
        categories = [
            await self.by_code(DocumentCategory, c) for c in item.get("categories", [])
        ]
        units = [await self.org_unit(u) for u in item.get("orgUnits", [])]
        if {c.id for c in rule.document_categories} != {c.id for c in categories}:
            rule.document_categories = categories
            self._log("updated", f"routing rule {item['code']} categories")
        if {u.id for u in rule.org_units} != {u.id for u in units}:
            rule.org_units = units
            self._log("updated", f"routing rule {item['code']} org units")

    # ── documents ───────────────────────────────────────────────────────────
    async def documents(self, items: list[dict]) -> None:
        storage = get_storage_service()
        for item in items:
            code = item["code"]
            existing = (
                await self.db.execute(
                    select(Document.id).where(
                        Document.tenant_id == self.tenant.id,
                        Document.extra_data["e2e_seed"].astext == code,
                    )
                )
            ).scalar_one_or_none()
            if existing is not None:
                self._log("unchanged", f"document {code}")
                continue
            await self._create_document(storage, item)
            self._log("created", f"document {code}")

    async def _create_document(self, storage, item: dict) -> None:
        owner = await self.user(item["owner"])
        category = await self.by_code(DocumentCategory, item["category"])
        directory = f"{self.tenant.id}/{owner.org_unit_id}"
        filename = f"{item['code'].lower()}.pdf"

        document = None
        for index in range(item.get("versions", 1)):
            version_number = f"1.{index}"
            upload = _pdf_upload(
                filename, f"{item['title']} - version {version_number}"
            )
            size = upload.size
            path, checksum = await storage.save_file_with_checksum(
                upload, directory=directory
            )
            if document is None:
                # Same fields as POST /documents/upload in "process" mode.
                document = Document(
                    title=item["title"],
                    file_path=path,
                    file_type="pdf",
                    file_size=size,
                    mime_type="application/pdf",
                    document_category_id=category.id,
                    tags=["e2e"],
                    owner_id=owner.id,
                    tenant_id=self.tenant.id,
                    org_unit_id=owner.org_unit_id,
                    status="draft",
                    processing_mode="process",
                    extra_data={"e2e_seed": item["code"]},
                )
                self.db.add(document)
                await self.db.flush()
            version = DocumentVersion(
                document_id=document.id,
                version_number=version_number,
                file_path=path,
                file_size=size,
                mime_type="application/pdf",
                checksum_sha256=checksum,
                uploaded_by_id=owner.id,
                uploaded_at=datetime.now(timezone.utc),
                change_note=None if index == 0 else "Version E2E",
            )
            self.db.add(version)
            await self.db.flush()
            document.current_version_id = version.id
            document.file_path = path
            document.file_size = size

        await ClassificationRuleEngine(self.db).classify_document(
            document=document,
            source_scope="service",
            source_user_id=owner.id,
            filename=filename,
            mime_type="application/pdf",
        )
        if document.classification_status in {"pending", "needs_review"}:
            await ClassificationReviewService(self.db).ensure_open_review_for_document(
                document=document
            )
        if item.get("trashed"):
            document.deleted_at = datetime.now(timezone.utc)
            document.deleted_by = owner.id
        await self.db.commit()
        if not item.get("trashed"):
            # The upload endpoint routes through the DOCUMENT_CREATED listener: same use case.
            await _run_routing(self.db, document.id)


def _pdf_upload(filename: str, text: str) -> UploadFile:
    """A one-page PDF whose text (hence checksum) is unique to the document and version."""
    safe = (
        text.encode("latin-1", "replace")
        .replace(b"\\", b"\\\\")
        .replace(b"(", b"\\(")
        .replace(b")", b"\\)")
    )
    stream = b"BT /F1 14 Tf 72 720 Td (" + safe + b") Tj ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    body = b"%PDF-1.4\n"
    offsets = []
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(body))
        body += b"%d 0 obj\n" % number + obj + b"\nendobj\n"
    xref = len(body)
    body += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    body += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    body += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objects) + 1,
        xref,
    )
    return UploadFile(
        file=io.BytesIO(body),
        size=len(body),
        filename=filename,
        headers=Headers({"content-type": "application/pdf"}),
    )


def load_manifest(path: str, profile: str) -> dict:
    with open(path, encoding="utf-8") as handle:
        manifest = json.load(handle)
    if manifest.get("schemaVersion") != SUPPORTED_SCHEMA:
        raise ManifestError(
            f"{path}: schemaVersion {manifest.get('schemaVersion')!r}, this script reads {SUPPORTED_SCHEMA}"
        )
    if manifest.get("profile") != profile:
        raise ManifestError(
            f"{path}: profile {manifest.get('profile')!r}, expected {profile!r}"
        )
    return manifest


async def seed(manifest: dict) -> Counter[str]:
    async with AsyncSessionLocal() as db:
        tenant = (
            await db.execute(
                select(Tenant).where(Tenant.short_name == manifest["tenant"])
            )
        ).scalar_one_or_none()
        if tenant is None:
            raise ManifestError(
                f"tenant {manifest['tenant']!r} not found: run scripts/seed_db.py first"
            )
        seeder = Seeder(db, tenant)
        await seeder.categories(manifest.get("categories", []))
        await seeder.classification(manifest.get("classification", {}))
        await seeder.workflows(manifest.get("workflows", []))
        await db.commit()
        await seeder.documents(manifest.get("documents", []))
        return seeder.stats


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--manifest",
        default=os.getenv("E2E_MANIFEST"),
        required=not os.getenv("E2E_MANIFEST"),
    )
    parser.add_argument("--profile", default="e2e")
    args = parser.parse_args()
    print(f"=== E2E seed: {args.manifest} (profile {args.profile}) ===")
    try:
        stats = asyncio.run(seed(load_manifest(args.manifest, args.profile)))
    except ManifestError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1
    print(
        "=== E2E seed done: "
        + ", ".join(f"{stats[k]} {k}" for k in ("created", "updated", "unchanged"))
        + " ==="
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
