"""Undo of a move: sending the previous classification back with the same
PATCH /documents/{id} restores where the document was filed, and every move
is audited as "reclassify" with the values before and after."""

import uuid

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.classification_activity import ClassificationActivity
from app.models.classification_domain import ClassificationDomain
from app.models.document import Document
from app.models.org_unit import OrgUnit

PLACEMENT = (
    "classification_domain_id",
    "classification_activity_id",
    "classification_year",
    "classification_scope",
    "classification_target_org_unit_id",
    "classification_target_user_id",
    "classification_status",
    "logical_space_path",
    "org_unit_id",
)
CLASSIFICATION_INPUT = PLACEMENT[:7]


def _domain_with_activity(tenant_id, code):
    domain = ClassificationDomain(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        code=code,
        name=code.title(),
        is_active=True,
    )
    activity = ClassificationActivity(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        domain_id=domain.id,
        code=f"{code}-act",
        name=f"{code.title()} activite",
        is_active=True,
    )
    return domain, activity


@pytest.fixture
async def two_places(db_session, db_seed):
    """A document in the seed unit, plus a second unit and two domains."""
    tenant_id = db_seed["tenant_id"]
    other_unit = OrgUnit(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        code=f"OU-{uuid.uuid4().hex[:8]}",
        name="Autre direction",
        level=1,
        is_active=True,
    )
    first, first_activity = _domain_with_activity(tenant_id, "marches")
    second, second_activity = _domain_with_activity(tenant_id, "budget")
    document = Document(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        org_unit_id=db_seed["org_unit_id"],
        owner_id=db_seed["user_id"],
        title="A deplacer",
        file_path="tenant/unit/move.pdf",
        status="draft",
        classification_status="pending",
    )
    for row in (other_unit, first, second):
        db_session.add(row)
    await db_session.flush()
    for row in (first_activity, second_activity, document):
        db_session.add(row)
    await db_session.commit()
    return {
        "document_id": document.id,
        "home": {
            "classification_domain_id": str(first.id),
            "classification_activity_id": str(first_activity.id),
            "classification_year": 2026,
            "classification_scope": "service",
            "classification_target_org_unit_id": str(db_seed["org_unit_id"]),
            "classification_status": "classified",
        },
        "elsewhere": {
            "classification_domain_id": str(second.id),
            "classification_activity_id": str(second_activity.id),
            "classification_year": 2025,
            "classification_scope": "directorate",
            "classification_target_org_unit_id": str(other_unit.id),
            "classification_status": "classified",
        },
        "other_unit_id": str(other_unit.id),
    }


def _placement(body):
    return {field: body[field] for field in PLACEMENT}


async def _reclassify_rows(db_session, document_id):
    result = await db_session.execute(
        select(AuditLog)
        .where(AuditLog.record_id == document_id, AuditLog.action == "reclassify")
        .order_by(AuditLog.created_at)
    )
    return result.scalars().all()


@pytest.mark.asyncio
async def test_sending_the_previous_classification_back_undoes_a_move(
    admin_client, db_session, two_places
):
    url = f"/api/v1/documents/{two_places['document_id']}"
    filed = await admin_client.patch(url, json=two_places["home"])
    assert filed.status_code == 200, filed.text
    before_move = _placement(filed.json())

    moved = await admin_client.patch(url, json=two_places["elsewhere"])
    assert moved.status_code == 200, moved.text
    assert moved.json()["org_unit_id"] == two_places["other_unit_id"]
    assert moved.json()["logical_space_path"] != before_move["logical_space_path"]

    undo = {field: before_move[field] for field in CLASSIFICATION_INPUT}
    undone = await admin_client.patch(url, json=undo)
    assert undone.status_code == 200, undone.text
    assert _placement(undone.json()) == before_move

    rows = await _reclassify_rows(db_session, two_places["document_id"])
    assert len(rows) == 3  # filing, move, undo
    move, undo_row = rows[1].new_data, rows[2].new_data
    assert move["after"]["org_unit_id"] == two_places["other_unit_id"]
    assert undo_row["before"] == move["after"]
    assert undo_row["after"] == move["before"]
    assert {field: undo_row["after"][field] for field in PLACEMENT} == before_move


@pytest.mark.asyncio
async def test_a_move_back_to_pending_restores_the_pending_place(
    admin_client, db_seed, two_places
):
    url = f"/api/v1/documents/{two_places['document_id']}"
    pending = await admin_client.patch(
        url,
        json={
            "classification_scope": "service",
            "classification_target_org_unit_id": str(db_seed["org_unit_id"]),
            "classification_status": "pending",
        },
    )
    assert pending.status_code == 200, pending.text
    before_move = _placement(pending.json())

    moved = await admin_client.patch(url, json=two_places["elsewhere"])
    assert moved.status_code == 200, moved.text

    undo = {field: before_move[field] for field in CLASSIFICATION_INPUT}
    undone = await admin_client.patch(url, json=undo)
    assert undone.status_code == 200, undone.text
    assert _placement(undone.json()) == before_move


@pytest.mark.asyncio
async def test_an_edit_that_does_not_move_is_not_audited_as_reclassify(
    admin_client, db_session, two_places
):
    response = await admin_client.patch(
        f"/api/v1/documents/{two_places['document_id']}",
        json={"title": "Nouveau titre"},
    )
    assert response.status_code == 200, response.text
    assert await _reclassify_rows(db_session, two_places["document_id"]) == []
