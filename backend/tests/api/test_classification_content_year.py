"""Lot 4 (V1.1): rule criteria on the OCR text and on the document year."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.classification_rule import ClassificationRule
from app.models.document import Document
from app.services.classification_rule_engine import ClassificationRuleEngine

RULES = "/api/v1/classification-rules/rules"
SIMULATE = "/api/v1/classification-rules/simulate"


def _sessions(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def _add_rule(test_engine, db_seed, **fields) -> None:
    values = {
        "tenant_id": db_seed["tenant_id"],
        "priority": 10,
        "is_active": True,
        "source_scope": "service",
        "source_org_unit_id": db_seed["org_unit_id"],
        "target_scope": "service",
        "target_org_unit_id": db_seed["org_unit_id"],
        "year_strategy": "current",
        **fields,
    }
    async with _sessions(test_engine)() as session:
        session.add(ClassificationRule(**values))
        await session.commit()


async def _add_document(test_engine, db_seed) -> uuid.UUID:
    document_id = uuid.uuid4()
    async with _sessions(test_engine)() as session:
        session.add(
            Document(
                id=document_id,
                tenant_id=db_seed["tenant_id"],
                org_unit_id=db_seed["org_unit_id"],
                owner_id=db_seed["user_id"],
                title="scan_0042",
                file_path="tenant/unit/scan_0042.pdf",
                file_type="pdf",
                mime_type="application/pdf",
                file_size=128,
                document_category_id=db_seed["category_id"],
                status="draft",
                processing_mode="archive",
            )
        )
        await session.commit()
    return document_id


async def _classify_at_upload(test_engine, db_seed, document_id) -> None:
    async with _sessions(test_engine)() as session:
        document = await session.get(Document, document_id)
        await ClassificationRuleEngine(session).classify_document(
            document=document,
            source_scope="service",
            source_user_id=db_seed["user_id"],
            filename="scan_0042.pdf",
            mime_type="application/pdf",
        )
        await session.commit()


async def _run_ocr_worker(test_engine, monkeypatch, document_id, text) -> None:
    from app.workers import tasks

    monkeypatch.setattr(tasks, "AsyncSessionLocal", _sessions(test_engine))
    await tasks.update_document_ocr(str(document_id), text, 0.9, "tesseract")


async def _document(test_engine, document_id) -> Document:
    async with _sessions(test_engine)() as session:
        return await session.get(Document, document_id)


def _simulation(db_seed, filename, **extra) -> dict:
    return {
        "document_category_id": str(db_seed["category_id"]),
        "source_scope": "service",
        "source_org_unit_id": str(db_seed["org_unit_id"]),
        "filename": filename,
        "mime_type": "application/pdf",
        **extra,
    }


@pytest.mark.asyncio
async def test_year_range_uses_the_year_in_the_file_name(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _add_rule(
        test_engine,
        db_seed,
        code="archives",
        name="Archives",
        year_min=2018,
        year_max=2020,
    )

    inside = await admin_client.post(
        SIMULATE, json=_simulation(db_seed, "budget_2019.pdf")
    )
    outside = await admin_client.post(
        SIMULATE, json=_simulation(db_seed, "budget_2022.pdf")
    )

    assert inside.json()["status"] == "classified"
    assert outside.json()["status"] == "no_rule"
    check = next(
        c
        for c in outside.json()["diagnostics"][0]["checks"]
        if c["key"] == "year_range"
    )
    assert check["passed"] is False and "2022" in check["detail"]


@pytest.mark.asyncio
async def test_year_min_above_year_max_is_refused(admin_client: AsyncClient, db_seed):
    base = {
        "source_scope": "service",
        "target_scope": "service",
        "target_org_unit_id": str(db_seed["org_unit_id"]),
        "year_strategy": "current",
    }
    inverted = await admin_client.post(
        RULES,
        json={
            **base,
            "code": "bornes_inversees",
            "name": "Bornes inversees",
            "year_min": 2021,
            "year_max": 2019,
        },
    )
    out_of_range = await admin_client.post(
        RULES,
        json={
            **base,
            "code": "annee_absurde",
            "name": "Annee absurde",
            "year_min": 1500,
        },
    )

    assert inverted.status_code == 400
    assert "annee minimale" in inverted.json()["detail"]
    assert out_of_range.status_code == 422


@pytest.mark.asyncio
async def test_content_rule_waits_for_the_ocr_then_classifies_once(
    test_engine, db_seed, monkeypatch
):
    await _add_rule(
        test_engine,
        db_seed,
        code="factures",
        name="Factures",
        content_pattern="facture; avoir",
    )
    document_id = await _add_document(test_engine, db_seed)
    text = "FACTURE numero 12 du fournisseur"

    await _classify_at_upload(test_engine, db_seed, document_id)
    before_ocr = await _document(test_engine, document_id)
    await _run_ocr_worker(test_engine, monkeypatch, document_id, text)
    after_ocr = await _document(test_engine, document_id)
    await _run_ocr_worker(test_engine, monkeypatch, document_id, text)
    replayed = await _document(test_engine, document_id)

    assert before_ocr.classification_status == "pending"
    assert after_ocr.classification_status == "classified"
    assert after_ocr.extra_data["ocr_engine"] == "tesseract"
    assert after_ocr.extra_data["classification_inputs"]["filename"] == "scan_0042.pdf"
    fields = (
        "classification_status",
        "classification_target_org_unit_id",
        "classification_year",
    )
    assert [getattr(replayed, f) for f in fields] == [
        getattr(after_ocr, f) for f in fields
    ]


@pytest.mark.asyncio
async def test_classified_document_is_not_moved_by_the_ocr(
    test_engine, db_seed, monkeypatch
):
    await _add_rule(
        test_engine,
        db_seed,
        code="general",
        name="General",
        priority=50,
        year_strategy="fixed",
        fixed_year=2001,
    )
    await _add_rule(
        test_engine,
        db_seed,
        code="factures",
        name="Factures",
        priority=1,
        content_pattern="facture",
        year_strategy="fixed",
        fixed_year=2002,
    )
    document_id = await _add_document(test_engine, db_seed)

    await _classify_at_upload(test_engine, db_seed, document_id)
    classified = await _document(test_engine, document_id)
    await _run_ocr_worker(test_engine, monkeypatch, document_id, "Facture fournisseur")
    after_ocr = await _document(test_engine, document_id)

    assert classified.classification_status == "classified"
    assert (classified.classification_year, after_ocr.classification_year) == (
        2001,
        2001,
    )
    assert after_ocr.ocr_content == "Facture fournisseur"


@pytest.mark.asyncio
async def test_ocr_of_a_document_never_classified_changes_nothing(
    test_engine, db_seed, monkeypatch
):
    await _add_rule(
        test_engine,
        db_seed,
        code="factures",
        name="Factures",
        content_pattern="facture",
    )
    document_id = await _add_document(test_engine, db_seed)

    await _run_ocr_worker(test_engine, monkeypatch, document_id, "Facture")

    document = await _document(test_engine, document_id)
    assert document.ocr_content == "Facture"
    assert "classification_inputs" not in (document.extra_data or {})
    assert document.classification_status == "pending"
    assert document.extra_data["ocr_engine"] == "tesseract"


@pytest.mark.asyncio
async def test_simulator_shows_seven_checks_and_reads_the_content_sample(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _add_rule(
        test_engine,
        db_seed,
        code="factures",
        name="Factures",
        content_pattern="facture",
    )

    without = (
        await admin_client.post(SIMULATE, json=_simulation(db_seed, "scan.pdf"))
    ).json()
    with_text = (
        await admin_client.post(
            SIMULATE,
            json=_simulation(db_seed, "scan.pdf", content_sample="Facture numero 3"),
        )
    ).json()

    checks = without["diagnostics"][0]["checks"]
    assert len(checks) == 7
    content = next(c for c in checks if c["key"] == "content_pattern")
    assert (content["passed"], content["detail"]) == (
        False,
        "Contenu non encore extrait",
    )
    assert without["status"] == "no_rule"
    assert with_text["status"] == "classified"
    assert {s["key"] for s in without["stages"]} >= {"content_pattern", "year_range"}


@pytest.mark.asyncio
async def test_new_criteria_survive_an_export_import_roundtrip(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _add_rule(
        test_engine,
        db_seed,
        code="factures_anciennes",
        name="Factures anciennes",
        content_pattern="facture",
        year_min=2015,
        year_max=2020,
    )
    exported = (await admin_client.get(f"{RULES}/export")).json()
    rule = exported["rules"][0]
    rule["code"] = "factures_copie"

    report = (
        await admin_client.post(f"{RULES}/import?dry_run=false", json=exported)
    ).json()
    reexported = (await admin_client.get(f"{RULES}/export")).json()

    criteria = ("content_pattern", "year_min", "year_max")
    assert [rule[k] for k in criteria] == ["facture", 2015, 2020]
    assert report["created"] == 1, report
    copy = next(r for r in reexported["rules"] if r["code"] == "factures_copie")
    assert [copy[k] for k in criteria] == ["facture", 2015, 2020]
