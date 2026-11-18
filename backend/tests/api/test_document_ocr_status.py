"""The OCR state is exposed on the document list and sheet (read only, derived)."""

import uuid

import pytest

from app.models.document import Document
from app.services.ocr_status import compute_ocr_status


def _document(db_seed, *, mime, ocr_content=None, extra_data=None) -> Document:
    return Document(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        owner_id=db_seed["user_id"],
        title=f"Doc {mime}",
        file_path=f"tenant/unit/{uuid.uuid4()}",
        file_type=mime.split("/")[-1],
        mime_type=mime,
        file_size=1024,
        document_category_id=db_seed["category_id"],
        status="draft",
        ocr_content=ocr_content,
        extra_data=extra_data or {},
    )


CASES = [
    ("image/jpeg", None, None, "processing"),
    ("application/pdf", None, None, "processing"),
    ("application/pdf", "Texte lu", None, "completed"),
    ("image/png", None, {"ocr_failed": {"reason": "x"}}, "failed"),
    ("image/png", "Texte lu", {"ocr_failed": {"reason": "x"}}, "completed"),
    ("application/zip", None, None, "not_processed"),
]


@pytest.mark.parametrize("mime,content,extra,expected", CASES)
def test_status_rule(db_seed, mime, content, extra, expected):
    document = _document(db_seed, mime=mime, ocr_content=content, extra_data=extra)
    assert compute_ocr_status(document) == expected


@pytest.mark.asyncio
async def test_list_and_sheet_expose_the_same_status_as_the_ocr_endpoint(
    client_as, db_session, db_seed
):
    documents = {
        expected + str(i): _document(
            db_seed, mime=mime, ocr_content=content, extra_data=extra
        )
        for i, (mime, content, extra, expected) in enumerate(CASES)
    }
    db_session.add_all(documents.values())
    await db_session.commit()

    async with client_as("super_admin", tenant_id=db_seed["tenant_id"]) as client:
        listing = await client.get("/api/v1/documents/", params={"limit": 100})
        assert listing.status_code == 200, listing.text
        by_id = {row["id"]: row for row in listing.json()}

        for i, (mime, content, extra, expected) in enumerate(CASES):
            document = documents[expected + str(i)]
            assert by_id[str(document.id)]["ocr_status"] == expected

            sheet = await client.get(f"/api/v1/documents/{document.id}")
            assert sheet.status_code == 200, sheet.text
            assert sheet.json()["ocr_status"] == expected

            ocr = await client.get(f"/api/v1/documents/{document.id}/ocr")
            assert ocr.status_code == 200, ocr.text
            assert ocr.json()["ocr_status"] == expected
