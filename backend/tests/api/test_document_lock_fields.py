"""DocumentRead exposes who holds the edit lock (#274) and who sent it to the trash (#181)."""

import io
import uuid
from types import SimpleNamespace

import pytest
from httpx import AsyncClient

from app.api.v1.endpoints.documents import _user_name_in_tenant


@pytest.mark.asyncio
async def test_the_document_tells_who_holds_the_lock_until_it_is_released(
    auth_client: AsyncClient, db_seed
):
    up = await auth_client.post(
        "/api/v1/documents/upload",
        files={
            "file": ("lock-fields.txt", io.BytesIO(b"lock fields #274"), "text/plain")
        },
        data={
            "title": "Lock fields",
            "document_category_id": str(db_seed["category_id"]),
        },
    )
    assert up.status_code == 201, up.text
    doc_id = up.json()["id"]
    free = (await auth_client.get(f"/api/v1/documents/{doc_id}")).json()
    assert free["locked_by_user_id"] is None
    assert free["locked_by_name"] is None
    assert free["locked_at"] is None
    assert free["lock_expires_at"] is None

    assert (
        await auth_client.post(f"/api/v1/documents/{doc_id}/lock")
    ).status_code == 200
    locked = (await auth_client.get(f"/api/v1/documents/{doc_id}")).json()
    # The uploader locked it: same person as the owner.
    assert locked["locked_by_user_id"] == locked["owner_id"]
    assert locked["locked_by_name"] == locked["owner_name"]
    assert locked["locked_at"] is not None
    assert locked["lock_expires_at"] > locked["locked_at"]

    assert (
        await auth_client.post(f"/api/v1/documents/{doc_id}/unlock")
    ).status_code == 200
    released = (await auth_client.get(f"/api/v1/documents/{doc_id}")).json()
    assert released["locked_by_user_id"] is None
    assert released["locked_by_name"] is None


def test_a_user_of_another_tenant_or_a_removed_account_has_no_name():
    tenant = uuid.uuid4()
    user = SimpleNamespace(tenant_id=tenant, full_name="Awa Ndiaye", matricule="M-1")
    assert _user_name_in_tenant(user, tenant) == "Awa Ndiaye"
    assert _user_name_in_tenant(user, uuid.uuid4()) is None
    assert _user_name_in_tenant(None, tenant) is None


@pytest.mark.asyncio
async def test_the_trash_tells_when_and_by_whom_a_document_was_deleted(
    auth_client: AsyncClient, db_seed
):
    """Same pattern for the trash screen (#181)."""
    up = await auth_client.post(
        "/api/v1/documents/upload",
        files={
            "file": ("trash-fields.txt", io.BytesIO(b"trash fields #181"), "text/plain")
        },
        data={
            "title": "Trash fields",
            "document_category_id": str(db_seed["category_id"]),
            # Archived at upload: the owner may trash it (not under validation).
            "processing_mode": "archive",
        },
    )
    assert up.status_code == 201, up.text
    doc_id = up.json()["id"]
    assert up.json()["deleted_at"] is None

    assert (
        await auth_client.post(f"/api/v1/documents/{doc_id}/trash")
    ).status_code == 200
    trashed = next(
        d
        for d in (await auth_client.get("/api/v1/documents/trash")).json()
        if d["id"] == doc_id
    )
    assert trashed["deleted_at"] is not None
    assert trashed["deleted_by"] == trashed["owner_id"]
    assert trashed["deleted_by_name"] == trashed["owner_name"]

    assert (
        await auth_client.post(f"/api/v1/documents/{doc_id}/restore")
    ).status_code == 200
    restored = (await auth_client.get(f"/api/v1/documents/{doc_id}")).json()
    assert restored["deleted_at"] is None
    assert restored["deleted_by"] is None
    assert restored["deleted_by_name"] is None
