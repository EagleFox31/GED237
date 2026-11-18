"""Lecture d'un document par l'assigné d'une étape de circuit (hors de son unité).

Le valideur doit pouvoir ouvrir le document de sa tâche avant de décider ; l'accès est
en lecture seule, réservé à l'assigné d'une étape en cours ou déjà traitée, et un manager
non assigné hors de son unité n'apprend rien (404 sur l'aperçu, règle du périmètre).
"""

import uuid

import pytest

from app.models.document import Document
from app.models.workflow import WorkflowStep

DOCUMENTS = "/api/v1/documents"


async def _document_with_step(db_session, db_seed, step_status):
    document = Document(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        owner_id=db_seed["user_id"],
        title="Note à valider",
        file_path=f"tenant/unit/{uuid.uuid4()}.pdf",
        file_type="pdf",
        mime_type="application/pdf",
        file_size=128,
        document_category_id=db_seed["category_id"],
        processing_mode="archive",
        status="in_review",
        classification_status="classified",
    )
    db_session.add(document)
    await db_session.flush()
    db_session.add(
        WorkflowStep(
            document_id=document.id,
            step_order=1,
            label="Visa",
            status=step_status,
            assigned_to=db_seed["user_id"],
        )
    )
    await db_session.commit()
    return document.id


def _manager(db_seed, *, assigned: bool):
    """Manager d'une autre unité que celle du document."""
    fields = {"tenant_id": db_seed["tenant_id"], "org_unit_id": uuid.uuid4()}
    if assigned:
        fields["id"] = db_seed["user_id"]
    return fields


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "step_status", ["current", "completed", "rejected", "returned"]
)
async def test_assigned_manager_reads_document_outside_unit(
    client_as, db_session, db_seed, step_status
):
    doc_id = await _document_with_step(db_session, db_seed, step_status)
    async with client_as("manager", **_manager(db_seed, assigned=True)) as client:
        assert (await client.get(f"{DOCUMENTS}/{doc_id}")).status_code == 200
        assert (await client.get(f"{DOCUMENTS}/{doc_id}/versions")).status_code == 200


@pytest.mark.asyncio
@pytest.mark.parametrize("step_status", ["pending", "cancelled", "pending_assignment"])
async def test_step_not_reached_or_cancelled_opens_nothing(
    client_as, db_session, db_seed, step_status
):
    doc_id = await _document_with_step(db_session, db_seed, step_status)
    async with client_as("manager", **_manager(db_seed, assigned=True)) as client:
        assert (await client.get(f"{DOCUMENTS}/{doc_id}")).status_code == 403


@pytest.mark.asyncio
async def test_unassigned_manager_outside_unit_is_refused(
    client_as, db_session, db_seed
):
    doc_id = await _document_with_step(db_session, db_seed, "current")
    async with client_as("manager", **_manager(db_seed, assigned=False)) as client:
        assert (await client.get(f"{DOCUMENTS}/{doc_id}")).status_code == 403
        assert (await client.get(f"{DOCUMENTS}/{doc_id}/content")).status_code == 404


@pytest.mark.asyncio
async def test_step_access_is_read_only(client_as, db_session, db_seed):
    doc_id = await _document_with_step(db_session, db_seed, "current")
    async with client_as("manager", **_manager(db_seed, assigned=True)) as client:
        assert (
            await client.patch(f"{DOCUMENTS}/{doc_id}", json={"title": "x"})
        ).status_code in (403, 404)
        assert (await client.post(f"{DOCUMENTS}/{doc_id}/trash")).status_code in (
            403,
            404,
        )
        assert (await client.get(f"{DOCUMENTS}/{doc_id}/audit-logs")).status_code == 403
