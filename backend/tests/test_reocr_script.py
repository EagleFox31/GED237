"""reocr.py : sélection par nom, version courante, corbeille exclue, rien en file sans --run."""

import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import reocr  # noqa: E402

ROWS = [
    ("id-1", "IMG_0413.jpg", 0, "t/v2.jpg", "image/jpeg"),
    ("id-2", "IMG_0413 copie.jpg", 365, "t/c.jpg", "image/jpeg"),
]


def test_like_pattern_matches_substring_literally():
    assert reocr.like_pattern("IMG_04") == r"%IMG\_04%"
    assert reocr.like_pattern("100%") == r"%100\%%"


def test_without_run_lists_and_dispatches_nothing():
    calls, lines = [], []
    count = reocr.plan(ROWS, False, lambda *a: calls.append(a) or "x", lines.append)
    assert count == 2 and calls == []
    assert lines[0] == "id-1 | IMG_0413.jpg | ocr_chars=0"
    assert not any("task_id" in line for line in lines)


def test_with_run_dispatches_each_document_once():
    calls, lines = [], []
    reocr.plan(ROWS, True, lambda *a: calls.append(a) or "tid", lines.append)
    assert calls == [
        ("id-1", "t/v2.jpg", "image/jpeg"),
        ("id-2", "t/c.jpg", "image/jpeg"),
    ]
    assert "  relance task_id=tid" in lines


async def _add_doc(
    session,
    seed,
    title,
    *,
    deleted=False,
    versions=("1.0",),
    current=-1,
    doc_mime=None,
    version_mime="image/jpeg",
):
    from app.models.document import Document
    from app.models.document_version import DocumentVersion

    now = datetime.now(timezone.utc)
    doc = Document(
        id=uuid.uuid4(),
        tenant_id=seed["tenant_id"],
        org_unit_id=seed["org_unit_id"],
        owner_id=seed["user_id"],
        title=title,
        file_path="t/doc",
        mime_type=doc_mime,
        deleted_at=now if deleted else None,
    )
    session.add(doc)
    await session.flush()
    made = []
    for number in versions:
        v = DocumentVersion(
            id=uuid.uuid4(),
            document_id=doc.id,
            version_number=number,
            file_path=f"t/v{number}",
            mime_type=version_mime,
            uploaded_by_id=seed["user_id"],
            uploaded_at=now,
        )
        session.add(v)
        made.append(v)
    await session.flush()
    doc.current_version_id = made[current].id
    await session.commit()
    return doc


async def _select(session, name, tenant=None):
    result = await session.execute(
        text(reocr.SELECT_SQL), {"pattern": reocr.like_pattern(name), "tenant": tenant}
    )
    return result.all()


@pytest.mark.asyncio
async def test_trashed_documents_are_not_selected(db_session, db_seed):
    await _add_doc(db_session, db_seed, "reocr-vivant.jpg")
    await _add_doc(db_session, db_seed, "reocr-corbeille.jpg", deleted=True)
    rows = await _select(db_session, "reocr-")
    assert [r[1] for r in rows] == ["reocr-vivant.jpg"]


@pytest.mark.asyncio
async def test_current_version_wins_even_when_text_sort_would_pick_another(
    db_session, db_seed
):
    # "1.9" > "1.10" en tri texte : la version courante (1.10) doit rester choisie.
    await _add_doc(
        db_session, db_seed, "reocr-versions.jpg", versions=("1.9", "1.10"), current=1
    )
    rows = await _select(db_session, "reocr-versions")
    assert len(rows) == 1 and rows[0][3] == "t/v1.10"


@pytest.mark.asyncio
async def test_mime_falls_back_to_the_document_and_tenant_filter_applies(
    db_session, db_seed
):
    await _add_doc(
        db_session,
        db_seed,
        "reocr-mime.pdf",
        doc_mime="application/pdf",
        version_mime=None,
    )
    rows = await _select(db_session, "reocr-mime")
    assert rows[0][4] == "application/pdf"
    assert await _select(db_session, "reocr-mime", str(db_seed["tenant_id"]))
    assert not await _select(db_session, "reocr-mime", str(uuid.uuid4()))


@pytest.mark.asyncio
async def test_run_resets_attempts_and_failure_flag_and_keeps_other_data(
    db_session, db_seed
):
    from app.models.document import Document
    from app.services import ocr_recovery

    failed = await _add_doc(db_session, db_seed, "reocr-echec.jpg")
    other = await _add_doc(db_session, db_seed, "reocr-autre.jpg")
    stuck = {
        ocr_recovery.DELIVERIES_KEY: 4,
        ocr_recovery.REQUEUE_COUNT_KEY: 3,
        ocr_recovery.FAILED_KEY: {"reason": "cap", "at": "2026-11-18T00:00:00+00:00"},
        "source": "scan",
    }
    failed.extra_data = dict(stuck)
    other.extra_data = dict(stuck)
    failed_id, other_id = failed.id, other.id
    await db_session.commit()

    assert await reocr.reset_attempts(db_session, [failed_id]) == 1
    assert await reocr.reset_attempts(db_session, []) == 0

    db_session.expire_all()
    reset = await db_session.get(Document, failed_id)
    untouched = await db_session.get(Document, other_id)
    assert reset.extra_data == {"source": "scan"}
    assert untouched.extra_data[ocr_recovery.FAILED_KEY]["reason"] == "cap"
