"""L12-5 (V1.1): reassign a step in progress when its validator is unexpectedly absent.

The planned absence is covered by delegation (DEC-2026-007); here an assigner moves
the task itself to another validator. ``delegation_world`` provides a document whose
current step is assigned to ``absent``.
"""

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.workflow import WorkflowStep


def _url(world) -> str:
    return f"/api/v1/workflows/steps/{world['step_id']}/assign"


async def _reassign_rows(db_session, world):
    return (
        (
            await db_session.execute(
                select(AuditLog).where(
                    AuditLog.record_id == world["document_id"],
                    AuditLog.action == "workflow_reassigned",
                )
            )
        )
        .scalars()
        .all()
    )


@pytest.fixture
def dispatched(monkeypatch):
    """Events sent by the workflow endpoints, without running the notifiers."""
    from app.api.v1.endpoints import workflows

    events: list[tuple[str, dict]] = []

    async def _record(event, payload):
        events.append((event, payload))

    monkeypatch.setattr(workflows.dispatcher, "dispatch", _record)
    return events


@pytest.mark.asyncio
async def test_admin_reassigns_a_step_in_progress(
    as_agent, delegation_world, db_session, dispatched
):
    world = delegation_world
    users = world["users"]

    async with as_agent("admin") as admin:
        resp = await admin.post(
            _url(world), json={"assigned_to": str(users["standin"].id)}
        )

    assert resp.status_code == 200, resp.text
    assert resp.json()["assigned_to"] == str(users["standin"].id)
    assert (
        resp.json()["status"] == "current"
    ), "a reassignment keeps the step in progress"

    rows = await _reassign_rows(db_session, world)
    assert len(rows) == 1
    row = rows[0]
    assert row.user_id == users["admin"].id
    assert row.new_data["previous_assignee_id"] == str(users["absent"].id)
    assert row.new_data["previous_assignee_name"] == users["absent"].full_name
    assert row.new_data["new_assignee_id"] == str(users["standin"].id)
    assert row.new_data["new_assignee_name"] == users["standin"].full_name
    assert row.new_data["step_label"] == "Visa"

    assert dispatched == [
        (
            "WORKFLOW_ASSIGNED",
            {
                "user_id": str(users["standin"].id),
                "tenant_id": str(world["tenant_id"]),
                "document_title": "Note à viser",
                "step_name": "Visa",
            },
        )
    ], "only the new validator is notified"


@pytest.mark.asyncio
async def test_task_moves_to_the_new_validator(as_agent, delegation_world, dispatched):
    world = delegation_world

    async with as_agent("manager_u") as manager:
        resp = await manager.post(
            _url(world), json={"assigned_to": str(world["users"]["third"].id)}
        )
    assert resp.status_code == 200, resp.text

    async with as_agent("third") as third:
        mine = (await third.get("/api/v1/workflows/pending")).json()
    async with as_agent("absent") as absent:
        theirs = (await absent.get("/api/v1/workflows/pending")).json()

    assert str(world["step_id"]) in {task["id"] for task in mine}
    assert str(world["step_id"]) not in {task["id"] for task in theirs}


@pytest.mark.asyncio
async def test_same_validator_is_a_no_op(
    as_agent, delegation_world, db_session, dispatched
):
    world = delegation_world

    async with as_agent("admin") as admin:
        resp = await admin.post(
            _url(world), json={"assigned_to": str(world["users"]["absent"].id)}
        )

    assert resp.status_code == 200, resp.text
    assert await _reassign_rows(db_session, world) == []
    assert dispatched == []


@pytest.mark.asyncio
async def test_a_done_step_cannot_be_reassigned(
    as_agent, delegation_world, db_session, dispatched
):
    world = delegation_world
    step = await db_session.get(WorkflowStep, world["step_id"])
    step.status = "completed"
    await db_session.commit()

    async with as_agent("admin") as admin:
        resp = await admin.post(
            _url(world), json={"assigned_to": str(world["users"]["standin"].id)}
        )

    assert resp.status_code == 400
    assert "déjà traitée" in resp.json()["detail"]
    assert dispatched == []


@pytest.mark.asyncio
@pytest.mark.parametrize("target", ["inactive", "foreign"])
async def test_target_must_be_an_active_agent_of_the_tenant(
    as_agent, delegation_world, db_session, dispatched, target
):
    world = delegation_world

    async with as_agent("admin") as admin:
        resp = await admin.post(
            _url(world), json={"assigned_to": str(world["users"][target].id)}
        )

    assert resp.status_code == 400
    assert await _reassign_rows(db_session, world) == []


@pytest.mark.asyncio
@pytest.mark.parametrize("agent", ["standin", "reader"])
async def test_only_assigners_may_reassign(
    as_agent, delegation_world, dispatched, agent
):
    world = delegation_world

    async with as_agent(agent) as client:
        resp = await client.post(
            _url(world), json={"assigned_to": str(world["users"]["third"].id)}
        )

    assert resp.status_code == 403
