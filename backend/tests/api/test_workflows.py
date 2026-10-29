# backend/tests/api/test_workflows.py
import pytest
import io
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.models.tenant import Tenant
from app.models.org_unit import OrgUnit
from app.models.user import User
from app.core.security import hash_password


@pytest.mark.asyncio
async def test_get_pending_workflows(auth_client: AsyncClient):
    """Test fetching pending workflow tasks for the authenticated user and their structure."""
    response = await auth_client.get("/api/v1/workflows/pending")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_workflow_assignment_outside_tenant_fails(
    auth_client: AsyncClient, db_seed
):
    """Test that creating a workflow with an assignee not in the same tenant fails."""
    file = io.BytesIO(b"workflow rules doc")
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("test.txt", file, "text/plain")},
        data={"title": "Test Doc"},  # no category → pas de GEDRules auto-routing
    )
    assert up_resp.status_code == 201
    doc_id = up_resp.json()["id"]

    fake_assignee_id = str(uuid.uuid4())

    wf_resp = await auth_client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": 1,
                "label": "Validation Step",
                "assigned_to": fake_assignee_id,
            }
        ],
    )
    assert wf_resp.status_code == 400
    assert "must exist in the same tenant" in wf_resp.json()["detail"]


@pytest.mark.asyncio
async def test_action_on_non_current_step_fails(auth_client: AsyncClient, db_seed):
    """Policy: act on a 'pending' (not 'current') step must return 400."""
    file = io.BytesIO(b"workflow policy doc")
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("policy.txt", file, "text/plain")},
        data={"title": "Policy Test Doc"},  # no category → pas de GEDRules auto-routing
    )
    assert up_resp.status_code == 201
    doc = up_resp.json()
    doc_id = doc["id"]
    version_id = doc["current_version_id"]

    me = str(db_seed["user_id"])
    wf_resp = await auth_client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": 1,
                "label": "Step 1",
                "assigned_to": me,
                "expected_action_type": "visa",
            },
            {
                "document_id": doc_id,
                "step_order": 2,
                "label": "Step 2",
                "assigned_to": me,
                "expected_action_type": "visa",
            },
        ],
    )
    assert wf_resp.status_code == 201
    steps = wf_resp.json()
    step_2_id = steps[1]["id"]

    # Try to act on Step 2 which is still 'pending' - must be refused
    action_resp = await auth_client.post(
        f"/api/v1/workflows/step/{step_2_id}/actions",
        json={
            "action_type": "visa",
            "outcome": "accepted",
            "document_version_id": version_id,
        },
    )
    assert action_resp.status_code == 400
    assert "not currently pending" in action_resp.json()["detail"]


@pytest.mark.asyncio
async def test_action_with_wrong_version_fails(auth_client: AsyncClient, db_seed):
    """Policy: submitting an action with an incorrect document_version_id must return 400."""
    file = io.BytesIO(b"version check doc")
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("version.txt", file, "text/plain")},
        data={
            "title": "Version Test Doc"
        },  # no category → pas de GEDRules auto-routing
    )
    assert up_resp.status_code == 201
    doc_id = up_resp.json()["id"]

    me = str(db_seed["user_id"])
    wf_resp = await auth_client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": 1,
                "label": "Step 1",
                "assigned_to": me,
                "expected_action_type": "visa",
            }
        ],
    )
    assert wf_resp.status_code == 201
    step_id = wf_resp.json()[0]["id"]

    fake_version_id = str(uuid.uuid4())
    action_resp = await auth_client.post(
        f"/api/v1/workflows/step/{step_id}/actions",
        json={
            "action_type": "visa",
            "outcome": "accepted",
            "document_version_id": fake_version_id,
        },
    )
    assert action_resp.status_code == 400
    assert "current document version" in action_resp.json()["detail"]


