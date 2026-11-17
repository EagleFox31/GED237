"""PATCH /documents/{id} leaves a trace (#250).

A rename, a category or an archiving is audited as ``document_updated`` with only
the changed fields, before and after. A placement change keeps its own
``reclassify`` entry. A PATCH that changes nothing writes nothing.
"""

import uuid

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.document import Document

DOCUMENTS = "/api/v1/documents"


async def _document(db_session, db_seed, **fields):
    document = Document(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        owner_id=db_seed["user_id"],
        title="Note de service",
        file_path=f"tenant/unit/{uuid.uuid4()}.pdf",
        file_type="pdf",
        mime_type="application/pdf",
        file_size=128,
        document_category_id=db_seed["category_id"],
        status="draft",
        classification_status="classified",
        **fields,
    )
    db_session.add(document)
    await db_session.commit()
    return document.id


async def _entries(db_session, document_id):
    result = await db_session.execute(
        select(AuditLog.action, AuditLog.details)
        .where(AuditLog.record_id == document_id)
        .order_by(AuditLog.created_at)
    )
    return [(action, details) for action, details in result.all()]


def _owner(client_as, db_seed):
    # The manager owns the draft: the owner may rename it.
    return client_as(
        "manager",
        id=db_seed["user_id"],
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    )


@pytest.mark.asyncio
async def test_a_rename_is_audited_with_the_title_before_and_after(
    client_as, db_session, db_seed
):
    document_id = await _document(db_session, db_seed)
    async with _owner(client_as, db_seed) as client:
        response = await client.patch(
            f"{DOCUMENTS}/{document_id}", json={"title": "Note de service 2026"}
        )
    assert response.status_code == 200, response.text
    assert await _entries(db_session, document_id) == [
        (
            "document_updated",
            {
                "changed": ["title"],
                "before": {"title": "Note de service"},
                "after": {"title": "Note de service 2026"},
            },
        )
    ]


@pytest.mark.asyncio
async def test_a_patch_that_changes_nothing_writes_no_entry(
    client_as, db_session, db_seed
):
    document_id = await _document(db_session, db_seed)
    async with _owner(client_as, db_seed) as client:
        same = await client.patch(
            f"{DOCUMENTS}/{document_id}",
            json={"title": "Note de service", "tags": None},
        )
        empty = await client.patch(f"{DOCUMENTS}/{document_id}", json={})
    assert same.status_code == 200, same.text
    assert empty.status_code == 200, empty.text
    assert await _entries(db_session, document_id) == []


@pytest.mark.asyncio
async def test_archiving_is_audited_as_a_status_change(client_as, db_session, db_seed):
    document_id = await _document(db_session, db_seed, status="validated")
    async with client_as(
        "tenant_admin",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        response = await client.patch(
            f"{DOCUMENTS}/{document_id}", json={"status": "archived"}
        )
    assert response.status_code == 200, response.text
    assert await _entries(db_session, document_id) == [
        (
            "document_updated",
            {
                "changed": ["status"],
                "before": {"status": "validated"},
                "after": {"status": "archived"},
            },
        )
    ]


@pytest.mark.asyncio
async def test_a_reclassification_is_one_reclassify_entry_not_two(
    client_as, db_session, db_seed
):
    document_id = await _document(db_session, db_seed)
    async with _owner(client_as, db_seed) as client:
        response = await client.patch(
            f"{DOCUMENTS}/{document_id}",
            json={
                "classification_scope": "service",
                "classification_target_org_unit_id": str(db_seed["org_unit_id"]),
                "classification_year": 2026,
            },
        )
    assert response.status_code == 200, response.text
    entries = await _entries(db_session, document_id)
    assert [action for action, _ in entries] == ["reclassify"]
    before, after = entries[0][1]["before"], entries[0][1]["after"]
    assert (before["classification_year"], after["classification_year"]) == (None, 2026)
    assert after["classification_target_org_unit_id"] == str(db_seed["org_unit_id"])
