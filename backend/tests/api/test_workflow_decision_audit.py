"""Every circuit decision leaves one row in the audit journal (C.22 point 4).

Approve, reject, send back and acknowledge each write exactly one audit row, with
the journal's label, the document's tenant and the user who acted. Before this,
only the submission (workflow_started) reached the journal.
"""

import uuid

import pytest
from httpx import AsyncClient

from app.api.v1.endpoints.audit import ACTION_LABELS
from app.models.audit import AuditLog
from tests.api.test_workflow_rejections import _act, _submit, _upload

DECISIONS = {
    "accepted": ("workflow_approved", "Validation"),
    "rejected": ("workflow_rejected", "Rejet"),
    "returned": ("workflow_returned", "Retour pour correction"),
    "acknowledged": ("workflow_step_completed", "Étape de workflow traitée"),
}


@pytest.mark.asyncio
@pytest.mark.parametrize("outcome", list(DECISIONS))
async def test_each_decision_writes_one_audit_row(
    auth_client: AsyncClient, db_seed, db_session, outcome
):
    action, label = DECISIONS[outcome]
    doc = await _upload(auth_client, f"Audit decision {outcome}")
    await _submit(auth_client, doc["id"], str(db_seed["user_id"]))
    await _act(auth_client, doc, outcome, f"Motif {outcome}")

    rows = (
        await db_session.execute(
            AuditLog.__table__.select().where(
                AuditLog.record_id == uuid.UUID(doc["id"]),
                AuditLog.action.like("workflow_%"),
                AuditLog.action != "workflow_started",
            )
        )
    ).all()
    assert [r.action for r in rows] == [action]
    row = rows[0]
    assert ACTION_LABELS[row.action] == label
    assert row.tenant_id == db_seed["tenant_id"]
    assert row.user_id == db_seed["user_id"]
    assert row.table_name == "documents"
    assert row.new_data["outcome"] == outcome
    assert row.new_data["comment"] == f"Motif {outcome}"
    assert row.new_data["step_label"] == "Visa"


@pytest.mark.asyncio
async def test_decision_shows_in_the_document_journal(
    admin_client: AsyncClient, db_seed
):
    # Reading the journal needs audit_logs:read: the same seeded user, as admin.
    doc = await _upload(admin_client, "Audit decision journal")
    await _submit(admin_client, doc["id"], str(db_seed["user_id"]))
    await _act(admin_client, doc, "accepted", "Bon pour accord")

    resp = await admin_client.get(
        "/api/v1/audit/logs", params={"action": "workflow_approved", "limit": 500}
    )
    assert resp.status_code == 200, resp.text
    mine = [e for e in resp.json() if e["record_id"] == doc["id"]]
    assert len(mine) == 1
    assert mine[0]["action_label"] == "Validation"