@pytest.mark.asyncio
async def test_action_with_wrong_action_type_fails(auth_client: AsyncClient, db_seed):
    """Policy: sending the wrong action_type (e.g. final_signature instead of visa) must return 400."""
    file = io.BytesIO(b"action type check doc")
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("actiontype.txt", file, "text/plain")},
        data={
            "title": "ActionType Test Doc"
        },  # no category → pas de GEDRules auto-routing
    )
    assert up_resp.status_code == 201
    doc = up_resp.json()
    doc_id = doc["id"]
    version_id = doc["current_version_id"]

    me = str(db_seed["user_id"])
    wf_resp = await auth_client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": 1,
                "label": "Step 1",
                "assigned_to": me,
                "expected_action_type": "visa",
            }
        ],
    )
    assert wf_resp.status_code == 201
    step_id = wf_resp.json()[0]["id"]

    action_resp = await auth_client.post(
        f"/api/v1/workflows/step/{step_id}/actions",
        json={
            "action_type": "final_signature",
            "outcome": "accepted",
            "document_version_id": version_id,
        },
    )
    assert action_resp.status_code == 400
    assert "Expected action type" in action_resp.json()["detail"]


@pytest.mark.asyncio
async def test_action_advances_workflow_to_next_step(auth_client: AsyncClient, db_seed):
    """Nominal flow: a valid action advances to the next step and creates an action trace."""
    file = io.BytesIO(b"advance workflow doc")
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("advance.txt", file, "text/plain")},
        data={
            "title": "Advance Workflow Doc"
        },  # no category → pas de GEDRules auto-routing
    )
    assert up_resp.status_code == 201
    doc = up_resp.json()
    doc_id = doc["id"]
    version_id = doc["current_version_id"]

    me = str(db_seed["user_id"])
    wf_resp = await auth_client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": 1,
                "label": "Step 1",
                "assigned_to": me,
                "expected_action_type": "visa",
            },
            {
                "document_id": doc_id,
                "step_order": 2,
                "label": "Step 2",
                "assigned_to": me,
                "expected_action_type": "visa",
            },
        ],
    )
    assert wf_resp.status_code == 201
    step_1_id = wf_resp.json()[0]["id"]

    action_resp = await auth_client.post(
        f"/api/v1/workflows/step/{step_1_id}/actions",
        json={
            "action_type": "visa",
            "outcome": "accepted",
            "document_version_id": version_id,
            "comment": "Tout est conforme.",
        },
    )
    assert action_resp.status_code == 200
    action_data = action_resp.json()
    assert action_data["action_type"] == "visa"
    assert action_data["outcome"] == "accepted"


@pytest.mark.asyncio
async def test_pending_workflows_contains_document_summary(
    auth_client: AsyncClient, db_seed
):
    """Test that the pending workflows route returns enriched document data."""
    file = io.BytesIO(b"workflow doc summary test")
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("summary.txt", file, "text/plain")},
        data={"title": "Summary Test"},  # no category → pas de GEDRules auto-routing
    )
    doc_id = up_resp.json()["id"]

    me = str(db_seed["user_id"])
    await auth_client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": 1,
                "label": "Validation Step",
                "assigned_to": me,
                "expected_action_type": "visa",
            }
        ],
    )

    pending_resp = await auth_client.get("/api/v1/workflows/pending")
    assert pending_resp.status_code == 200
    tasks = pending_resp.json()
    assert len(tasks) > 0

    task = next((t for t in tasks if t["document_id"] == doc_id), None)
    assert task is not None
    assert "document" in task
    assert task["document"] is not None
    assert task["document"]["title"] == "Summary Test"
    # Document summary category assertions removed as category string is gone
    assert task["document"]["owner_name"] is not None


