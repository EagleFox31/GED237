"""« Relancer la lecture » (#355): POST /documents/{id}/ocr/retry.

202 then the reading runs again; 409 while it is under way; same rights as PATCH;
GET /documents/{id} tells the front end whether the caller may do it (can_update).
"""

import uuid
from types import SimpleNamespace

import pytest

from app.api.v1.endpoints import documents as documents_endpoint
from app.models.document import Document

FAILED = {"ocr_failed": {"reason": "worker killed"}, "ocr_deliveries": 3, "keep": "me"}


def _document(db_seed, *, ocr_content=None, extra_data=None, tenant_id=None):
    return Document(
        id=uuid.uuid4(),
        tenant_id=tenant_id or db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        owner_id=db_seed["user_id"],
        title="Scan",
        file_path=f"tenant/unit/{uuid.uuid4()}.png",
        file_type="png",
        mime_type="image/png",
        file_size=1024,
        document_category_id=db_seed["category_id"],
        status="draft",
        ocr_content=ocr_content,
        extra_data=dict(extra_data or {}),
    )


@pytest.fixture
def queued(monkeypatch):
    calls = []
    monkeypatch.setattr(
        documents_endpoint,
        "process_document_ocr",
        SimpleNamespace(delay=lambda *args: calls.append(args)),
    )
    return calls


def _retry(document):
    return f"/api/v1/documents/{document.id}/ocr/retry"


@pytest.mark.asyncio
async def test_failed_reading_is_queued_once_and_a_second_click_gets_409(
    client_as, db_session, db_seed, queued
):
    document = _document(db_seed, extra_data=FAILED)
    db_session.add(document)
    await db_session.commit()

    async with client_as("tenant_admin", tenant_id=db_seed["tenant_id"]) as client:
        before = (await client.get(f"/api/v1/documents/{document.id}")).json()
        first = await client.post(_retry(document))
        second = await client.post(_retry(document))
        after = (await client.get(f"/api/v1/documents/{document.id}")).json()

    assert (before["ocr_status"], before["can_update"]) == ("failed", True)
    assert first.status_code == 202, first.text
    assert first.json()["ocr_status"] == "processing"
    assert second.status_code == 409
    assert after["ocr_status"] == "processing"
    assert queued == [(str(document.id), document.file_path, "image/png")]
    await db_session.refresh(document)
    # Counters and flag forgotten: the worker starts again from zero; other data kept.
    assert document.extra_data == {"keep": "me"}


@pytest.mark.asyncio
async def test_nothing_to_read_again_is_422(client_as, db_session, db_seed, queued):
    document = _document(db_seed, ocr_content="Texte lu")
    db_session.add(document)
    await db_session.commit()

    async with client_as("tenant_admin", tenant_id=db_seed["tenant_id"]) as client:
        response = await client.post(_retry(document))

    assert response.status_code == 422
    assert queued == []


@pytest.mark.asyncio
async def test_reader_sees_can_update_false_and_gets_403(
    client_as, db_session, db_seed, queued
):
    document = _document(db_seed, extra_data=FAILED)
    db_session.add(document)
    await db_session.commit()

    async with client_as(
        "reader", tenant_id=db_seed["tenant_id"], org_unit_id=db_seed["org_unit_id"]
    ) as client:
        sheet = await client.get(f"/api/v1/documents/{document.id}")
        response = await client.post(_retry(document))

    assert sheet.status_code == 200, sheet.text
    assert sheet.json()["can_update"] is False
    assert response.status_code == 403
    assert queued == []


@pytest.mark.asyncio
async def test_other_tenant_gets_404(client_as, db_session, db_seed, queued):
    document = _document(db_seed, extra_data=FAILED)
    db_session.add(document)
    await db_session.commit()

    async with client_as("tenant_admin", tenant_id=uuid.uuid4()) as client:
        response = await client.post(_retry(document))

    assert response.status_code == 404
    assert queued == []


@pytest.mark.asyncio
async def test_list_leaves_can_update_unset(client_as, db_session, db_seed, queued):
    db_session.add(_document(db_seed, extra_data=FAILED))
    await db_session.commit()

    async with client_as("tenant_admin", tenant_id=db_seed["tenant_id"]) as client:
        listing = await client.get("/api/v1/documents/", params={"limit": 100})

    assert listing.status_code == 200, listing.text
    items = listing.json()
    items = items["items"] if isinstance(items, dict) else items
    assert items and all(item["can_update"] is None for item in items)
