"""GET /workflows/inbox (unified validation queue) and the trash filter of /pending."""

import io
import uuid
from types import SimpleNamespace

import pytest
from httpx import AsyncClient
from sqlalchemy import func, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings, settings
from app.models.document import Document
from app.models.org_unit import OrgUnit
from app.models.workflow import WorkflowStep
from app.services import workflow_inbox

API = "/api/v1"
INBOX = f"{API}/workflows/inbox"


@pytest.fixture
def inbox_enabled(monkeypatch):
    monkeypatch.setattr(settings, "WORKFLOW_INBOX_ENABLED", True)


def _factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def _document_with_step(client: AsyncClient, db_seed, title: str) -> dict:
    """A document whose single step is current and assigned to the seeded user."""
    upload = await client.post(
        f"{API}/documents/upload",
        files={"file": (f"{title}.txt", io.BytesIO(title.encode()), "text/plain")},
        data={"title": title},  # no category: no automatic routing
    )
    assert upload.status_code == 201, upload.text
    document_id = upload.json()["id"]
    steps = await client.post(
        f"{API}/workflows/document/{document_id}/steps",
        json=[
            {
                "document_id": document_id,
                "step_order": 1,
                "label": "Visa",
                "assigned_to": str(db_seed["user_id"]),
                "expected_action_type": "visa",
            }
        ],
    )
    assert steps.status_code == 201, steps.text
    return {"document_id": document_id, "step_id": steps.json()[0]["id"]}


async def _set_step_status(test_engine, step_id: str, status: str) -> None:
    async with _factory(test_engine)() as session:
        await session.execute(
            update(WorkflowStep)
            .where(WorkflowStep.id == uuid.UUID(step_id))
            .values(status=status, assigned_to=None)
        )
        await session.commit()


async def _move_document(test_engine, document_id: str, org_unit_id) -> None:
    async with _factory(test_engine)() as session:
        await session.execute(
            update(Document)
            .where(Document.id == uuid.UUID(document_id))
            .values(org_unit_id=org_unit_id)
        )
        await session.commit()


def _ids(response) -> list[str]:
    assert response.status_code == 200, response.text
    return [row["document_id"] for row in response.json()]


# --- Switch -----------------------------------------------------------------


@pytest.mark.asyncio
async def test_inbox_is_off_by_default(auth_client: AsyncClient):
    assert Settings.model_fields["WORKFLOW_INBOX_ENABLED"].default is False
    assert Settings.model_fields["WORKFLOW_PENDING_EXCLUDE_TRASHED"].default is False
    assert (await auth_client.get(INBOX)).status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "params",
    [{"scope": "everyone"}, {"limit": 0}, {"limit": 201}, {"offset": -1}],
)
async def test_inbox_rejects_out_of_contract_parameters(
    auth_client: AsyncClient, inbox_enabled, params
):
    assert (await auth_client.get(INBOX, params=params)).status_code == 422


# --- scope=mine -------------------------------------------------------------


@pytest.mark.asyncio
async def test_mine_is_ordered_paginated_and_matches_pending(
    auth_client: AsyncClient, db_seed, inbox_enabled
):
    created = [
        (await _document_with_step(auth_client, db_seed, f"inbox-mine-{index}"))[
            "document_id"
        ]
        for index in range(3)
    ]

    everything = await auth_client.get(INBOX)
    first_page = await auth_client.get(INBOX, params={"limit": 2})
    second_page = await auth_client.get(INBOX, params={"limit": 2, "offset": 2})
    pending = await auth_client.get(f"{API}/workflows/pending")

    assert _ids(everything) == created
    assert everything.headers["X-Total-Count"] == "3"
    assert _ids(first_page) == created[:2]
    assert _ids(second_page) == created[2:]
    assert second_page.headers["X-Total-Count"] == "3"
    # Same rows, same order, same shape as the historical route.
    assert pending.json() == everything.json()
    row = everything.json()[0]
    assert row["document"]["title"] == "inbox-mine-0"
    assert row["document"]["owner_name"]
    assert row["document"]["current_version_id"]


@pytest.mark.asyncio
async def test_trashed_documents_leave_the_inbox_and_pending_follows_its_switch(
    auth_client: AsyncClient, db_seed, inbox_enabled, monkeypatch, db_session
):
    kept = (await _document_with_step(auth_client, db_seed, "inbox-kept"))[
        "document_id"
    ]
    trashed = (await _document_with_step(auth_client, db_seed, "inbox-trashed"))[
        "document_id"
    ]
    # A document under validation is not trashed through the API since #464 (an
    # administrator may still do it): mark it in the database.
    await db_session.execute(
        update(Document)
        .where(Document.id == uuid.UUID(trashed))
        .values(deleted_at=func.now())
    )
    await db_session.commit()

    assert _ids(await auth_client.get(INBOX)) == [kept]

    # Historical route: unchanged by default, filtered once the switch is on.
    monkeypatch.setattr(settings, "WORKFLOW_PENDING_EXCLUDE_TRASHED", False)
    assert _ids(await auth_client.get(f"{API}/workflows/pending")) == [kept, trashed]
    monkeypatch.setattr(settings, "WORKFLOW_PENDING_EXCLUDE_TRASHED", True)
    assert _ids(await auth_client.get(f"{API}/workflows/pending")) == [kept]


# --- scope=unit -------------------------------------------------------------