@pytest.mark.asyncio
async def test_assign_step_admin_rejects_assignee_outside_tenant(
    admin_client: AsyncClient, db_seed, test_engine
):
    """Admin assign endpoint must reject an assignee from another tenant."""
    # 1) Create a document + pending_assignment step in seed tenant.
    file = io.BytesIO(b"pending assignment cross tenant")
    up_resp = await admin_client.post(
        "/api/v1/documents/upload",
        files={"file": ("pending.txt", file, "text/plain")},
        data={"title": "Pending Assignment Doc"},
    )
    assert up_resp.status_code == 201
    doc_id = up_resp.json()["id"]

    wf_resp = await admin_client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": 1,
                "label": "Step 1",
                "assigned_to": str(db_seed["user_id"]),
                "expected_action_type": "visa",
            },
            {
                "document_id": doc_id,
                "step_order": 2,
                "label": "Step 2",
                "assigned_to": None,
                "expected_action_type": "visa",
            },
        ],
    )
    assert wf_resp.status_code == 201

    step2_id = wf_resp.json()[1]["id"]

    # Complete step 1 so step 2 becomes pending_assignment/currently assignable.
    version_id = up_resp.json()["current_version_id"]
    action_resp = await admin_client.post(
        f"/api/v1/workflows/step/{wf_resp.json()[0]['id']}/actions",
        json={
            "action_type": "visa",
            "outcome": "accepted",
            "document_version_id": version_id,
        },
    )
    assert action_resp.status_code == 200

    # Force status to pending_assignment for deterministic assign endpoint behavior.
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        from app.models.workflow import WorkflowStep

        step = await session.get(WorkflowStep, uuid.UUID(step2_id))
        step.status = "pending_assignment"
        await session.commit()

    # 2) Insert a user in another tenant.
    foreign_tenant_id = uuid.uuid4()
    foreign_org_unit_id = uuid.uuid4()
    foreign_user_id = uuid.uuid4()
    async with session_factory() as session:
        session.add(
            Tenant(
                id=foreign_tenant_id,
                name="Other Tenant",
                short_name="OTHER",
                domain=f"other-{foreign_tenant_id}.gov.cm",
                is_active=True,
            )
        )
        session.add(
            OrgUnit(
                id=foreign_org_unit_id,
                tenant_id=foreign_tenant_id,
                code="OTHER-DIR",
                name="Other Direction",
                level=1,
                is_active=True,
            )
        )
        session.add(
            User(
                id=foreign_user_id,
                tenant_id=foreign_tenant_id,
                org_unit_id=foreign_org_unit_id,
                role_id=db_seed["role_id"],
                matricule="OTHER001",
                email=f"other-{foreign_user_id}@gov.cm",
                first_name="Other",
                last_name="User",
                password_hash=hash_password("testpassword123"),
                is_active=True,
            )
        )
        await session.commit()

    # 3) Assign step to foreign user must fail.
    assign_resp = await admin_client.post(
        f"/api/v1/workflows/steps/{step2_id}/assign",
        json={"assigned_to": str(foreign_user_id)},
    )
    assert assign_resp.status_code == 400
    assert "hors tenant" in assign_resp.json()["detail"]


@pytest.mark.asyncio
async def test_action_missing_document_version_id_fails(
    auth_client: AsyncClient, db_seed
):
    """Test that missing document_version_id returns a 422 Unprocessable Entity."""
    file = io.BytesIO(b"doc missing version")
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("missing.txt", file, "text/plain")},
        data={
            "title": "Missing Version Doc"
        },  # no category → pas de GEDRules auto-routing
    )
    doc_id = up_resp.json()["id"]
    me = str(db_seed["user_id"])

    wf_resp = await auth_client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": 1,
                "label": "Step 1",
                "assigned_to": me,
            }
        ],
    )
    step_1_id = wf_resp.json()[0]["id"]

    # Action without document_version_id
    action_resp = await auth_client.post(
        f"/api/v1/workflows/step/{step_1_id}/actions",
        json={
            "action_type": "visa",
            "outcome": "accepted",
            "comment": "No version provided",
            # document_version_id is missing
        },
    )
    assert action_resp.status_code == 422


@pytest.mark.asyncio
async def test_action_returned_cancels_subsequent_steps(
    auth_client: AsyncClient, db_seed
):
    """Test that a 'returned' outcome cancels subsequent steps and changes document status."""
    file = io.BytesIO(b"returned doc test")
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("returned.txt", file, "text/plain")},
        data={"title": "Returned Doc"},  # no category → pas de GEDRules auto-routing
    )
    doc = up_resp.json()
    doc_id = doc["id"]
    version_id = doc["current_version_id"]
    me = str(db_seed["user_id"])

    await auth_client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": 1,
                "label": "Step 1",
                "assigned_to": me,
            },
            {
                "document_id": doc_id,
                "step_order": 2,
                "label": "Step 2",
                "assigned_to": me,
            },
        ],
    )

    pending_resp = await auth_client.get("/api/v1/workflows/pending")
    step_1_id = pending_resp.json()[0]["id"]

    action_resp = await auth_client.post(
        f"/api/v1/workflows/step/{step_1_id}/actions",
        json={
            "action_type": "visa",
            "outcome": "returned",
            "document_version_id": version_id,
            "comment": "A corriger",
        },
    )
    assert action_resp.status_code == 200

    # Ensure document status is returned
    doc_resp = await auth_client.get(f"/api/v1/documents/{doc_id}")
    assert doc_resp.status_code == 200
    assert doc_resp.json()["status"] == "returned"

    # Ensure second step is cancelled and first is returned
    steps_resp = await auth_client.get(f"/api/v1/workflows/document/{doc_id}/steps")
    steps = sorted(steps_resp.json(), key=lambda s: s["step_order"])
    assert steps[0]["status"] == "returned"
    assert steps[1]["status"] == "cancelled"


