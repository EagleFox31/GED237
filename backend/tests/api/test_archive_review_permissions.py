"""Archiving and the needs-review queue (#228): the tenant_admin gets the
dedicated ``documents, archive`` and ``documents, review`` actions, not
``manage``; lower roles stay refused and another institution sees nothing."""

import uuid

import pytest

from app.models.document import Document
from app.models.tenant import Tenant

DOCUMENTS = "/api/v1/documents"


async def _document(db_session, db_seed, *, tenant_id=None, **fields):
    values = {
        "status": "validated",
        "classification_status": "classified",
        **fields,
    }
    document = Document(
        id=uuid.uuid4(),
        tenant_id=tenant_id or db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        owner_id=db_seed["user_id"],
        title="Arrêté validé",
        file_path=f"tenant/unit/{uuid.uuid4()}.pdf",
        file_type="pdf",
        mime_type="application/pdf",
        file_size=128,
        document_category_id=db_seed["category_id"],
        processing_mode="archive",
        **values,
    )
    db_session.add(document)
    await db_session.commit()
    return document.id


async def _other_tenant(db_session):
    tenant_id = uuid.uuid4()
    db_session.add(
        Tenant(
            id=tenant_id,
            name="Autre institution",
            short_name="AUTRE",
            domain=f"autre-{tenant_id}.gov.cm",
            is_active=True,
        )
    )
    await db_session.commit()
    return tenant_id


def _caller(db_seed, role):
    # The manager owns the seeded documents: the refusal cannot come from
    # another unit or another owner.
    fields = {"tenant_id": db_seed["tenant_id"], "org_unit_id": db_seed["org_unit_id"]}
    if role == "manager":
        fields["id"] = db_seed["user_id"]
    return fields


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["tenant_admin", "super_admin"])
async def test_an_administrator_archives_a_validated_document(
    client_as, db_session, db_seed, role
):
    document_id = await _document(db_session, db_seed)
    async with client_as(role, **_caller(db_seed, role)) as client:
        response = await client.patch(
            f"{DOCUMENTS}/{document_id}", json={"status": "archived"}
        )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "archived"


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["unit_admin", "manager"])
async def test_lower_roles_cannot_archive(client_as, db_session, db_seed, role):
    document_id = await _document(db_session, db_seed)
    async with client_as(role, **_caller(db_seed, role)) as client:
        response = await client.patch(
            f"{DOCUMENTS}/{document_id}", json={"status": "archived"}
        )
    assert response.status_code == 403
    if role == "unit_admin":
        # The manager is stopped earlier: its own validated document is no
        # longer editable by its owner. The unit_admin reaches the archive check.
        assert "'archive'" in response.json()["detail"]
    document = await db_session.get(Document, document_id)
    await db_session.refresh(document)
    assert document.status == "validated"


@pytest.mark.asyncio
async def test_archiving_still_requires_a_validated_or_signed_document(
    client_as, db_session, db_seed
):
    document_id = await _document(db_session, db_seed, status="draft")
    async with client_as("tenant_admin", **_caller(db_seed, "tenant_admin")) as client:
        response = await client.patch(
            f"{DOCUMENTS}/{document_id}", json={"status": "archived"}
        )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_another_institution_cannot_archive_it(client_as, db_session, db_seed):
    document_id = await _document(db_session, db_seed)
    other = await _other_tenant(db_session)
    async with client_as("tenant_admin", tenant_id=other, org_unit_id=None) as client:
        response = await client.patch(
            f"{DOCUMENTS}/{document_id}", json={"status": "archived"}
        )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_the_tenant_admin_sees_only_its_own_needs_review_queue(
    client_as, db_session, db_seed
):
    mine = await _document(
        db_session, db_seed, status="draft", classification_status="needs_review"
    )
    other = await _other_tenant(db_session)
    theirs = await _document(
        db_session,
        db_seed,
        tenant_id=other,
        status="draft",
        classification_status="needs_review",
    )
    async with client_as("tenant_admin", **_caller(db_seed, "tenant_admin")) as client:
        response = await client.get(f"{DOCUMENTS}/needs-review")
    assert response.status_code == 200, response.text
    ids = {row["id"] for row in response.json()}
    assert str(mine) in ids and str(theirs) not in ids


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["unit_admin", "manager"])
async def test_lower_roles_cannot_read_the_needs_review_queue(client_as, db_seed, role):
    async with client_as(role, **_caller(db_seed, role)) as client:
        response = await client.get(f"{DOCUMENTS}/needs-review")
    assert response.status_code == 403
    assert "'review'" in response.json()["detail"]


@pytest.mark.asyncio
async def test_the_tenant_admin_is_not_given_manage_on_documents():
    # manage would also bypass document locks: archive and review are granted
    # one by one. Guards against a later "simplification" of the policy.
    from app.core.authz.casbin_enforcer import enforce_permission

    assert not await enforce_permission("tenant_admin", "documents", "manage")
    assert await enforce_permission("tenant_admin", "documents", "archive")
    assert await enforce_permission("tenant_admin", "documents", "review")