@pytest.mark.asyncio
async def test_collaborator_cannot_read_unit_nor_unassigned(
    auth_client: AsyncClient, inbox_enabled
):
    assert (await auth_client.get(INBOX, params={"scope": "unit"})).status_code == 403
    assert (
        await auth_client.get(INBOX, params={"scope": "unassigned"})
    ).status_code == 403


@pytest.mark.asyncio
async def test_unit_scope_is_the_own_unit_and_recursive_adds_child_units(
    client_as, db_seed, test_engine, inbox_enabled
):
    child_unit, other_unit = uuid.uuid4(), uuid.uuid4()
    async with _factory(test_engine)() as session:
        session.add_all(
            [
                OrgUnit(
                    id=child_unit,
                    tenant_id=db_seed["tenant_id"],
                    parent_id=db_seed["org_unit_id"],
                    code="SVC-CHILD",
                    name="Service fils",
                    level=2,
                    is_active=True,
                ),
                OrgUnit(
                    id=other_unit,
                    tenant_id=db_seed["tenant_id"],
                    code="DIR-OTHER",
                    name="Autre direction",
                    level=1,
                    is_active=True,
                ),
            ]
        )
        await session.commit()

    seeded = {
        "id": db_seed["user_id"],
        "tenant_id": db_seed["tenant_id"],
        "org_unit_id": db_seed["org_unit_id"],
    }
    async with client_as("super_admin", **seeded) as admin:
        own = (await _document_with_step(admin, db_seed, "inbox-unit-own"))[
            "document_id"
        ]
        child = (await _document_with_step(admin, db_seed, "inbox-unit-child"))[
            "document_id"
        ]
        other = (await _document_with_step(admin, db_seed, "inbox-unit-other"))[
            "document_id"
        ]
    await _move_document(test_engine, own, db_seed["org_unit_id"])
    await _move_document(test_engine, child, child_unit)
    await _move_document(test_engine, other, other_unit)

    async with client_as("manager", **seeded) as manager:
        unit_only = await manager.get(INBOX, params={"scope": "unit"})
        with_children = await manager.get(
            INBOX, params={"scope": "unit", "recursive": "true"}
        )
    async with client_as("manager", **{**seeded, "org_unit_id": None}) as detached:
        no_unit = await detached.get(INBOX, params={"scope": "unit"})

    assert _ids(unit_only) == [own]
    assert unit_only.headers["X-Total-Count"] == "1"
    assert _ids(with_children) == [own, child]
    assert no_unit.status_code == 403


# --- scope=unassigned -------------------------------------------------------


@pytest.mark.asyncio
async def test_unassigned_lists_steps_waiting_for_an_assignee(
    admin_client: AsyncClient, db_seed, test_engine, inbox_enabled
):
    assigned = await _document_with_step(admin_client, db_seed, "inbox-assigned")
    orphan = await _document_with_step(admin_client, db_seed, "inbox-orphan")
    await _set_step_status(test_engine, orphan["step_id"], "pending_assignment")

    unassigned = await admin_client.get(INBOX, params={"scope": "unassigned"})
    historical = await admin_client.get(f"{API}/workflows/pending-assignments")

    assert _ids(unassigned) == [orphan["document_id"]]
    assert unassigned.json()[0]["assignment_error"] is None
    assert _ids(historical) == [orphan["document_id"]]
    assert _ids(await admin_client.get(INBOX)) == [assigned["document_id"]]


@pytest.mark.asyncio
async def test_another_institution_sees_nothing(
    client_as, db_seed, test_engine, inbox_enabled
):
    async with client_as(
        "super_admin",
        id=db_seed["user_id"],
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as owner:
        orphan = await _document_with_step(owner, db_seed, "inbox-foreign")
    await _set_step_status(test_engine, orphan["step_id"], "pending_assignment")

    async with client_as(
        "super_admin", id=db_seed["user_id"], tenant_id=uuid.uuid4()
    ) as stranger:
        responses = [
            await stranger.get(INBOX, params={"scope": scope})
            for scope in ("mine", "unassigned")
        ]

    for response in responses:
        assert _ids(response) == []
        assert response.headers["X-Total-Count"] == "0"


# --- Serialization helpers --------------------------------------------------


def test_owner_display_name_falls_back_to_the_matricule():
    named = SimpleNamespace(first_name="Awa", last_name=None, matricule="M1")
    bare = SimpleNamespace(first_name=None, last_name=None, matricule="M2")

    assert workflow_inbox.owner_display_name(named) == "Awa"
    assert workflow_inbox.owner_display_name(bare) == "M2"
    assert workflow_inbox.owner_display_name(None) is None


def test_assignment_error_prefers_the_step_error_then_the_explanation():
    step = SimpleNamespace(label="Visa")
    with_step_error = SimpleNamespace(
        resolved_steps_summary=[
            {"label": "Autre", "error": "ignored"},
            {"label": "Visa", "error": "aucun responsable"},
        ],
        explanation="routage partiel",
    )
    explanation_only = SimpleNamespace(
        resolved_steps_summary=[{"label": "Visa"}], explanation="routage partiel"
    )
    empty = SimpleNamespace(resolved_steps_summary=None, explanation="sans objet")

    assert workflow_inbox.assignment_error_for(step, [with_step_error]) == (
        "aucun responsable"
    )
    assert workflow_inbox.assignment_error_for(step, [explanation_only]) == (
        "routage partiel"
    )
    assert workflow_inbox.assignment_error_for(step, [empty]) is None
    assert workflow_inbox.assignment_error_for(step, []) is None
