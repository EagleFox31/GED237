import io

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.document import Document


async def _upload_archive(client: AsyncClient, db_seed, *, name: str, content: bytes):
    response = await client.post(
        "/api/v1/documents/upload",
        files={"file": (name, io.BytesIO(content), "text/plain")},
        data={
            "title": name.rsplit(".", 1)[0],
            "document_category_id": str(db_seed["category_id"]),
            "processing_mode": "archive",
        },
    )
    assert response.status_code == 201
    return response.json()


@pytest.mark.asyncio
async def test_document_read_content_update_ocr_and_audit_endpoints(
    admin_client: AsyncClient, db_session, db_seed
):
    uploaded = await _upload_archive(
        admin_client,
        db_seed,
        name="coverage-document.txt",
        content=b"coverage-content",
    )
    document_id = uploaded["id"]

    listing = await admin_client.get("/api/v1/documents/", params={"status": "draft"})
    assert listing.status_code == 200
    assert any(row["id"] == document_id for row in listing.json())

    fetched = await admin_client.get(f"/api/v1/documents/{document_id}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == document_id

    versions = await admin_client.get(f"/api/v1/documents/{document_id}/versions")
    assert versions.status_code == 200
    assert len(versions.json()) == 1
    assert versions.json()[0]["is_current"] is True
    assert versions.json()[0]["uploaded_by_name"] == "Test User"

    invalid_disposition = await admin_client.get(
        f"/api/v1/documents/{document_id}/content",
        params={"disposition": "invalid"},
    )
    assert invalid_disposition.status_code == 400

    content = await admin_client.get(
        f"/api/v1/documents/{document_id}/content",
        params={"disposition": "attachment"},
    )
    assert content.status_code == 200
    assert content.content == b"coverage-content"
    assert content.headers["x-content-type-options"] == "nosniff"
    assert content.headers["cache-control"].startswith("private")
    assert "attachment" in content.headers["content-disposition"]

    audit_logs = await admin_client.get(f"/api/v1/documents/{document_id}/audit-logs")
    assert audit_logs.status_code == 200
    assert any(row["action"] == "content_viewed" for row in audit_logs.json())

    updated = await admin_client.patch(
        f"/api/v1/documents/{document_id}",
        json={"title": "Coverage Document Updated"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Coverage Document Updated"

    invalid_status = await admin_client.patch(
        f"/api/v1/documents/{document_id}", json={"status": "validated"}
    )
    assert invalid_status.status_code == 400

    premature_archive = await admin_client.patch(
        f"/api/v1/documents/{document_id}", json={"status": "archived"}
    )
    assert premature_archive.status_code == 409

    ocr = await admin_client.get(f"/api/v1/documents/{document_id}/ocr")
    assert ocr.status_code == 200
    assert ocr.json()["ocr_status"] == "not_processed"

    result = await db_session.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one()
    document.mime_type = "image/png"
    document.ocr_content = None
    document.extra_data = {}
    await db_session.commit()

    processing_ocr = await admin_client.get(f"/api/v1/documents/{document_id}/ocr")
    assert processing_ocr.status_code == 200
    assert processing_ocr.json()["ocr_status"] == "processing"

    document.ocr_content = "recognized coverage text"
    document.extra_data = {"ocr_confidence": 0.97}
    await db_session.commit()

    completed_ocr = await admin_client.get(f"/api/v1/documents/{document_id}/ocr")
    assert completed_ocr.status_code == 200
    assert completed_ocr.json()["ocr_status"] == "completed"
    assert completed_ocr.json()["ocr_confidence"] == 0.97


@pytest.mark.asyncio
async def test_document_start_workflow_trash_restore_purge_and_hard_delete(
    admin_client: AsyncClient, db_seed
):
    first = await _upload_archive(
        admin_client,
        db_seed,
        name="coverage-lifecycle.txt",
        content=b"lifecycle",
    )
    first_id = first["id"]

    started = await admin_client.post(f"/api/v1/documents/{first_id}/start-workflow")
    assert started.status_code == 200
    assert started.json()["processing_mode"] == "process"

    started_again = await admin_client.post(
        f"/api/v1/documents/{first_id}/start-workflow"
    )
    assert started_again.status_code == 400

    trashed = await admin_client.post(f"/api/v1/documents/{first_id}/trash")
    assert trashed.status_code == 200

    trashed_again = await admin_client.post(f"/api/v1/documents/{first_id}/trash")
    assert trashed_again.status_code == 200
    assert "deja" in trashed_again.json()["message"].lower()

    trash_listing = await admin_client.get("/api/v1/documents/trash")
    assert trash_listing.status_code == 200
    assert any(row["id"] == first_id for row in trash_listing.json())

    restored = await admin_client.post(f"/api/v1/documents/{first_id}/restore")
    assert restored.status_code == 200

    restored_again = await admin_client.post(f"/api/v1/documents/{first_id}/restore")
    assert restored_again.status_code == 200
    assert "deja" in restored_again.json()["message"].lower()

    assert (
        await admin_client.post(f"/api/v1/documents/{first_id}/trash")
    ).status_code == 200
    purged = await admin_client.delete(f"/api/v1/documents/{first_id}/purge")
    assert purged.status_code == 200

    missing = await admin_client.get(f"/api/v1/documents/{first_id}")
    assert missing.status_code == 404

    second = await _upload_archive(
        admin_client,
        db_seed,
        name="coverage-hard-delete.txt",
        content=b"hard-delete",
    )
    hard_deleted = await admin_client.delete(f"/api/v1/documents/{second['id']}")
    assert hard_deleted.status_code == 204

    missing_after_delete = await admin_client.get(f"/api/v1/documents/{second['id']}")
    assert missing_after_delete.status_code == 404
