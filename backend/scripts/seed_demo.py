"""Bring the database to the demo baseline through the public API (profile demo of e2e_reset.sh).

    python scripts/seed_demo.py --manifest /e2e-data/demo-manifest.json --corpus /data/ingest

Runs after `alembic upgrade head`, seed_db.py (accounts, org units) and seed_e2e.py --profile demo
(categories, domains, activities). Steps, all through the application itself (no import endpoint
of its own):

1. purge: documents, versions, import jobs and classification rules of the demo tenants
   (MINFI, MINESUP), storage files included, so a second run rebuilds the same state;
2. rules: manifest `rules` posted to POST /api/v1/classification-rules/rules as MINFI001;
3. import: one analyze + commit per folder of the corpus (DRH and DSI as MINFI001, DAF as its
   manager MGR001, MINESUP as MINESUP001; target = the folder's org unit) in manifest `expected.files` order, so
   that duplicates follow their original;
4. states: versions, locks (MGR001) and trash from `expected`;
5. check: the database is compared with `expected` (per file and aggregated); any mismatch
   exits non-zero with the differences, so the demo never starts on an unverified baseline.

The API is called in-process (httpx ASGI transport) with real JWT access tokens: the same
authorization, rule engine and duplicate detection as the UI. Redis must be reachable (token
blacklist check).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import mimetypes
import os
import sys
import time
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import delete, select  # noqa: E402

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.security import create_access_token  # noqa: E402
from app.main import app  # noqa: E402
from app.models.classification_activity import ClassificationActivity  # noqa: E402
from app.models.classification_domain import ClassificationDomain  # noqa: E402
from app.models.classification_rule import ClassificationRule  # noqa: E402
from app.models.document import Document  # noqa: E402
from app.models.document_version import DocumentVersion  # noqa: E402
from app.models.classification_review import ClassificationReview  # noqa: E402
from app.models.import_job import ImportJob  # noqa: E402
from app.models.import_job_item import ImportJobItem  # noqa: E402
from app.models.org_unit import OrgUnit  # noqa: E402
from app.models.tenant import Tenant  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.storage.factory import get_storage_service  # noqa: E402

TENANTS = ("MINFI", "MINESUP")
FOLDER_UNIT = {
    "DRH": "MINFI-DRH",
    "DAF": "MINFI-DAF",
    "DSI": "MINFI-DSI",
    "MINESUP": "MINESUP-DAAJ",
}
# DAF imported by its manager: managers lock only documents they own (documents.update_own)
FOLDER_USER = {
    "DRH": "MINFI001",
    "DAF": "MGR001",
    "DSI": "MINFI001",
    "MINESUP": "MINESUP001",
}
MIME = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".png": "image/png",
}


class DemoError(RuntimeError):
    pass


def _mime(name: str) -> str:
    return (
        MIME.get(Path(name).suffix.lower())
        or mimetypes.guess_type(name)[0]
        or "application/octet-stream"
    )


async def _check(response, what: str) -> dict:
    if response.status_code >= 400:
        raise DemoError(f"{what}: HTTP {response.status_code} {response.text[:300]}")
    return response.json() if response.content else {}


class Demo:
    def __init__(self, manifest: dict, corpus: Path):
        self.manifest = manifest
        self.corpus = corpus
        self.tokens: dict[str, str] = {}
        self.units: dict[str, OrgUnit] = {}
        self.document_ids: dict[str, str] = {}  # relative path -> document id

    # -- database helpers -----------------------------------------------------------------

    async def load_refs(self, db) -> None:
        tenants = {
            t.short_name: t
            for t in (
                await db.execute(select(Tenant).where(Tenant.short_name.in_(TENANTS)))
            ).scalars()
        }
        if set(tenants) != set(TENANTS):
            raise DemoError(f"tenants {TENANTS} missing: run seed_db.py first")
        self.tenants = tenants
        users = (
            (
                await db.execute(
                    select(User).where(
                        User.matricule.in_(["MINFI001", "MGR001", "MINESUP001"])
                    )
                )
            )
            .scalars()
            .all()
        )
        for user in users:
            self.tokens[user.matricule] = create_access_token({"sub": str(user.id)})
        if len(self.tokens) != 3:
            raise DemoError(f"demo accounts missing: {sorted(self.tokens)}")
        for unit in (
            await db.execute(
                select(OrgUnit).where(OrgUnit.code.in_(list(FOLDER_UNIT.values())))
            )
        ).scalars():
            self.units[unit.code] = unit

    async def purge(self, db) -> Counter:
        stats = Counter()
        tenant_ids = [t.id for t in self.tenants.values()]
        storage = get_storage_service()
        documents = (
            (
                await db.execute(
                    select(Document).where(Document.tenant_id.in_(tenant_ids))
                )
            )
            .scalars()
            .all()
        )
        for document in documents:
            versions = (
                (
                    await db.execute(
                        select(DocumentVersion).where(
                            DocumentVersion.document_id == document.id
                        )
                    )
                )
                .scalars()
                .all()
            )
            for path in {document.file_path, *(v.file_path for v in versions)}:
                try:
                    storage.delete_file(path)
                except Exception:  # noqa: BLE001 - a missing file must not block the reset
                    pass
            await db.delete(document)  # versions, items, reviews, workflows cascade
            stats["documents"] += 1
        staged = (
            (
                await db.execute(
                    select(ImportJobItem.staging_file_path)
                    .join(ImportJob)
                    .where(
                        ImportJob.tenant_id.in_(tenant_ids),
                        ImportJobItem.staging_file_path.is_not(None),
                    )
                )
            )
            .scalars()
            .all()
        )
        for path in staged:  # items left for review keep their file in staging
            try:
                storage.delete_file(path)
            except Exception:  # noqa: BLE001 - a missing file must not block the reset
                pass
        stats["staging_files"] = len(staged)
        stats["import_jobs"] = (
            await db.execute(
                delete(ImportJob).where(ImportJob.tenant_id.in_(tenant_ids))
            )
        ).rowcount
        stats["rules"] = (
            await db.execute(
                delete(ClassificationRule).where(
                    ClassificationRule.tenant_id.in_(tenant_ids)
                )
            )
        ).rowcount
        await db.commit()
        return stats

    async def resolve_rule(self, db, rule: dict) -> dict:
        tenant = self.tenants[self.manifest["tenant"]]
        domain = (
            await db.execute(
                select(ClassificationDomain).where(
                    ClassificationDomain.tenant_id == tenant.id,
                    ClassificationDomain.code == rule["domain"],
                )
            )
        ).scalar_one()
        activity = (
            await db.execute(
                select(ClassificationActivity).where(
                    ClassificationActivity.domain_id == domain.id,
                    ClassificationActivity.code == rule["activity"],
                )
            )
        ).scalar_one()
        payload = {
            "code": rule["code"],
            "name": rule["name"],
            "priority": rule["priority"],
            "is_active": rule.get("isActive", True),
            "source_scope": rule.get("sourceScope", "service"),
            "source_org_unit_ids": [
                str(self.units[c].id) for c in rule.get("sourceOrgUnits") or []
            ],
            "filename_pattern": rule.get("filenamePattern"),
            "mime_type_pattern": rule.get("mimeTypePattern"),
            "target_scope": rule.get("targetScope", "service"),
            "target_org_unit_id": str(self.units[rule["targetOrgUnit"]].id)
            if rule.get("targetOrgUnit")
            else None,
            "domain_id": str(domain.id),
            "activity_id": str(activity.id),
            "year_strategy": rule.get("yearStrategy", "current"),
        }
        return {k: v for k, v in payload.items() if v is not None}

    # -- API steps ------------------------------------------------------------------------

    def client(self, matricule: str) -> AsyncClient:
        return AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://demo",
            headers={"Authorization": f"Bearer {self.tokens[matricule]}"},
            timeout=600,
        )

    async def create_rules(self, payloads: list[dict]) -> int:
        async with self.client("MINFI001") as client:
            for payload in payloads:
                await _check(
                    await client.post(
                        "/api/v1/classification-rules/rules", json=payload
                    ),
                    f"rule {payload['code']}",
                )
        return len(payloads)

    async def import_folder(self, folder: str, paths: list[str]) -> dict:
        files = [
            ("files", (Path(p).name, (self.corpus / p).read_bytes(), _mime(p)))
            for p in paths
        ]
        data = {
            "source_scope": "service",
            "processing_mode": "process",
            "target_org_unit_id": str(self.units[FOLDER_UNIT[folder]].id),
            "source_relative_paths": json.dumps(paths),
        }
        async with self.client(FOLDER_USER[folder]) as client:
            job = await _check(
                await client.post("/api/v1/imports/analyze", files=files, data=data),
                f"analyze {folder}",
            )
            result = await _check(
                await client.post(f"/api/v1/imports/{job['id']}/commit"),
                f"commit {folder}",
            )
        for item in result["job"]["items"]:
            if item.get("document_id"):
                self.document_ids[item["source_relative_path"]] = item["document_id"]
        return {
            "files": len(paths),
            "duplicates": result["job"]["duplicate_files"],
            "imported": result["imported_documents"],
            "failed": result["failed_items"],
        }

    def _id_for_title(self, title: str) -> str:
        for path, document_id in self.document_ids.items():
            if Path(path).stem == title:
                return document_id
        raise DemoError(f"no imported document titled {title!r}")

    async def apply_states(self, expected: dict) -> Counter:
        stats = Counter()
        async with self.client("MINFI001") as client:
            for title in expected.get("versions", {}):
                source = next((self.corpus / "versions").glob(f"{title}.*"))
                files = {"file": (source.name, source.read_bytes(), _mime(source.name))}
                await _check(
                    await client.post(
                        f"/api/v1/documents/{self._id_for_title(title)}/versions",
                        files=files,
                        data={"change_note": "Version corrigée (démo)"},
                    ),
                    f"version {title}",
                )
                stats["versions"] += 1
        for matricule, titles in expected.get("locks", {}).items():
            async with self.client(matricule) as client:
                for title in titles:
                    await _check(
                        await client.post(
                            f"/api/v1/documents/{self._id_for_title(title)}/lock"
                        ),
                        f"lock {title}",
                    )
                    stats["locks"] += 1
        async with self.client("MINFI001") as client:
            for title in expected.get("trash", []):
                await _check(
                    await client.post(
                        f"/api/v1/documents/{self._id_for_title(title)}/trash"
                    ),
                    f"trash {title}",
                )
                stats["trash"] += 1
        return stats

    # -- verification ---------------------------------------------------------------------

    async def verify(self, db, expected: dict) -> list[str]:
        tenant_ids = [t.id for t in self.tenants.values()]
        documents = (
            (
                await db.execute(
                    select(Document).where(Document.tenant_id.in_(tenant_ids))
                )
            )
            .scalars()
            .all()
        )
        by_path = {d.source_relative_path: d for d in documents}
        units = {u.id: u.code for u in (await db.execute(select(OrgUnit))).scalars()}
        domains = {
            d.id: d.code
            for d in (await db.execute(select(ClassificationDomain))).scalars()
        }
        activities = {
            a.id: a.code
            for a in (await db.execute(select(ClassificationActivity))).scalars()
        }
        errors: list[str] = []

        reviews = (
            await db.execute(
                select(ImportJobItem.source_relative_path, ImportJob.target_org_unit_id)
                .join(
                    ClassificationReview,
                    ClassificationReview.import_job_item_id == ImportJobItem.id,
                )
                .join(ImportJob, ImportJob.id == ImportJobItem.import_job_id)
                .where(
                    ClassificationReview.tenant_id.in_(tenant_ids),
                    ClassificationReview.review_status == "open",
                )
            )
        ).all()
        review_units = {path: units.get(unit_id) for path, unit_id in reviews}

        for entry in expected["files"]:
            document = by_path.get(entry["path"])
            if entry["status"] == "duplicate":
                if document is not None or entry["path"] in review_units:
                    errors.append(
                        f"{entry['path']}: expected duplicate, document or review created"
                    )
                continue
            if entry["status"] == "needs_review":
                # commit opens a review (screen "a revoir") and creates no document
                if document is not None or entry["path"] not in review_units:
                    errors.append(
                        f"{entry['path']}: expected an open review and no document"
                    )
                continue
            if document is None:
                errors.append(f"{entry['path']}: expected classified, no document")
                continue
            actual = {
                "status": "classified"
                if document.classification_status == "classified"
                else "needs_review",
                "orgUnit": units.get(document.classification_target_org_unit_id),
                "domain": domains.get(document.classification_domain_id),
                "activity": activities.get(document.classification_activity_id),
                "year": document.classification_year,
            }
            wanted = {k: entry[k] for k in actual}
            if actual != wanted:
                errors.append(f"{entry['path']}: expected {wanted}, got {actual}")

        by_unit: dict[str, Counter] = {}
        for document in documents:
            bucket = by_unit.setdefault(
                units.get(document.org_unit_id),
                Counter(total=0, classified=0, toReview=0),
            )
            bucket["total"] += 1
            bucket[
                "classified"
                if document.classification_status == "classified"
                else "toReview"
            ] += 1
        for code in review_units.values():
            bucket = by_unit.setdefault(
                code, Counter(total=0, classified=0, toReview=0)
            )
            bucket["total"] += 1
            bucket["toReview"] += 1
        for code, wanted in expected["byOrgUnit"].items():
            if dict(by_unit.get(code, Counter())) != wanted:
                errors.append(
                    f"byOrgUnit {code}: expected {wanted}, got {dict(by_unit.get(code, Counter()))}"
                )
        classified = sum(
            1 for d in documents if d.classification_status == "classified"
        )
        totals = {
            "total": len(documents) + len(review_units),
            "classified": classified,
            "toReview": len(documents) - classified + len(review_units),
        }
        if totals != expected["documents"]:
            errors.append(f"documents: expected {expected['documents']}, got {totals}")

        titles = {Path(d.source_relative_path or "").stem: d for d in documents}
        for title in expected["trash"]:
            if not (titles.get(title) and titles[title].deleted_at):
                errors.append(f"trash: {title!r} not in trash")
        for matricule, locked in expected["locks"].items():
            for title in locked:
                if not (titles.get(title) and titles[title].locked_by_user_id):
                    errors.append(f"locks: {title!r} not locked")
        for title, count in expected["versions"].items():
            document = titles.get(title)
            actual = (
                (
                    await db.execute(
                        select(DocumentVersion).where(
                            DocumentVersion.document_id == document.id
                        )
                    )
                )
                .scalars()
                .all()
                if document
                else []
            )
            if len(actual) != count:
                errors.append(
                    f"versions: {title!r} has {len(actual)} versions, expected {count}"
                )
        jobs = (
            (
                await db.execute(
                    select(ImportJob).where(ImportJob.tenant_id.in_(tenant_ids))
                )
            )
            .scalars()
            .all()
        )
        imports = {
            "jobs": len(jobs),
            "duplicates": sum(j.duplicate_files for j in jobs),
        }
        if imports != expected["imports"]:
            errors.append(f"imports: expected {expected['imports']}, got {imports}")
        rules = (
            (
                await db.execute(
                    select(ClassificationRule).where(
                        ClassificationRule.tenant_id == self.tenants["MINFI"].id
                    )
                )
            )
            .scalars()
            .all()
        )
        if sorted(r.code for r in rules) != sorted(expected["classificationRules"]):
            errors.append(f"rules: {sorted(r.code for r in rules)}")
        if sorted(r.code for r in rules if not r.is_active) != sorted(
            expected["inactiveRules"]
        ):
            errors.append("inactive rules differ")
        self.summary = {
            "documents": totals,
            "byOrgUnit": {k: dict(v) for k, v in by_unit.items()},
            "imports": imports,
            "trash": sum(1 for d in documents if d.deleted_at),
            "locks": sum(1 for d in documents if d.locked_by_user_id),
            "rules": len(rules),
        }
        return errors


async def run(manifest: dict, corpus: Path) -> int:
    started = time.perf_counter()
    expected = manifest["expected"]
    demo = Demo(manifest, corpus)
    async with AsyncSessionLocal() as db:
        await demo.load_refs(db)
        purged = await demo.purge(db)
        print(f"purge: {dict(purged)}")
        payloads = [await demo.resolve_rule(db, rule) for rule in manifest["rules"]]
    print(f"rules: {await demo.create_rules(payloads)} created")
    folders: dict[str, list[str]] = {}
    for entry in expected["files"]:
        folders.setdefault(entry["path"].split("/", 1)[0], []).append(entry["path"])
    for folder, paths in folders.items():
        print(f"import {folder}: {await demo.import_folder(folder, paths)}")
    print(f"states: {dict(await demo.apply_states(expected))}")
    async with AsyncSessionLocal() as db:
        errors = await demo.verify(db, expected)
    elapsed = time.perf_counter() - started
    print(f"summary: {json.dumps(demo.summary, ensure_ascii=False)}")
    print(f"elapsed: {elapsed:.1f} s")
    if errors:
        print(f"ERROR: {len(errors)} difference(s) with expected:")
        for error in errors[:40]:
            print(f"  - {error}")
        return 1
    print("demo baseline matches expected")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--manifest",
        default=os.getenv("DEMO_MANIFEST"),
        required=not os.getenv("DEMO_MANIFEST"),
    )
    parser.add_argument("--corpus", default=os.getenv("DEMO_CORPUS", "/data/ingest"))
    args = parser.parse_args()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    if manifest.get("profile") != "demo" or "expected" not in manifest:
        print(f"{args.manifest}: not a demo manifest with an expected section")
        return 2
    corpus = Path(args.corpus)
    if not (corpus / "DRH").is_dir():
        print(f"{corpus}: corpus missing, run scripts/demo-dataset.sh first")
        return 2
    print(f"=== demo seed: {args.manifest}, corpus {corpus} ===")
    try:
        return asyncio.run(run(manifest, corpus))
    except DemoError as exc:
        print(f"ERROR: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
