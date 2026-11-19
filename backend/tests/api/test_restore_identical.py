"""POST /documents/{id}/restore flags an active document with the same file, without
refusing: deposit A, trash it, deposit it again, restore → two identical documents, and
the answer names the other one so the screen can warn. Only what the user can read is
named."""

import hashlib
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.user import User

DOCUMENTS = "/api/v1/documents"
SAME = hashlib.sha256(b"A.pdf").hexdigest()
OTHER = hashlib.sha256(b"B.pdf").hexdigest()


async def _document(
    db_session, db_seed, *, checksum, title, owner_id=None, trashed=False
) -> uuid.UUID:
    document_id = uuid.uuid4()
    owner_id = owner_id or db_seed["user_id"]
    now = datetime.now(timezone.utc)
    document = Document(
        id=document_id,
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        owner_id=owner_id,
        document_category_id=db_seed["category_id"],
        title=title,
        file_path=f"x/{document_id}.pdf",
        status="draft",
        deleted_at=now if trashed else None,
        deleted_by=owner_id if trashed else None,
    )
    db_session.add(document)
    await db_session.flush()
    version = DocumentVersion(
        document_id=document_id,
        version_number="1.0",
        file_path=document.file_path,
        checksum_sha256=checksum,
        uploaded_by_id=owner_id,
        uploaded_at=now,
    )
    db_session.add(version)
    await db_session.flush()
    document.current_version_id = version.id
    await db_session.commit()
    return document_id


async def _colleague(db_session, db_seed) -> uuid.UUID:
    user_id = uuid.uuid4()
    db_session.add(
        User(
            id=user_id,
            tenant_id=db_seed["tenant_id"],
            org_unit_id=db_seed["org_unit_id"],
            role_id=db_seed["role_id"],
            matricule=f"COL-{user_id.hex[:8]}",
            email=f"col-{user_id.hex[:8]}@testministry.gov.cm",
            first_name="Collegue",
            last_name="Service",
            password_hash="fakehash",
            is_active=True,
        )
    )
    await db_session.commit()
    return user_id


def _owner(db_seed):
    return {
        "tenant_id": db_seed["tenant_id"],
        "org_unit_id": db_seed["org_unit_id"],
        "id": db_seed["user_id"],
    }


@pytest.mark.asyncio
async def test_restore_names_the_identical_active_document_and_still_restores(
    client_as, db_session, db_seed
):
    trashed = await _document(
        db_session, db_seed, checksum=SAME, title="A", trashed=True
    )
    redeposited = await _document(db_session, db_seed, checksum=SAME, title="A (2)")

    async with client_as("collaborator", **_owner(db_seed)) as client:
        response = await client.post(f"{DOCUMENTS}/{trashed}/restore")

    assert response.status_code == 200
    assert response.json() == {
        "message": "Document restaure.",
        "identical_document": {"id": str(redeposited), "title": "A (2)"},
    }
    db_session.expire_all()
    assert (await db_session.get(Document, trashed)).deleted_at is None
    audit = await db_session.scalar(
        select(AuditLog).where(
            AuditLog.record_id == trashed, AuditLog.action == "document_restored"
        )
    )
    assert audit.new_data == {"identical_document_id": str(redeposited)}


@pytest.mark.asyncio
async def test_restore_without_identical_active_document_flags_nothing(
    client_as, db_session, db_seed
):
    trashed = await _document(
        db_session, db_seed, checksum=SAME, title="A", trashed=True
    )
    await _document(db_session, db_seed, checksum=OTHER, title="B")
    # A copy that is itself in the trash is not an active duplicate.
    await _document(db_session, db_seed, checksum=SAME, title="A bis", trashed=True)

    async with client_as("collaborator", **_owner(db_seed)) as client:
        response = await client.post(f"{DOCUMENTS}/{trashed}/restore")
        again = await client.post(f"{DOCUMENTS}/{trashed}/restore")

    assert response.status_code == 200
    assert response.json() == {
        "message": "Document restaure.",
        "identical_document": None,
    }
    assert again.json() == {
        "message": "Document deja actif.",
        "identical_document": None,
    }


@pytest.mark.asyncio
async def test_restore_never_reveals_a_document_outside_the_read_scope(
    client_as, db_session, db_seed
):
    colleague = await _colleague(db_session, db_seed)
    theirs = await _document(
        db_session,
        db_seed,
        checksum=SAME,
        title="Dossier du collegue",
        owner_id=colleague,
    )
    trashed = await _document(
        db_session, db_seed, checksum=SAME, title="A", trashed=True
    )

    # A collaborator reads only their own documents: the colleague's copy stays unnamed.
    async with client_as("collaborator", **_owner(db_seed)) as client:
        restored = await client.post(f"{DOCUMENTS}/{trashed}/restore")
        retrashed = await client.post(f"{DOCUMENTS}/{trashed}/trash")
    # A tenant administrator reads the whole tenant: the same restore names it.
    async with client_as("tenant_admin", **_owner(db_seed)) as client:
        admin_restored = await client.post(f"{DOCUMENTS}/{trashed}/restore")

    assert (restored.status_code, retrashed.status_code) == (200, 200)
    assert restored.json()["identical_document"] is None
    assert admin_restored.json()["identical_document"] == {
        "id": str(theirs),
        "title": "Dossier du collegue",
    }
