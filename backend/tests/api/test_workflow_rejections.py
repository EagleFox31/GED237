"""Rejection, correction and resubmission (L12-B).

A returned or rejected document shows the validator's reason, can be fixed
and submitted again; the validator's list is ordered and names the submitter;
the badges count what each user has to do.
"""

import io
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import delete

from app.models.audit import AuditLog
from app.models.user import User


async def _upload(client: AsyncClient, title: str) -> dict:
    resp = await client.post(
        "/api/v1/documents/upload",
        files={"file": (f"{title}.txt", io.BytesIO(title.encode()), "text/plain")},
        data={"title": title},  # no category: no automatic routing
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _submit(client: AsyncClient, doc_id: str, assignee: str) -> None:
    resp = await client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": 1,
                "label": "Visa",
                "assigned_to": assignee,
            }
        ],
    )
    assert resp.status_code == 201, resp.text


async def _act(client: AsyncClient, doc: dict, outcome: str, comment: str) -> None:
    pending = (await client.get("/api/v1/workflows/pending")).json()
    step = next(t for t in pending if t["document_id"] == doc["id"])
    resp = await client.post(
        f"/api/v1/workflows/step/{step['id']}/actions",
        json={
            "action_type": "visa",
            "outcome": outcome,
            "document_version_id": doc["current_version_id"],
            "comment": comment,
        },
    )
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
@pytest.mark.parametrize("outcome", ["returned", "rejected"])
async def test_reason_is_shown_and_document_can_be_submitted_again(
    auth_client: AsyncClient, db_seed, outcome
):
    me = str(db_seed["user_id"])
    doc = await _upload(auth_client, f"Note {outcome}")
    await _submit(auth_client, doc["id"], me)
    await _act(auth_client, doc, outcome, "Signature manquante en page 2")

    detail = (await auth_client.get(f"/api/v1/documents/{doc['id']}")).json()
    assert detail["status"] == outcome
    assert detail["last_rejection_reason"] == "Signature manquante en page 2"

    # The author fixes the document (owner-mutable), then submits it again.
    patch = await auth_client.patch(
        f"/api/v1/documents/{doc['id']}", json={"title": f"Note {outcome} v2"}
    )
    assert patch.status_code == 200, patch.text
    await _submit(auth_client, doc["id"], me)
    detail = (await auth_client.get(f"/api/v1/documents/{doc['id']}")).json()
    assert detail["status"] == "in_review"


@pytest.mark.asyncio
async def test_reason_is_the_latest_one(auth_client: AsyncClient, db_seed):
    me = str(db_seed["user_id"])
    doc = await _upload(auth_client, "Deux retours")
    await _submit(auth_client, doc["id"], me)
    await _act(auth_client, doc, "returned", "Premier motif")
    await _submit(auth_client, doc["id"], me)
    await _act(auth_client, doc, "returned", "Second motif")

    detail = (await auth_client.get(f"/api/v1/documents/{doc['id']}")).json()
    assert detail["last_rejection_reason"] == "Second motif"


@pytest.mark.asyncio
async def test_no_reason_on_a_document_never_rejected(auth_client: AsyncClient):
    doc = await _upload(auth_client, "Brouillon")
    detail = (await auth_client.get(f"/api/v1/documents/{doc['id']}")).json()
    assert detail["last_rejection_reason"] is None


@pytest.mark.asyncio
async def test_documents_filter_accepts_several_statuses(
    auth_client: AsyncClient, db_seed
):
    me = str(db_seed["user_id"])
    returned = await _upload(auth_client, "A corriger 1")
    rejected = await _upload(auth_client, "A corriger 2")
    draft = await _upload(auth_client, "Brouillon seul")
    for doc, outcome in ((returned, "returned"), (rejected, "rejected")):
        await _submit(auth_client, doc["id"], me)
        await _act(auth_client, doc, outcome, "Motif")

    both = await auth_client.get(
        "/api/v1/documents/", params=[("status", "rejected"), ("status", "returned")]
    )
    ids = {d["id"] for d in both.json()}
    assert {returned["id"], rejected["id"]} <= ids
    assert draft["id"] not in ids

    # A single value keeps working as before.
    single = await auth_client.get("/api/v1/documents/", params={"status": "returned"})
    assert {d["id"] for d in single.json()} == {returned["id"]}