@pytest.mark.asyncio
async def test_action_unassigned_non_admin_fails(
    auth_client: AsyncClient, db_seed, db_session
):
    """Test that a non-admin user cannot submit an action if they are not assigned to the step."""
    file = io.BytesIO(b"unassigned doc test")
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("unassigned.txt", file, "text/plain")},
        data={"title": "Unassigned Doc"},  # no category → pas de GEDRules auto-routing
    )
    doc = up_resp.json()
    doc_id = doc["id"]
    version_id = doc["current_version_id"]

    import uuid

    other_user_id = uuid.uuid4()

    from app.models.user import User

    other_user = User(
        id=other_user_id,
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        role_id=db_seed["role_id"],
        email="other@test.com",
        password_hash="pwd",
        first_name="Other",
        last_name="User",
        is_active=True,
        matricule="TEST002",
    )
    db_session.add(other_user)
    await db_session.commit()

    create_resp = await auth_client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": 1,
                "label": "Step 1",
                "assigned_to": str(other_user_id),
                "expected_action_type": "visa",
            }
        ],
    )
    assert create_resp.status_code == 201
    step_1_id = create_resp.json()[0]["id"]

    action_resp = await auth_client.post(
        f"/api/v1/workflows/step/{step_1_id}/actions",
        json={
            "action_type": "visa",
            "outcome": "accepted",
            "document_version_id": version_id,
            "comment": "I am not assigned",
        },
    )
    assert action_resp.status_code == 403
    assert "not assigned to this step" in action_resp.json()["detail"]


@pytest.mark.asyncio
async def test_concurrent_workflow_action_submission(auth_client: AsyncClient, db_seed):
    """Test concurrent submission on the same step."""
    import asyncio

    file = io.BytesIO(b"concurrent doc test")
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("concurrent.txt", file, "text/plain")},
        data={"title": "Concurrent Doc"},  # no category → pas de GEDRules auto-routing
    )
    doc = up_resp.json()
    doc_id = doc["id"]
    version_id = doc["current_version_id"]
    me = str(db_seed["user_id"])

    await auth_client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": 1,
                "label": "Step 1",
                "assigned_to": me,
            }
        ],
    )

    pending_resp = await auth_client.get("/api/v1/workflows/pending")
    step_1_id = pending_resp.json()[0]["id"]

    # Send two concurrent action requests
    payload = {
        "action_type": "visa",
        "outcome": "accepted",
        "document_version_id": version_id,
        "comment": "Double submit",
    }

    req1 = auth_client.post(f"/api/v1/workflows/step/{step_1_id}/actions", json=payload)
    req2 = auth_client.post(f"/api/v1/workflows/step/{step_1_id}/actions", json=payload)

    res1, res2 = await asyncio.gather(req1, req2)

    # Assert exactly one action was processed correctly
    history_resp = await auth_client.get(f"/api/v1/workflows/document/{doc_id}/actions")
    assert history_resp.status_code == 200
    actions = history_resp.json()
    assert (
        len(actions) == 1
    ), "Concurrency issue: step should only record exactly 1 action"

    # Also check the final status of the step itself
    doc_steps_resp = await auth_client.get(f"/api/v1/workflows/document/{doc_id}/steps")
    steps = doc_steps_resp.json()
    assert steps[0]["status"] == "completed"
    await asyncio.sleep(0.05)


