"""DELETE /documents/{id} met à la corbeille ; le définitif passe par /purge (``purge``).

Propriétaire (``delete_own`` / ``trash_own``) : seulement un document encore modifiable,
jamais pendant une validation. Un manager propriétaire met à la corbeille mais ne purge pas (403).
"""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select

from app.models.audit import AuditLog
from app.models.document import Document
from app.models.user import User

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
        trashed = await client.delete(f"{DOCUMENTS}/{document_id}")
        denied = await client.delete(f"{DOCUMENTS}/{document_id}/purge")

    assert trashed.status_code == 204
    assert denied.status_code == 403
    db_session.expire_all()
    document = await db_session.get(Document, document_id)
    assert document is not None
    assert document.deleted_at is not None


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

    # Compte réel : la mise à la corbeille écrit une ligne d'audit (clé étrangère users).
    async with client_as(
        "tenant_admin", tenant_id=db_seed["tenant_id"], id=db_seed["user_id"]
    ) as client:
        response = await client.delete(f"{DOCUMENTS}/{document_id}")

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_collaborator_cannot_trash_a_document_in_review(
    client_as, db_session, db_seed
):
    """POST /trash suit la règle de DELETE : pas de corbeille pendant une validation."""
    document_id = await _document(db_session, db_seed, status="in_review")

    async with client_as("collaborator", **_owner(db_seed)) as client:
        response = await client.post(f"{DOCUMENTS}/{document_id}/trash")

    assert response.status_code == 403
    db_session.expire_all()
    document = await db_session.get(Document, document_id)
    assert document.deleted_at is None


@pytest.mark.asyncio
async def test_reader_cannot_delete(client_as, db_session, db_seed):
    document_id = await _document(db_session, db_seed)

    async with client_as("reader", **_owner(db_seed)) as client:
        response = await client.delete(f"{DOCUMENTS}/{document_id}")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_unit_admin_deletes_only_in_its_tree(client_as, db_session, db_seed):
    inside = await _document(db_session, db_seed)
    outside = await _document(db_session, db_seed)

    async with client_as(
        "unit_admin",
        tenant_id=db_seed["tenant_id"],
        id=db_seed["user_id"],
        org_unit_id=uuid.uuid4(),
    ) as client:
        denied = await client.delete(f"{DOCUMENTS}/{outside}")
    async with client_as("unit_admin", **_owner(db_seed)) as client:
        allowed = await client.delete(f"{DOCUMENTS}/{inside}")

    assert denied.status_code == 404
    assert allowed.status_code == 204


@pytest.mark.asyncio
async def test_collaborator_owner_trashes_but_cannot_purge(
    client_as, db_session, db_seed
):
    document_id = await _document(db_session, db_seed)

    async with client_as("collaborator", **_owner(db_seed)) as client:
        trashed = await client.delete(f"{DOCUMENTS}/{document_id}")
        purged = await client.delete(f"{DOCUMENTS}/{document_id}/purge")

    assert trashed.status_code == 204
    assert purged.status_code == 403
    db_session.expire_all()
    document = await db_session.get(Document, document_id)
    assert document is not None and document.deleted_at is not None


@pytest.mark.asyncio
async def test_second_delete_is_a_no_op(client_as, db_session, db_seed):
    """Déjà à la corbeille : 204 sans nouvelle ligne d'audit."""
    document_id = await _document(db_session, db_seed)

    async with client_as("collaborator", **_owner(db_seed)) as client:
        first = await client.delete(f"{DOCUMENTS}/{document_id}")
        second = await client.delete(f"{DOCUMENTS}/{document_id}")

    assert (first.status_code, second.status_code) == (204, 204)
    trashed_rows = await db_session.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(
            AuditLog.record_id == document_id,
            AuditLog.action == "document_trashed",
        )
    )
    assert trashed_rows == 1


async def _trashed_by(db_session, db_seed, deleted_by) -> uuid.UUID:
    document_id = await _document(db_session, db_seed)
    document = await db_session.get(Document, document_id)
    document.deleted_at = datetime.now(timezone.utc)
    document.deleted_by = deleted_by
    await db_session.commit()
    return document_id


@pytest.mark.asyncio
async def test_owner_restores_what_they_trashed(client_as, db_session, db_seed):
    document_id = await _trashed_by(db_session, db_seed, db_seed["user_id"])

    async with client_as("collaborator", **_owner(db_seed)) as client:
        response = await client.post(f"{DOCUMENTS}/{document_id}/restore")

    assert response.status_code == 200
    db_session.expire_all()
    assert (await db_session.get(Document, document_id)).deleted_at is None


@pytest.mark.asyncio
async def test_owner_cannot_restore_what_an_admin_trashed(
    client_as, db_session, db_seed
):
    admin_id = uuid.uuid4()
    db_session.add(
        User(
            id=admin_id,
            tenant_id=db_seed["tenant_id"],
            org_unit_id=db_seed["org_unit_id"],
            role_id=db_seed["role_id"],
            matricule=f"ADM-{admin_id.hex[:8]}",
            email=f"admin-{admin_id.hex[:8]}@testministry.gov.cm",
            first_name="Admin",
            last_name="Corbeille",
            password_hash="fakehash",
            is_active=True,
        )
    )
    await db_session.commit()
    document_id = await _trashed_by(db_session, db_seed, admin_id)

    async with client_as("collaborator", **_owner(db_seed)) as client:
        denied = await client.post(f"{DOCUMENTS}/{document_id}/restore")
    async with client_as("tenant_admin", **_owner(db_seed)) as client:
        allowed = await client.post(f"{DOCUMENTS}/{document_id}/restore")

    assert denied.status_code == 403
    assert allowed.status_code == 200
