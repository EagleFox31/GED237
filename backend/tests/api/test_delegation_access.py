"""What a stand-in may do during an absence (DEC-2026-007).

Only while the delegation is active: see the absent agent's current tasks,
read their documents, act on them, logged « par X au nom de Y ». Nothing more.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.delegation import Delegation
from app.models.document import Document
from app.models.workflow import ActionType, WorkflowStep

DOCUMENTS = "/api/v1/documents"
PENDING = "/api/v1/workflows/pending"

H = timedelta(hours=1)


def _period(state: str) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "active": {"starts_at": now - H, "ends_at": now + H},
        "ended": {"starts_at": now - 2 * H, "ends_at": now - H},
        "scheduled": {"starts_at": now + H, "ends_at": now + 2 * H},
        "revoked": {
            "starts_at": now - H,
            "ends_at": now + H,
            "revoked_at": now - timedelta(minutes=1),
        },
    }[state]


async def _delegate(db_session, world, delegator, delegate, state="active", **extra):
    users = world["users"]
    row = Delegation(
        tenant_id=extra.pop("tenant_id", world["tenant_id"]),
        org_unit_id=world["units"]["u"],
        delegator_id=users[delegator].id,
        delegate_id=users[delegate].id,
        created_by=users["manager_u"].id,
        **_period(state),
    )
    db_session.add(row)
    await db_session.commit()
    return row


def _visa(world) -> dict:
    return {
        "action_type": "visa",
        "outcome": "accepted",
        "document_version_id": str(world["version_id"]),
    }


async def _act(client, world):
    return await client.post(
        f"/api/v1/workflows/step/{world['step_id']}/actions", json=_visa(world)
    )


@pytest.fixture(params=["collaborator_same_unit", "manager_other_unit"])
def standin(request, delegation_world):
    """The stand-in: a colleague of the same service, or a manager of another one
    (forged in base: the API refuses it, the read path must still hold)."""
    return "standin" if request.param == "collaborator_same_unit" else "manager_v"


@pytest.mark.asyncio
async def test_active_delegation_opens_the_task(
    db_session, delegation_world, as_agent, standin
):
    world = delegation_world
    await _delegate(db_session, world, "absent", standin)
    async with as_agent(standin) as client:
        tasks = (await client.get(PENDING)).json()
        assert [t["id"] for t in tasks] == [str(world["step_id"])]
        assert tasks[0]["assigned_to"] == str(world["users"]["absent"].id)
        doc_id = world["document_id"]
        assert (await client.get(f"{DOCUMENTS}/{doc_id}")).status_code == 200
        assert (await client.get(f"{DOCUMENTS}/{doc_id}/versions")).status_code == 200
        response = await _act(client, world)
    assert response.status_code == 200, response.text


@pytest.mark.asyncio
@pytest.mark.parametrize("state", ["ended", "scheduled", "revoked"])
async def test_inactive_delegation_opens_nothing(
    db_session, delegation_world, as_agent, standin, state
):
    world = delegation_world
    await _delegate(db_session, world, "absent", standin, state)
    async with as_agent(standin) as client:
        assert (await client.get(PENDING)).json() == []
        doc = await client.get(f"{DOCUMENTS}/{world['document_id']}")
        assert doc.status_code in (403, 404)
        assert (await _act(client, world)).status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("step_status", ["pending", "completed", None])
async def test_only_the_current_step_is_shared(
    db_session, delegation_world, as_agent, step_status
):
    """A step not yet reached, an already handled one, or a document without a
    step of the absent agent gives the stand-in nothing."""
    world = delegation_world
    step = await db_session.get(WorkflowStep, world["step_id"])
    if step_status is None:
        await db_session.delete(step)
    else:
        step.status = step_status
    await db_session.commit()
    await _delegate(db_session, world, "absent", "standin")
    async with as_agent("standin") as client:
        assert (await client.get(PENDING)).json() == []
        doc = await client.get(f"{DOCUMENTS}/{world['document_id']}")
        assert doc.status_code in (403, 404)


@pytest.mark.asyncio
async def test_no_redelegation(db_session, delegation_world, as_agent):
    """absent → standin and standin → third: third sees nothing of absent."""
    world = delegation_world
    await _delegate(db_session, world, "absent", "standin")
    await _delegate(db_session, world, "standin", "third")
    async with as_agent("third") as client:
        assert (await client.get(PENDING)).json() == []
        doc = await client.get(f"{DOCUMENTS}/{world['document_id']}")
        assert doc.status_code in (403, 404)
        assert (await _act(client, world)).status_code == 403


@pytest.mark.asyncio
async def test_forged_cross_institution_delegation_gives_nothing(
    db_session, delegation_world, as_agent
):
    world = delegation_world
    await _delegate(db_session, world, "absent", "foreign")
    async with as_agent("foreign") as client:
        assert (await client.get(PENDING)).json() == []
        assert (
            await client.get(f"{DOCUMENTS}/{world['document_id']}")
        ).status_code == 404
        assert (await _act(client, world)).status_code == 404


async def _circuit_audit(db_session, world) -> list[AuditLog]:
    return list(
        (
            await db_session.execute(
                select(AuditLog).where(
                    AuditLog.table_name == "documents",
                    AuditLog.record_id == world["document_id"],
                    AuditLog.action == "workflow_approved",
                )
            )
        )
        .scalars()
        .all()
    )


@pytest.mark.asyncio
async def test_stand_in_action_is_logged_on_behalf_of(
    db_session, delegation_world, as_agent
):
    world = delegation_world
    users = world["users"]
    await _delegate(db_session, world, "absent", "standin")
    async with as_agent("standin") as client:
        assert (await _act(client, world)).status_code == 200

    [row] = await _circuit_audit(db_session, world)
    assert row.user_id == users["standin"].id
    assert row.on_behalf_of == users["absent"].id
    assert row.new_data["on_behalf_of_name"] == "Awa Absente"

    async with as_agent("admin") as client:
        logs = (await client.get("/api/v1/audit/logs?table_name=documents")).json()
    entry = next(e for e in logs if e["action"] == "workflow_approved")
    assert entry["user_name"] == "Paul Interim"
    assert entry["on_behalf_of"] == str(users["absent"].id)
    assert entry["on_behalf_of_name"] == "Awa Absente"

    # Filtering on either agent finds the action: the absent agent's journal
    # includes what was done on their behalf (the export takes ``user_id``).
    async with as_agent("admin") as client:
        for name in ("absent", "standin"):
            response = await client.get(
                "/api/v1/audit/logs/export",
                params={"table_name": "documents", "user_id": str(users[name].id)},
            )
            assert response.status_code == 200, response.text
            assert len(_csv_rows(response)) == 1, name
            assert "(au nom de Awa Absente)" in response.text, name


def _csv_rows(response) -> list[str]:
    """Data lines of an audit CSV export (header dropped)."""
    return response.text.lstrip("﻿").strip().split("\r\n")[1:]


@pytest.mark.asyncio
async def test_on_behalf_filter_on_list_and_export(
    db_session, delegation_world, as_agent
):
    """``on_behalf=true`` keeps only stand-in actions, on the list and the CSV."""
    world = delegation_world
    users = world["users"]
    await _delegate(db_session, world, "absent", "standin")
    async with as_agent("standin") as client:
        assert (await _act(client, world)).status_code == 200
    db_session.add(
        AuditLog(
            tenant_id=world["tenant_id"],
            user_id=users["absent"].id,
            table_name="documents",
            record_id=world["document_id"],
            action="viewed",
        )
    )
    await db_session.commit()

    params = {"table_name": "documents"}
    async with as_agent("admin") as client:
        everything = (await client.get("/api/v1/audit/logs", params=params)).json()
        delegated = (
            await client.get("/api/v1/audit/logs", params={**params, "on_behalf": True})
        ).json()
        full_csv = await client.get("/api/v1/audit/logs/export", params=params)
        delegated_csv = await client.get(
            "/api/v1/audit/logs/export", params={**params, "on_behalf": "true"}
        )

    assert {e["action"] for e in everything} == {"workflow_approved", "viewed"}
    assert [e["action"] for e in delegated] == ["workflow_approved"]
    assert len(_csv_rows(full_csv)) == 2
    [row] = _csv_rows(delegated_csv)
    assert "(au nom de Awa Absente)" in row
    exported = (
        (
            await db_session.execute(
                select(AuditLog)
                .where(AuditLog.action == "exported")
                .order_by(AuditLog.created_at.desc())
            )
        )
        .scalars()
        .first()
    )
    assert exported.new_data["filters"]["on_behalf"] is True


@pytest.mark.asyncio
async def test_stand_in_whose_role_changed_can_no_longer_act(
    db_session, delegation_world, client_as
):
    """The role is checked at designation and again at each action."""
    world = delegation_world
    await _delegate(db_session, world, "absent", "standin")
    standin = world["users"]["standin"]
    async with client_as(
        "reader",
        id=standin.id,
        tenant_id=standin.tenant_id,
        org_unit_id=standin.org_unit_id,
    ) as client:
        assert (await _act(client, world)).status_code == 403
    assert await _circuit_audit(db_session, world) == []


@pytest.mark.asyncio
async def test_assignee_action_is_not_on_behalf_of(
    db_session, delegation_world, as_agent
):
    world = delegation_world
    await _delegate(db_session, world, "absent", "standin")
    async with as_agent("absent") as client:
        assert (await _act(client, world)).status_code == 200
    [row] = await _circuit_audit(db_session, world)
    assert row.user_id == world["users"]["absent"].id
    assert row.on_behalf_of is None


@pytest.mark.asyncio
async def test_second_decision_on_the_same_step_is_refused(
    db_session, delegation_world, as_agent
):
    """The stand-in decided first: the returning assignee gets 400, not a
    second decision."""
    world = delegation_world
    await _delegate(db_session, world, "absent", "standin")
    async with as_agent("standin") as client:
        assert (await _act(client, world)).status_code == 200
    async with as_agent("absent") as client:
        assert (await _act(client, world)).status_code == 400
    assert len(await _circuit_audit(db_session, world)) == 1


@pytest.mark.asyncio
async def test_next_step_notifies_the_active_stand_in(
    db_session, delegation_world, test_engine, monkeypatch
):
    """A new step assigned to the absent agent reaches the stand-in too."""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    from app.models.notification import Notification
    from app.services.notifications import listeners

    monkeypatch.setattr(
        listeners,
        "async_session_maker",
        async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False),
    )
    world = delegation_world
    users = world["users"]
    await _delegate(db_session, world, "absent", "standin")
    await _delegate(db_session, world, "third", "manager_u", "ended")

    for absent in ("absent", "third"):
        await listeners.on_workflow_assigned(
            {
                "user_id": str(users[absent].id),
                "tenant_id": str(world["tenant_id"]),
                "document_title": "Note à viser",
                "step_name": "Visa",
            }
        )

    rows = (
        (
            await db_session.execute(
                select(Notification).where(
                    Notification.event_type == "WORKFLOW_ASSIGNED"
                )
            )
        )
        .scalars()
        .all()
    )
    by_user = {}
    for row in rows:
        by_user.setdefault(row.user_id, []).append(row)
    assert set(by_user) == {users["absent"].id, users["standin"].id, users["third"].id}
    [standin_note] = by_user[users["standin"].id]
    assert standin_note.message.startswith("Au nom de Awa Absente")
    # Ended delegation: no notification to manager_u.
    assert users["manager_u"].id not in by_user


@pytest.mark.asyncio
async def test_document_of_another_step_of_the_absent_agent_stays_closed(
    db_session, delegation_world, as_agent
):
    """The delegation opens the absent agent's tasks, not their whole drawer."""
    world = delegation_world
    other = Document(
        id=uuid.uuid4(),
        tenant_id=world["tenant_id"],
        org_unit_id=world["units"]["u"],
        owner_id=world["users"]["absent"].id,
        title="Brouillon personnel",
        file_path=f"tenant/unit/{uuid.uuid4()}.pdf",
        file_type="pdf",
        mime_type="application/pdf",
        file_size=64,
        document_category_id=world["category_id"],
        processing_mode="archive",
        status="draft",
        classification_status="classified",
    )
    db_session.add(other)
    await db_session.flush()
    db_session.add(
        WorkflowStep(
            document_id=other.id,
            step_order=1,
            label="Visa",
            status="completed",
            assigned_to=world["users"]["absent"].id,
            expected_action_type=ActionType.visa,
        )
    )
    await db_session.commit()
    await _delegate(db_session, world, "absent", "standin")
    async with as_agent("standin") as client:
        assert (await client.get(f"{DOCUMENTS}/{other.id}")).status_code in (403, 404)
