"""Workflow outcomes reach the depositor: persisted, then pushed on the WebSocket."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.workflow import OutcomeType
from app.services.notifications import listeners
from app.services.workflow_service import SubmitWorkflowActionUseCase

TENANT = str(uuid.uuid4())
OWNER = str(uuid.uuid4())
ACTOR = str(uuid.uuid4())


def _payload(**extra):
    base = {
        "tenant_id": TENANT,
        "document_id": str(uuid.uuid4()),
        "document_title": "Budget",
        "owner_id": OWNER,
        "actor_id": ACTOR,
        "step_name": "Visa DAF",
        "comment": None,
    }
    base.update(extra)
    return base


@pytest.fixture
def wired(monkeypatch):
    saved, pushed = [], []

    class FakeNotifier:
        async def send(self, **kwargs):
            saved.append(kwargs)
            return True

    class FakeSession:
        async def __aenter__(self):
            return object()

        async def __aexit__(self, *exc):
            return False

    monkeypatch.setattr(
        listeners.NotificationFactory, "get_notifier", lambda _k: FakeNotifier()
    )
    monkeypatch.setattr(listeners, "async_session_maker", lambda: FakeSession())

    async def fake_push(message, user_id):
        pushed.append((user_id, message))

    # The live push belongs to the in-app notifier (PR #155); the listeners must
    # not push a second, id-less copy.
    monkeypatch.setattr(
        "app.api.v1.endpoints.notifications.manager.send_personal_message",
        fake_push,
    )
    return saved, pushed


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "listener,event_type",
    [
        (listeners.on_workflow_completed, "WORKFLOW_COMPLETED"),
        (listeners.on_workflow_step_accepted, "WORKFLOW_STEP_ACCEPTED"),
        (listeners.on_workflow_rejected, "WORKFLOW_REJECTED"),
        (listeners.on_workflow_returned, "WORKFLOW_RETURNED"),
    ],
)
async def test_depositor_notification_is_saved_once(wired, listener, event_type):
    saved, pushed = wired
    await listener(_payload())

    (sent,) = saved
    assert sent["user_id"] == OWNER and sent["event_type"] == event_type
    assert sent["tenant_id"] == TENANT
    assert "Budget" in sent["message"]
    assert sent["meta_data"]["document_id"]
    assert pushed == []


@pytest.mark.asyncio
async def test_assignee_is_notified(wired):
    saved, pushed = wired
    assignee = str(uuid.uuid4())
    await listeners.on_workflow_assigned(
        {
            "user_id": assignee,
            "tenant_id": TENANT,
            "document_title": "Budget",
            "step_name": "Visa DG",
        }
    )
    assert saved[0]["user_id"] == assignee and pushed == []


@pytest.mark.asyncio
async def test_no_notification_when_depositor_acts_on_own_document(wired):
    saved, pushed = wired
    await listeners.on_workflow_completed(_payload(actor_id=OWNER))
    assert saved == [] and pushed == []


@pytest.mark.asyncio
async def test_no_owner_means_no_notification(wired):
    saved, pushed = wired
    await listeners.on_workflow_rejected(_payload(owner_id=None))
    assert saved == [] and pushed == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "listener", [listeners.on_workflow_rejected, listeners.on_workflow_returned]
)
async def test_reason_is_kept_on_one_line_and_cut(wired, listener):
    saved, _ = wired
    await listener(_payload(comment="  Pièce\n manquante  "))
    assert saved[0]["message"].endswith("Motif : Pièce manquante")

    await listener(_payload(comment="x" * 500))
    reason = saved[1]["message"].split("Motif : ", 1)[1]
    assert len(reason) == listeners.REASON_MAX_LENGTH and reason.endswith("…")


@pytest.mark.asyncio
async def test_visa_message_carries_no_reason(wired):
    saved, _ = wired
    await listeners.on_workflow_completed(_payload(comment="RAS"))
    assert "Motif" not in saved[0]["message"]


def _scalar(value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


async def _run(outcome, next_step):
    tenant = uuid.uuid4()
    owner = uuid.uuid4()
    step = SimpleNamespace(
        id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        step_order=1,
        status="current",
        label="Visa DAF",
        comment=None,
        completed_at=None,
    )
    document = SimpleNamespace(
        id=step.document_id,
        tenant_id=tenant,
        owner_id=owner,
        title="Budget",
        status="in_review",
    )
    actor = SimpleNamespace(id=uuid.uuid4(), tenant_id=tenant)
    action = SimpleNamespace(
        action_type="validate",
        outcome=outcome,
        document_version_id=uuid.uuid4(),
        comment="ok",
    )
    db = MagicMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    pending = MagicMock()
    pending.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(
        side_effect=[_scalar(step), _scalar(document), _scalar(next_step), pending]
    )
    policy = MagicMock()
    policy.check_can_perform_action = AsyncMock()
    dispatcher = MagicMock()
    dispatcher.dispatch = AsyncMock()

    await SubmitWorkflowActionUseCase(policy, dispatcher).execute(
        step_id=step.id, action=action, actor=actor, db=db
    )
    return [c.args for c in dispatcher.dispatch.await_args_list], owner


@pytest.mark.asyncio
async def test_final_visa_emits_workflow_completed():
    calls, owner = await _run(OutcomeType.accepted, None)
    ((event, payload),) = calls
    assert event == "WORKFLOW_COMPLETED"
    assert payload["owner_id"] == str(owner)
    assert payload["status"] == "validated"


@pytest.mark.asyncio
async def test_intermediate_visa_notifies_assignee_and_depositor():
    nxt = SimpleNamespace(status="pending", assigned_to=uuid.uuid4(), label="Visa DG")
    calls, _ = await _run(OutcomeType.accepted, nxt)
    assert [c[0] for c in calls] == ["WORKFLOW_ASSIGNED", "WORKFLOW_STEP_ACCEPTED"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "outcome,event",
    [
        (OutcomeType.rejected, "WORKFLOW_REJECTED"),
        (OutcomeType.returned, "WORKFLOW_RETURNED"),
    ],
)
async def test_rejection_and_return_emit_their_event(outcome, event):
    calls, _ = await _run(outcome, None)
    assert [c[0] for c in calls] == [event]
    assert calls[0][1]["comment"] == "ok"
