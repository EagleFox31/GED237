"""DELETE /documents/{id} (suppression définitive) : ``delete`` ou ``delete_own`` seulement.

Un manager n'a que ``trash_own`` : corbeille oui, suppression définitive non (403).
"""

import uuid

import pytest

from app.models.document import Document

DOCUMENTS = "/api/v1/documents"


async def _document(db_session, db_seed, *, status: str = "draft") -> uuid.UUID:
    document_id = uuid.uuid4()
    db_session.add(
        Document(
            id=document_id,
            tenant_id=db_seed["tenant_id"],
            org_unit_id=db_seed["org_unit_id"],
            owner_id=db_seed["user_id"],
            document_category_id=db_seed["category_id"],
            title="A supprimer",
            file_path=f"x/{document_id}.pdf",
            status=status,
        )
    )
    await db_session.commit()
    return document_id


def _owner(db_seed):
    return {
        "tenant_id": db_seed["tenant_id"],
        "org_unit_id": db_seed["org_unit_id"],
        "id": db_seed["user_id"],
    }


@pytest.mark.asyncio
async def test_manager_owner_can_trash_but_not_delete_for_good(
    client_as, db_session, db_seed
):
    document_id = await _document(db_session, db_seed)

    async with client_as("manager", **_owner(db_seed)) as client:
        denied = await client.delete(f"{DOCUMENTS}/{document_id}")
        trashed = await client.post(f"{DOCUMENTS}/{document_id}/trash")

    assert denied.status_code == 403
    assert trashed.status_code == 200
    document = await db_session.get(Document, document_id)
    assert document is not None


@pytest.mark.asyncio
async def test_collaborator_owner_can_delete_own_document(
    client_as, db_session, db_seed
):
    document_id = await _document(db_session, db_seed)

    async with client_as("collaborator", **_owner(db_seed)) as client:
        response = await client.delete(f"{DOCUMENTS}/{document_id}")

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_collaborator_cannot_delete_someone_elses_document(
    client_as, db_session, db_seed
):
    document_id = await _document(db_session, db_seed)

    async with client_as(
        "collaborator", **{**_owner(db_seed), "id": uuid.uuid4()}
    ) as client:
        response = await client.delete(f"{DOCUMENTS}/{document_id}")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_collaborator_cannot_delete_a_document_in_review(
    client_as, db_session, db_seed
):
    document_id = await _document(db_session, db_seed, status="in_review")

    async with client_as("collaborator", **_owner(db_seed)) as client:
        response = await client.delete(f"{DOCUMENTS}/{document_id}")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_tenant_admin_delete_is_unchanged(client_as, db_session, db_seed):
    document_id = await _document(db_session, db_seed, status="validated")

    async with client_as(
        "tenant_admin", tenant_id=db_seed["tenant_id"], id=uuid.uuid4()
    ) as client:
        response = await client.delete(f"{DOCUMENTS}/{document_id}")

    assert response.status_code == 204
