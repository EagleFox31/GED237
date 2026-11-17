"""PATCH /documents/{id} leaves an audit trail (#151 F2): a rename and a classification
change each write one row, with French labels in the journal; a PATCH that changes
nothing writes none."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.document import Document

PATCH_ACTIONS = ("document_renamed", "classification_updated")


async def _document(db_session, db_seed, title: str) -> Document:
    document = Document(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        owner_id=db_seed["user_id"],
        title=title,
        file_path=f"tenant/unit/{uuid.uuid4().hex}.pdf",
        file_type="pdf",
        mime_type="application/pdf",
        file_size=128,
        document_category_id=db_seed["category_id"],
        status="draft",
        processing_mode="archive",
        classification_status="pending",
    )
    db_session.add(document)
    await db_session.commit()
    return document


async def _patch_audit(db_session, document_id) -> list[AuditLog]:
    rows = await db_session.scalars(
        select(AuditLog)
        .where(
            AuditLog.record_id == document_id,
            AuditLog.action.in_(PATCH_ACTIONS),
        )
        .order_by(AuditLog.created_at)
    )
    return list(rows)


@pytest.mark.asyncio
async def test_a_rename_writes_one_row_with_both_titles(
    admin_client: AsyncClient, db_session, db_seed
):
    document = await _document(db_session, db_seed, "Rapport brouillon")

    resp = await admin_client.patch(
        f"/api/v1/documents/{document.id}", json={"title": "Rapport final"}
    )
    assert resp.status_code == 200, resp.text

    (row,) = await _patch_audit(db_session, document.id)
    assert row.action == "document_renamed"
    assert row.table_name == "documents"
    assert row.user_id == db_seed["user_id"]
    assert row.new_data == {
        "old_title": "Rapport brouillon",
        "new_title": "Rapport final",
    }

    journal = await admin_client.get(
        "/api/v1/audit/logs", params={"table_name": "documents"}
    )
    assert journal.status_code == 200, journal.text
    labels = {
        entry["action_label"]
        for entry in journal.json()
        if entry["record_id"] == str(document.id)
    }
    assert labels == {"Document renommé"}


@pytest.mark.asyncio
async def test_a_classification_change_writes_one_row_with_old_and_new_values(
    admin_client: AsyncClient, db_session, db_seed
):
    document = await _document(db_session, db_seed, "Bordereau")

    resp = await admin_client.patch(
        f"/api/v1/documents/{document.id}",
        json={"classification_year": 2025, "classification_status": "pending"},
    )
    assert resp.status_code == 200, resp.text

    (row,) = await _patch_audit(db_session, document.id)
    assert row.action == "classification_updated"
    changes = row.new_data["changes"]
    assert changes["classification_year"] == {"old": None, "new": 2025}
    # Unchanged fields are not listed.
    assert "classification_status" not in changes
    assert "classification_domain_id" not in changes

    journal = await admin_client.get(
        "/api/v1/audit/logs", params={"table_name": "documents"}
    )
    labels = {
        entry["action_label"]
        for entry in journal.json()
        if entry["record_id"] == str(document.id)
    }
    assert labels == {"Classement modifié"}


@pytest.mark.asyncio
async def test_a_patch_that_changes_nothing_writes_no_row(
    admin_client: AsyncClient, db_session, db_seed
):
    document = await _document(db_session, db_seed, "Contrat")
    url = f"/api/v1/documents/{document.id}"
    payload = {"title": "Contrat signé", "classification_year": 2024}

    assert (await admin_client.patch(url, json=payload)).status_code == 200
    first = await _patch_audit(db_session, document.id)
    # Same transaction, same created_at: compare as a set, not in order.
    assert sorted(row.action for row in first) == sorted(PATCH_ACTIONS)

    # Same values again, then a PATCH with only the current title: nothing changes.
    assert (await admin_client.patch(url, json=payload)).status_code == 200
    assert (
        await admin_client.patch(url, json={"title": "Contrat signé"})
    ).status_code == 200
    assert len(await _patch_audit(db_session, document.id)) == len(first)
