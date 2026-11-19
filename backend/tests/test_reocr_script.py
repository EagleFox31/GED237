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


# --- rattrapage par type (--type) -------------------------------------------------------

WORD = reocr.WORD_MIME
EXCEL = reocr.EXCEL_MIME


def test_type_mimes_match_the_worker_formats():
    from app.services.extraction import (
        DOCX_MIME_TYPE,
        OFFICE_MIME_TYPES,
        XLSX_MIME_TYPE,
    )

    assert (WORD, EXCEL) == (DOCX_MIME_TYPE, XLSX_MIME_TYPE)
    assert set(reocr.TYPES["office"]) == OFFICE_MIME_TYPES


@pytest.mark.parametrize("batch", [0, reocr.MAX_BATCH + 1])
def test_batch_size_is_bounded(batch):
    with pytest.raises(ValueError):
        reocr.type_params("word", batch, None, None)


def test_cursor_must_be_an_id():
    with pytest.raises(ValueError):
        reocr.type_params("word", 10, "pas-un-id", None)


def test_next_cursor_only_when_the_batch_is_full():
    rows = [("a", "", 0, "", ""), ("b", "", 0, "", "")]
    assert reocr.next_cursor(rows, 2) == "b"
    assert reocr.next_cursor(rows, 3) is None
    assert reocr.next_cursor([], 3) is None


@pytest.mark.parametrize("argv", [[], ["nom", "--type", "word"]])
def test_name_or_type_but_not_both(argv):
    with pytest.raises(SystemExit) as exit_:
        reocr.main(argv)
    assert exit_.value.code == 2


async def _select_type(session, kind, batch=50, after=None, tenant=None):
    result = await session.execute(
        text(reocr.SELECT_BY_TYPE_SQL), reocr.type_params(kind, batch, after, tenant)
    )
    return result.all()


@pytest.mark.asyncio
async def test_type_selects_office_files_without_text_only(db_session, db_seed):
    word = await _add_doc(db_session, db_seed, "rt-a.docx", version_mime=WORD)
    excel = await _add_doc(
        db_session, db_seed, "rt-b.xlsx", version_mime=None, doc_mime=EXCEL
    )
    read = await _add_doc(db_session, db_seed, "rt-c.docx", version_mime=WORD)
    read.ocr_content = "déjà lu"
    await _add_doc(db_session, db_seed, "rt-d.docx", version_mime=WORD, deleted=True)
    await _add_doc(db_session, db_seed, "rt-e.jpg")
    await db_session.commit()

    assert [r[0] for r in await _select_type(db_session, "word")] == [word.id]
    assert [r[0] for r in await _select_type(db_session, "excel")] == [excel.id]
    office = await _select_type(db_session, "office")
    assert sorted(r[0] for r in office) == sorted([word.id, excel.id])
    assert not await _select_type(db_session, "office", tenant=str(uuid.uuid4()))


@pytest.mark.asyncio
async def test_type_batches_walk_every_document_once(db_session, db_seed):
    made = [
        (await _add_doc(db_session, db_seed, f"rt-lot-{i}.docx", version_mime=WORD)).id
        for i in range(5)
    ]
    seen, after = [], None
    while True:
        rows = await _select_type(db_session, "word", batch=2, after=after)
        seen += [r[0] for r in rows]
        after = reocr.next_cursor(rows, 2)
        if after is None:
            break
    assert seen == sorted(made)
