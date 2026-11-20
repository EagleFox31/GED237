"""Directory import and watched folders classify the files the OCR never reads.

DOCX, XLSX, TXT, CSV...: classified at import, on name, type and category, like an
upload. Images and PDFs keep their path: OCR queued, classified after the OCR.
A failing classification never loses the import: the document stays ``pending``.
"""

import json

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.models.document import Document
from app.services.classification_rule_engine import ClassificationRuleEngine
from app.services.ingest_watch import run_watch_pass
from tests.api.test_imports import _seed_classification

INGEST = "/api/v1/documents/ingest-directory"
NOT_READ_BY_OCR = ("reparation_liste.csv", "reparation_memo.txt")
# Text read in the background: OCR for images and PDFs, direct reading for Word and Excel.
READ_BY_OCR = (
    "reparation_scan.pdf",
    "reparation_photo.png",
    "reparation_note.docx",
    "reparation_devis.xlsx",
)


@pytest.fixture
def lot(tmp_path, monkeypatch):
    """A mixed folder under the allowed root; the OCR queue is recorded, not run."""
    root = tmp_path / "root"
    folder = root / "lot"
    folder.mkdir(parents=True)
    for n, name in enumerate(NOT_READ_BY_OCR + READ_BY_OCR):
        (folder / name).write_bytes(f"contenu {n}".encode())
    monkeypatch.setattr(settings, "INGEST_ALLOWED_ROOTS_STR", str(root))
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path / "storage"))
    queued = []
    from app.workers import tasks

    monkeypatch.setattr(
        tasks.process_document_ocr, "delay", lambda *args: queued.append(args)
    )
    return {"folder": folder, "queued": queued}


async def _by_file(db: AsyncSession, tenant_id) -> dict[str, Document]:
    documents = (
        (await db.execute(select(Document).where(Document.tenant_id == tenant_id)))
        .scalars()
        .all()
    )
    return {
        document.extra_data["source_path"]
        .replace("\\", "/")
        .rsplit("/", 1)[-1]: document
        for document in documents
        if (document.extra_data or {}).get("ingestion") == "directory"
    }


def _payload(folder, db_seed) -> dict:
    return {
        "directory_path": str(folder),
        "recursive": True,
        "processing_mode": "archive",
        "document_category_id": str(db_seed["category_id"]),
    }


@pytest.mark.asyncio
async def test_files_without_ocr_are_classified_at_import(
    auth_client, db_session: AsyncSession, db_seed, lot
):
    domain, activity, _ = await _seed_classification(db_session, db_seed)

    response = await auth_client.post(INGEST, json=_payload(lot["folder"], db_seed))

    assert response.status_code == 200, response.text
    assert response.json()["imported"] == len(NOT_READ_BY_OCR + READ_BY_OCR)
    documents = await _by_file(db_session, db_seed["tenant_id"])
    for name in NOT_READ_BY_OCR:
        document = documents[name]
        assert document.classification_status == "classified", name
        assert document.classification_domain_id == domain.id, name
        assert document.classification_activity_id == activity.id, name
    # Images, PDFs, Word and Excel: text reading queued, classified afterwards.
    for name in READ_BY_OCR:
        assert documents[name].classification_status == "pending", name
    assert sorted(args[0] for args in lot["queued"]) == sorted(
        str(documents[name].id) for name in READ_BY_OCR
    )


@pytest.mark.asyncio
async def test_a_failing_classification_never_loses_the_import(
    auth_client, db_session: AsyncSession, db_seed, lot, monkeypatch
):
    await _seed_classification(db_session, db_seed)

    async def broken(self, **kwargs):
        raise RuntimeError("regle cassee")

    monkeypatch.setattr(ClassificationRuleEngine, "classify_document", broken)

    response = await auth_client.post(INGEST, json=_payload(lot["folder"], db_seed))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["imported"] == len(NOT_READ_BY_OCR + READ_BY_OCR)
    assert body["error_count"] == 0
    documents = await _by_file(db_session, db_seed["tenant_id"])
    assert {
        name: documents[name].classification_status for name in NOT_READ_BY_OCR
    } == {name: "pending" for name in NOT_READ_BY_OCR}


@pytest.mark.asyncio
async def test_watched_folder_classifies_the_same_way(
    fake_redis, test_engine, db_session: AsyncSession, db_seed, lot, monkeypatch
):
    """The watched folder goes through the same ingestion service (checklist 2.8)."""
    domain, _, _ = await _seed_classification(db_session, db_seed)
    monkeypatch.setattr(settings, "INGEST_WATCH_INTERVAL_SECONDS", 60)
    monkeypatch.setattr(settings, "INGEST_WATCH_SETTLE_SECONDS", 0)
    monkeypatch.setattr(
        settings,
        "INGEST_WATCH_FOLDERS_STR",
        json.dumps(
            [
                {
                    "path": str(lot["folder"]),
                    "tenant_code": "TESTMIN",
                    "org_unit_code": "DIR-TEST",
                    "matricule": "TEST001",
                    "document_category_code": "note_de_service",
                    "processing_mode": "archive",
                }
            ]
        ),
    )
    sessions = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    outcome = await run_watch_pass(sessions, fake_redis)

    assert outcome["folders"][0]["imported"] == len(NOT_READ_BY_OCR + READ_BY_OCR)
    documents = await _by_file(db_session, db_seed["tenant_id"])
    for name in NOT_READ_BY_OCR:
        assert documents[name].classification_domain_id == domain.id, name
    for name in READ_BY_OCR:
        assert documents[name].classification_status == "pending", name
