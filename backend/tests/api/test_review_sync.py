"""The review screen lists review rows: every path that leaves a document « à vérifier »
must open one, and the OCR pass must close the one it makes pointless."""

import json
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.models.classification_review import ClassificationReview
from app.models.classification_rule import ClassificationRule
from app.models.document import Document
from app.services.classification_review_service import ClassificationReviewService
from app.services.classification_rule_engine import ClassificationRuleEngine
from app.services.ingest_watch import run_watch_pass

REVIEWS = "/api/v1/classification-reviews"


def _sessions(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
def watched_folder(tmp_path, monkeypatch):
    root = tmp_path / "root"
    folder = root / "courrier"
    folder.mkdir(parents=True)
    monkeypatch.setattr(settings, "INGEST_ALLOWED_ROOTS_STR", str(root))
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path / "storage"))
    monkeypatch.setattr(settings, "INGEST_WATCH_INTERVAL_SECONDS", 60)
    monkeypatch.setattr(settings, "INGEST_WATCH_SETTLE_SECONDS", 0)
    monkeypatch.setattr(
        settings,
        "INGEST_WATCH_FOLDERS_STR",
        json.dumps(
            [
                {
                    "path": str(folder),
                    "tenant_code": "TESTMIN",
                    "org_unit_code": "DIR-TEST",
                    "matricule": "TEST001",
                    "document_category_code": "note_de_service",
                    "processing_mode": "archive",
                }
            ]
        ),
    )
    return folder


async def _add_document(test_engine, db_seed, *, status="pending") -> uuid.UUID:
    document_id = uuid.uuid4()
    async with _sessions(test_engine)() as session:
        session.add(
            Document(
                id=document_id,
                tenant_id=db_seed["tenant_id"],
                org_unit_id=db_seed["org_unit_id"],
                owner_id=db_seed["user_id"],
                title="scan_0042",
                file_path=f"tenant/unit/{document_id}.pdf",
                file_type="pdf",
                mime_type="application/pdf",
                file_size=128,
                document_category_id=db_seed["category_id"],
                status="draft",
                processing_mode="archive",
                classification_status=status,
            )
        )
        await session.commit()
    return document_id


async def _upload_like(test_engine, db_seed, document_id) -> None:
    """What POST /documents/upload does: classify, then open a review if undecided."""
    async with _sessions(test_engine)() as session:
        document = await session.get(Document, document_id)
        await ClassificationRuleEngine(session).classify_document(
            document=document,
            source_scope="service",
            source_user_id=db_seed["user_id"],
            filename="scan_0042.pdf",
            mime_type="application/pdf",
        )
        assert document.classification_status == "pending"
        await ClassificationReviewService(session).ensure_open_review_for_document(
            document=document
        )
        await session.commit()


async def _run_ocr_worker(test_engine, monkeypatch, document_id, text) -> None:
    from app.workers import tasks

    monkeypatch.setattr(tasks, "AsyncSessionLocal", _sessions(test_engine))
    await tasks.update_document_ocr(str(document_id), text, 0.9, "tesseract")


async def _reviews(test_engine, document_id) -> list[ClassificationReview]:
    async with _sessions(test_engine)() as session:
        result = await session.execute(
            select(ClassificationReview).where(
                ClassificationReview.document_id == document_id
            )
        )
        return list(result.scalars().all())


async def _listed(admin_client: AsyncClient) -> set[str]:
    response = await admin_client.get(REVIEWS)
    assert response.status_code == 200
    return {item["document_id"] for item in response.json()}


@pytest.mark.asyncio
async def test_watched_folder_import_left_to_review_reaches_the_review_screen(
    admin_client: AsyncClient, fake_redis, test_engine, db_seed, watched_folder
):
    (watched_folder / "note.txt").write_text("sans regle", encoding="utf-8")

    result = await run_watch_pass(_sessions(test_engine), fake_redis)

    assert result["folders"][0]["imported"] == 1
    async with _sessions(test_engine)() as session:
        document = (
            await session.execute(
                select(Document).where(Document.tenant_id == db_seed["tenant_id"])
            )
        ).scalar_one()
    assert document.classification_status == "pending"
    reviews = await _reviews(test_engine, document.id)
    assert [r.review_status for r in reviews] == ["open"]
    assert str(document.id) in await _listed(admin_client)