@pytest.mark.asyncio
async def test_pending_is_ordered_and_names_the_submitter(
    auth_client: AsyncClient, db_seed, db_session
):
    me = str(db_seed["user_id"])
    first = await _upload(auth_client, "Premier")
    second = await _upload(auth_client, "Second")
    await _submit(auth_client, first["id"], me)
    await _submit(auth_client, second["id"], me)

    tasks = (await auth_client.get("/api/v1/workflows/pending")).json()
    assert [t["document_id"] for t in tasks][:2] == [first["id"], second["id"]]
    assert all(t["created_at"] for t in tasks)
    assert tasks[0]["submitted_by"] == me
    assert tasks[0]["submitted_by_name"] == tasks[0]["document"]["owner_name"]

    # A secretary submits on behalf of the owner: the audit row wins.
    secretary = User(
        email=f"sec-{uuid.uuid4().hex[:8]}@testministry.gov.cm",
        password_hash="x",
        first_name="Awa",
        last_name="Secretaire",
        matricule=f"SEC{uuid.uuid4().hex[:6]}",
        role_id=db_seed["role_id"],
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        is_active=True,
    )
    db_session.add(secretary)
    await db_session.flush()
    db_session.add(
        AuditLog(
            tenant_id=db_seed["tenant_id"],
            user_id=secretary.id,
            table_name="documents",
            record_id=uuid.UUID(second["id"]),
            action="workflow_started",
            new_data={},
        )
    )
    # Documents submitted before the audit existed fall back to their owner.
    await db_session.execute(
        delete(AuditLog).where(AuditLog.record_id == uuid.UUID(first["id"]))
    )
    await db_session.commit()

    tasks = {
        t["document_id"]: t
        for t in (await auth_client.get("/api/v1/workflows/pending")).json()
    }
    assert tasks[second["id"]]["submitted_by"] == str(secretary.id)
    assert tasks[second["id"]]["submitted_by_name"] == "Awa Secretaire"
    assert tasks[first["id"]]["submitted_by"] == me


@pytest.mark.asyncio
async def test_submission_is_audited(auth_client: AsyncClient, db_seed, db_session):
    doc = await _upload(auth_client, "Audit soumission")
    await _submit(auth_client, doc["id"], str(db_seed["user_id"]))
    row = (
        await db_session.execute(
            AuditLog.__table__.select().where(
                AuditLog.record_id == uuid.UUID(doc["id"]),
                AuditLog.action == "workflow_started",
            )
        )
    ).one()
    assert row.user_id == db_seed["user_id"]


@pytest.mark.asyncio
async def test_counters_follow_documents_and_tasks(auth_client: AsyncClient, db_seed):
    me = str(db_seed["user_id"])
    before = (await auth_client.get("/api/v1/workflows/my-counters")).json()

    returned = await _upload(auth_client, "Compteur retour")
    rejected = await _upload(auth_client, "Compteur rejet")
    waiting = await _upload(auth_client, "Compteur tache")
    for doc in (returned, rejected, waiting):
        await _submit(auth_client, doc["id"], me)
    await _act(auth_client, returned, "returned", "Motif")
    await _act(auth_client, rejected, "rejected", "Motif")

    after = (await auth_client.get("/api/v1/workflows/my-counters")).json()
    assert after["returned"] == before["returned"] + 1
    assert after["rejected"] == before["rejected"] + 1
    assert after["tasks"] == before["tasks"] + 1
    pending = (await auth_client.get("/api/v1/workflows/pending")).json()
    assert after["tasks"] == len(pending)
