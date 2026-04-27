# backend/tests/api/test_documents.py
import pytest
import io
from httpx import AsyncClient
from uuid import uuid4


@pytest.mark.asyncio
async def test_upload_document(auth_client: AsyncClient, db_seed):
    file_content = b"fake document content"
    file = io.BytesIO(file_content)

    response = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("test.txt", file, "text/plain")},
        data={
            "title": "Test Document",
            "document_category_id": str(db_seed["category_id"]),
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Document"
    assert "id" in data
    return data["id"]


@pytest.mark.asyncio
async def test_trash_and_restore_document(auth_client: AsyncClient, db_seed):
    # 1. Upload
    file = io.BytesIO(b"content for trash")
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("trash.txt", file, "text/plain")},
        data={"title": "Trash Me", "document_category_id": str(db_seed["category_id"])},
    )
    doc_id = up_resp.json()["id"]

    # 2. Trash
    trash_resp = await auth_client.post(f"/api/v1/documents/{doc_id}/trash")
    assert trash_resp.status_code == 200

    # 3. Check in trash
    list_trash = await auth_client.get("/api/v1/documents/trash")
    assert any(d["id"] == doc_id for d in list_trash.json())

    # 4. Restore
    restore_resp = await auth_client.post(f"/api/v1/documents/{doc_id}/restore")
    assert restore_resp.status_code == 200

    # 5. Check not in trash
    list_trash_again = await auth_client.get("/api/v1/documents/trash")
    assert not any(d["id"] == doc_id for d in list_trash_again.json())


@pytest.mark.asyncio
async def test_document_locking(auth_client: AsyncClient, db_seed):
    # 1. Upload
    file = io.BytesIO(b"content for lock")
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("lock.txt", file, "text/plain")},
        data={"title": "Lock Me", "document_category_id": str(db_seed["category_id"])},
    )
    doc_id = up_resp.json()["id"]

    # 2. Lock
    lock_resp = await auth_client.post(f"/api/v1/documents/{doc_id}/lock")
    assert lock_resp.status_code == 200
    assert "lock_expires_at" in lock_resp.json()

    # 3. Unlock
    unlock_resp = await auth_client.post(f"/api/v1/documents/{doc_id}/unlock")
    assert unlock_resp.status_code == 200


@pytest.mark.asyncio
async def test_duplicate_detection(auth_client: AsyncClient, db_seed):
    content = b"identical content"
    # First upload
    await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("file1.txt", io.BytesIO(content), "text/plain")},
        data={"title": "File 1", "document_category_id": str(db_seed["category_id"])},
    )

    # Second upload with same content
    dup_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("file2.txt", io.BytesIO(content), "text/plain")},
        data={"title": "File 2", "document_category_id": str(db_seed["category_id"])},
    )

    assert dup_resp.status_code == 409
    assert dup_resp.json()["detail"]["error"] == "duplicate_file"


@pytest.mark.asyncio
async def test_workspace_and_tree(auth_client: AsyncClient):
    # Test tree
    tree_resp = await auth_client.get("/api/v1/documents/tree")
    assert tree_resp.status_code == 200
    assert isinstance(tree_resp.json(), list)

    # Test workspace
    ws_resp = await auth_client.get("/api/v1/documents/workspace")
    assert ws_resp.status_code == 200
    assert isinstance(ws_resp.json(), list)


@pytest.mark.asyncio
async def test_manager_dashboard(auth_client: AsyncClient):
    # Standard user has org_unit_id but might not be 'manager' role in logic,
    # but the endpoint currently only checks for org_unit_id existence.
    resp = await auth_client.get("/api/v1/analytics/manager")
    assert resp.status_code == 200
    data = resp.json()
    assert "documents" in data
    assert "active_workflows" in data