@pytest.mark.asyncio
async def test_a_review_that_cannot_be_opened_never_loses_the_import(
    fake_redis, test_engine, db_seed, watched_folder, monkeypatch
):
    async def broken(self, *, document):
        raise RuntimeError("review table unavailable")

    monkeypatch.setattr(
        ClassificationReviewService, "sync_review_with_document_status", broken
    )
    (watched_folder / "note.txt").write_text("sans regle", encoding="utf-8")

    result = await run_watch_pass(_sessions(test_engine), fake_redis)

    assert {k: result["folders"][0][k] for k in ("imported", "errors")} == {
        "imported": 1,
        "errors": 0,
    }


@pytest.mark.asyncio
async def test_pdf_still_to_review_after_the_ocr_reaches_the_review_screen(
    admin_client: AsyncClient, test_engine, db_seed, monkeypatch
):
    # Imported PDF: no review at import, the OCR pass decides.
    document_id = await _add_document(test_engine, db_seed)

    await _run_ocr_worker(test_engine, monkeypatch, document_id, "texte sans regle")
    await _run_ocr_worker(test_engine, monkeypatch, document_id, "texte sans regle")

    assert [r.review_status for r in await _reviews(test_engine, document_id)] == [
        "open"
    ]
    assert str(document_id) in await _listed(admin_client)


@pytest.mark.asyncio
async def test_review_opened_on_upload_closes_once_the_ocr_classifies(
    admin_client: AsyncClient, test_engine, db_seed, monkeypatch
):
    async with _sessions(test_engine)() as session:
        session.add(
            ClassificationRule(
                tenant_id=db_seed["tenant_id"],
                priority=10,
                is_active=True,
                code="factures",
                name="Factures",
                content_pattern="facture",
                source_scope="service",
                source_org_unit_id=db_seed["org_unit_id"],
                target_scope="service",
                target_org_unit_id=db_seed["org_unit_id"],
                year_strategy="current",
            )
        )
        await session.commit()
    document_id = await _add_document(test_engine, db_seed)
    await _upload_like(test_engine, db_seed, document_id)
    assert str(document_id) in await _listed(admin_client)

    await _run_ocr_worker(test_engine, monkeypatch, document_id, "FACTURE numero 12")

    (review,) = await _reviews(test_engine, document_id)
    assert review.review_status == "cancelled"
    assert review.resolved_at is not None
    # Off the screen: nobody is offered a resolve that would answer 400.
    assert str(document_id) not in await _listed(admin_client)


@pytest.mark.asyncio
async def test_back_fill_plans_then_applies_then_is_a_no_op(test_engine, db_seed):
    left_out = await _add_document(test_engine, db_seed, status="needs_review")
    stale = await _add_document(test_engine, db_seed, status="classified")
    decided = await _add_document(test_engine, db_seed, status="pending")
    async with _sessions(test_engine)() as session:
        session.add_all(
            [
                ClassificationReview(
                    tenant_id=db_seed["tenant_id"],
                    document_id=stale,
                    review_status="open",
                ),
                ClassificationReview(
                    tenant_id=db_seed["tenant_id"],
                    document_id=decided,
                    review_status="resolved",
                ),
            ]
        )
        await session.commit()

    async with _sessions(test_engine)() as session:
        service = ClassificationReviewService(session)
        plan = await service.document_ids_out_of_sync(tenant_id=db_seed["tenant_id"])
        first = await service.reconcile_document_reviews(tenant_id=db_seed["tenant_id"])
        second = await service.reconcile_document_reviews(
            tenant_id=db_seed["tenant_id"]
        )

    assert set(plan) == {left_out, stale}
    assert first == {"opened": 1, "cancelled": 1}
    assert second == {"opened": 0, "cancelled": 0}
    assert [r.review_status for r in await _reviews(test_engine, left_out)] == ["open"]
    assert [r.review_status for r in await _reviews(test_engine, stale)] == [
        "cancelled"
    ]
    # A person's decision is never reopened.
    assert [r.review_status for r in await _reviews(test_engine, decided)] == [
        "resolved"
    ]