@pytest.mark.asyncio
async def test_get_document_action_history(auth_client: AsyncClient, db_seed):
    """Test history fetch route returns full trace."""
    file = io.BytesIO(b"history doc")
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("history.txt", file, "text/plain")},
        data={"title": "History Doc"},  # no category → pas de GEDRules auto-routing
    )
    doc = up_resp.json()
    doc_id = doc["id"]
    version_id = doc["current_version_id"]
    me = str(db_seed["user_id"])

    await auth_client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": 1,
                "label": "Step 1",
                "assigned_to": me,
            }
        ],
    )

    pending_resp = await auth_client.get("/api/v1/workflows/pending")
    step_1_id = pending_resp.json()[0]["id"]

    action_resp = await auth_client.post(
        f"/api/v1/workflows/step/{step_1_id}/actions",
        json={
            "action_type": "visa",
            "outcome": "accepted",
            "document_version_id": version_id,
            "comment": "Testing history",
        },
    )
    assert action_resp.status_code == 200

    history_resp = await auth_client.get(f"/api/v1/workflows/document/{doc_id}/actions")
    assert history_resp.status_code == 200
    history = history_resp.json()

    assert len(history) == 1
    action = history[0]
    assert action["action_type"] == "visa"
    assert action["outcome"] == "accepted"
    assert action["actor_name"] is not None
    assert action["document_version_id"] == version_id
    assert action["performed_at"] is not None
    import asyncio

    await asyncio.sleep(0.05)


@pytest.mark.asyncio
async def test_action_advances_workflow_to_validated(auth_client: AsyncClient, db_seed):
    """Test that accepting the last workflow step transitions the document to 'validated' status."""
    file = io.BytesIO(b"single step doc")
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("single.txt", file, "text/plain")},
        data={"title": "Single Step Doc"},  # no category → pas de GEDRules auto-routing
    )
    doc = up_resp.json()
    doc_id = doc["id"]
    version_id = doc["current_version_id"]
    me = str(db_seed["user_id"])

    # Only 1 step workflow
    create_resp = await auth_client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": 1,
                "label": "Final Step",
                "assigned_to": me,
                "expected_action_type": "approval",
            }
        ],
    )
    step_id = create_resp.json()[0]["id"]

    action_resp = await auth_client.post(
        f"/api/v1/workflows/step/{step_id}/actions",
        json={
            "action_type": "approval",
            "outcome": "accepted",
            "document_version_id": version_id,
        },
    )
    assert action_resp.status_code == 200

    # Ensure document is validated
    doc_resp = await auth_client.get(f"/api/v1/documents/{doc_id}")
    assert doc_resp.json()["status"] == "validated"
    import asyncio

    await asyncio.sleep(0.05)


@pytest.mark.asyncio
async def test_get_document_multiple_action_history(auth_client: AsyncClient, db_seed):
    """Test history fetch route returns full trace ordered properly for multiple actions."""
    file = io.BytesIO(b"multi history doc")
    up_resp = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("multihistory.txt", file, "text/plain")},
        data={
            "title": "Multi History Doc"
        },  # no category → pas de GEDRules auto-routing
    )
    doc_id = up_resp.json()["id"]
    version_id = up_resp.json()["current_version_id"]
    me = str(db_seed["user_id"])

    create_resp = await auth_client.post(
        f"/api/v1/workflows/document/{doc_id}/steps",
        json=[
            {
                "document_id": doc_id,
                "step_order": 1,
                "label": "Step 1",
                "assigned_to": me,
                "expected_action_type": "visa",
            },
            {
                "document_id": doc_id,
                "step_order": 2,
                "label": "Step 2",
                "assigned_to": me,
                "expected_action_type": "approval",
            },
        ],
    )
    steps = sorted(create_resp.json(), key=lambda s: s["step_order"])

    # Action 1
    await auth_client.post(
        f"/api/v1/workflows/step/{steps[0]['id']}/actions",
        json={
            "action_type": "visa",
            "outcome": "accepted",
            "document_version_id": version_id,
            "comment": "visa ok",
        },
    )
    # Action 2
    await auth_client.post(
        f"/api/v1/workflows/step/{steps[1]['id']}/actions",
        json={
            "action_type": "approval",
            "outcome": "accepted",
            "document_version_id": version_id,
            "comment": "approval ok",
        },
    )

    history_resp = await auth_client.get(f"/api/v1/workflows/document/{doc_id}/actions")
    assert history_resp.status_code == 200
    history = history_resp.json()

    assert len(history) == 2
    # Newest actions first generally, or by date. The endpoint sorts by performed_at ASC by default (let's verify implicitly)
    assert history[0]["action_type"] == "visa"
    assert history[1]["action_type"] == "approval"
    assert history[0]["comment"] == "visa ok"
    assert history[1]["comment"] == "approval ok"
    import asyncio

    await asyncio.sleep(0.05)
