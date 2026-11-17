"""Counters only cover what the caller may list: GET /documents/stats,
GET /workflows/stats and GET /analytics/tenant."""

import uuid
from datetime import datetime, timezone

import pytest

from app.models.document import Document
from app.models.org_unit import OrgUnit
from app.models.workflow import WorkflowStep

DOCUMENT_STATS = "/api/v1/documents/stats"
WORKFLOW_STATS = "/api/v1/workflows/stats"
TENANT_ANALYTICS = "/api/v1/analytics/tenant"


async def _doc(db_session, db_seed, org_unit_id, *, owner_id=None, trashed=False):
    document = Document(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=org_unit_id,
        owner_id=owner_id or db_seed["user_id"],
        title="stats",
        file_path="x/stats.pdf",
        deleted_at=datetime.now(timezone.utc) if trashed else None,
    )
    db_session.add(document)
    await db_session.flush()
    db_session.add(
        WorkflowStep(
            id=uuid.uuid4(),
            document_id=document.id,
            step_order=1,
            label="Visa",
            status="current",
        )
    )
    return document


@pytest.fixture
async def other_unit(db_session, db_seed):
    """Seed unit: 2 active documents + 1 trashed. Other unit: 3 active documents."""
    unit_id = uuid.uuid4()
    db_session.add(
        OrgUnit(
            id=unit_id,
            tenant_id=db_seed["tenant_id"],
            code=f"OU-{str(unit_id)[:8]}",
            name="Autre service",
            level=1,
            is_active=True,
        )
    )
    await db_session.flush()
    for _ in range(2):
        await _doc(db_session, db_seed, db_seed["org_unit_id"])
    await _doc(db_session, db_seed, db_seed["org_unit_id"], trashed=True)
    for _ in range(3):
        await _doc(db_session, db_seed, unit_id)
    await db_session.commit()
    return unit_id


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["tenant_admin", "auditor"])
async def test_institution_roles_keep_tenant_wide_counters(
    client_as, db_seed, other_unit, role
):
    async with client_as(
        role, tenant_id=db_seed["tenant_id"], org_unit_id=db_seed["org_unit_id"]
    ) as client:
        documents = (await client.get(DOCUMENT_STATS)).json()
        workflows = await client.get(WORKFLOW_STATS)
        analytics = await client.get(TENANT_ANALYTICS)
    assert (documents["total"], documents["trashed"]) == (5, 1)
    assert set(documents) == {"tenant_id", "total", "trashed", "by_status"}
    assert workflows.json()["active_workflow_steps"] == 5  # recycle bin left out
    assert analytics.status_code == 200
    institution = analytics.json()
    assert (institution["documents"]["total"], institution["workflows"]["pending"]) == (
        5,
        5,
    )


@pytest.mark.asyncio
async def test_unit_admin_counts_its_tree_in_every_counter(
    client_as, db_seed, other_unit
):
    """#195, #213: the other unit is beside the seeded one, not below it."""
    async with client_as(
        "unit_admin", tenant_id=db_seed["tenant_id"], org_unit_id=db_seed["org_unit_id"]
    ) as client:
        documents = (await client.get(DOCUMENT_STATS)).json()
        workflows = (await client.get(WORKFLOW_STATS)).json()
        analytics = await client.get(TENANT_ANALYTICS)
    assert (documents["total"], documents["trashed"]) == (2, 1)
    assert workflows["active_workflow_steps"] == 2  # recycle bin left out
    assert analytics.status_code == 200
    tree = analytics.json()
    # Same keys as the institution figures, counted in the unit tree, recycle bin
    # left out (#218).
    assert (tree["documents"]["total"], tree["workflows"]["pending"]) == (2, 2)
    assert tree["users"]["total"] == 1
    assert tree["duplicates"]["refused"] == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["manager", "reader"])
async def test_unit_roles_only_count_their_unit(client_as, db_seed, other_unit, role):
    async with client_as(
        role, tenant_id=db_seed["tenant_id"], org_unit_id=db_seed["org_unit_id"]
    ) as client:
        documents = (await client.get(DOCUMENT_STATS)).json()
        workflows = (await client.get(WORKFLOW_STATS)).json()
        analytics = await client.get(TENANT_ANALYTICS)
    assert (documents["total"], documents["trashed"]) == (2, 1)
    assert workflows["active_workflow_steps"] == 2  # recycle bin left out
    assert analytics.status_code == 403


@pytest.mark.asyncio
async def test_collaborator_only_counts_own_documents(
    client_as, db_session, db_seed, other_unit
):
    stranger = uuid.uuid4()
    async with client_as(
        "collaborator",
        id=stranger,
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        documents = (await client.get(DOCUMENT_STATS)).json()
        workflows = await client.get(WORKFLOW_STATS)
        analytics = await client.get(TENANT_ANALYTICS)
    assert (documents["total"], documents["trashed"]) == (0, 0)
    assert workflows.status_code == 403
    assert analytics.status_code == 403


@pytest.mark.asyncio
async def test_super_admin_still_targets_a_tenant(admin_client, db_seed, other_unit):
    response = await admin_client.get(
        DOCUMENT_STATS, params={"tenant_id": str(db_seed["tenant_id"])}
    )
    assert (response.json()["total"], response.json()["trashed"]) == (5, 1)
    platform = (await admin_client.get("/api/v1/analytics/platform")).json()
    assert platform["platform"]["total_documents"] == 5  # recycle bin left out
