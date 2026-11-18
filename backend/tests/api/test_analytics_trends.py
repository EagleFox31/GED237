"""GET /analytics/trends: weekly series, Douala weeks, scopes and isolation."""

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.org_unit import OrgUnit
from app.models.tenant import Tenant
from app.models.workflow import ActionType, OutcomeType, WorkflowAction, WorkflowStep
from app.services.analytics.trends import week_starts

TRENDS = "/api/v1/analytics/trends"
MANAGER = "/api/v1/analytics/manager"


async def _doc(
    db_session, tenant_id, org_unit_id, owner_id, created_at, status="draft"
):
    document = Document(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        org_unit_id=org_unit_id,
        owner_id=owner_id,
        title="trend",
        file_path="x/trend.pdf",
        status=status,
        created_at=created_at,
    )
    db_session.add(document)
    await db_session.flush()
    return document


async def _action(db_session, document, user_id, outcome, performed_at):
    step = WorkflowStep(
        id=uuid.uuid4(),
        document_id=document.id,
        step_order=1,
        label="Visa",
        status="current",
    )
    db_session.add(step)
    await db_session.flush()
    version = DocumentVersion(
        id=uuid.uuid4(),
        document_id=document.id,
        version_number="1.0",
        file_path="x/trend.pdf",
        uploaded_by_id=user_id,
        uploaded_at=performed_at,
    )
    db_session.add(version)
    await db_session.flush()
    db_session.add(
        WorkflowAction(
            document_version_id=version.id,
            workflow_step_id=step.id,
            action_type=ActionType.visa,
            outcome=outcome,
            performed_by=user_id,
            performed_at=performed_at,
        )
    )


def test_week_starts_are_mondays_oldest_first():
    mondays = week_starts(4, today=date(2026, 11, 18))  # a Wednesday
    assert [m.isoformat() for m in mondays] == [
        "2026-10-26",
        "2026-11-02",
        "2026-11-09",
        "2026-11-16",
    ]


@pytest.mark.asyncio
async def test_empty_weeks_are_zero_filled(auth_client, db_seed):
    response = await auth_client.get(TRENDS, params={"scope": "mine"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["weeks"]) == 12
    assert body["series"]["documents_created"] == [0] * 12
    assert body["series"]["visas_accepted"] == [0] * 12
    assert body["now"] == {"drafts": 0, "awaiting_visa": 0}


@pytest.mark.asyncio
async def test_week_boundary_uses_douala_time(admin_client, db_session, db_seed):
    # Sunday 23:30 UTC is already Monday 00:30 in Douala: it belongs to the next week.
    current = week_starts(1)[0]
    previous_sunday = datetime(
        current.year, current.month, current.day, 0, 0
    ) - timedelta(minutes=30)
    await _doc(
        db_session,
        db_seed["tenant_id"],
        db_seed["org_unit_id"],
        db_seed["user_id"],
        previous_sunday,
    )
    await db_session.commit()
    body = (await admin_client.get(TRENDS, params={"scope": "tenant"})).json()
    assert body["series"]["documents_created"][-1] == 1
    assert sum(body["series"]["documents_created"]) == 1


@pytest.mark.asyncio
async def test_visas_are_split_and_scoped_to_tenant(admin_client, db_session, db_seed):
    now = datetime.now(timezone.utc)
    mine = await _doc(
        db_session,
        db_seed["tenant_id"],
        db_seed["org_unit_id"],
        db_seed["user_id"],
        now.replace(tzinfo=None),
    )
    await _action(db_session, mine, db_seed["user_id"], OutcomeType.accepted, now)
    await _action(db_session, mine, db_seed["user_id"], OutcomeType.returned, now)

    other_tenant = Tenant(id=uuid.uuid4(), name="Autre")
    db_session.add(other_tenant)
    await db_session.flush()
    foreign_unit = OrgUnit(
        id=uuid.uuid4(),
        tenant_id=other_tenant.id,
        code=f"OU-{uuid.uuid4().hex[:8]}",
        name="Etrangere",
        level=1,
        is_active=True,
    )
    db_session.add(foreign_unit)
    await db_session.flush()
    foreign = await _doc(
        db_session,
        other_tenant.id,
        foreign_unit.id,
        db_seed["user_id"],
        now.replace(tzinfo=None),
    )
    await _action(db_session, foreign, db_seed["user_id"], OutcomeType.accepted, now)
    await db_session.commit()

    body = (await admin_client.get(TRENDS, params={"scope": "tenant"})).json()
    assert body["series"]["visas_accepted"][-1] == 1
    assert body["series"]["visas_rejected_or_returned"][-1] == 1
    assert body["series"]["documents_created"][-1] == 1


@pytest.mark.asyncio
async def test_unit_scope_excludes_other_units(admin_client, db_session, db_seed):
    other_unit = OrgUnit(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        code=f"OU-{uuid.uuid4().hex[:8]}",
        name="Autre",
        level=1,
        is_active=True,
    )
    db_session.add(other_unit)
    await db_session.flush()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    await _doc(
        db_session,
        db_seed["tenant_id"],
        db_seed["org_unit_id"],
        db_seed["user_id"],
        now,
    )
    await _doc(db_session, db_seed["tenant_id"], other_unit.id, db_seed["user_id"], now)
    await db_session.commit()
    body = (await admin_client.get(TRENDS, params={"scope": "unit"})).json()
    assert body["series"]["documents_created"][-1] == 1
    assert "now" not in body


@pytest.mark.asyncio
async def test_tenant_scope_is_refused_to_a_collaborator(auth_client, db_seed):
    response = await auth_client.get(TRENDS, params={"scope": "tenant"})
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_unknown_scope_and_bad_weeks(auth_client, db_seed):
    assert (await auth_client.get(TRENDS, params={"scope": "x"})).status_code == 403
    assert (await auth_client.get(TRENDS, params={"weeks": 3})).status_code == 422
    assert (await auth_client.get(TRENDS, params={"weeks": 27})).status_code == 422


@pytest.mark.asyncio
async def test_mine_counts_current_statuses(auth_client, db_session, db_seed):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for status in ("draft", "draft", "in_review"):
        await _doc(
            db_session,
            db_seed["tenant_id"],
            db_seed["org_unit_id"],
            db_seed["user_id"],
            now,
            status,
        )
    await db_session.commit()
    body = (await auth_client.get(TRENDS, params={"scope": "mine"})).json()
    assert body["now"] == {"drafts": 2, "awaiting_visa": 1}


@pytest.mark.asyncio
async def test_unit_admin_reaches_trends_and_manager(client_as, db_seed):
    async with client_as(
        "unit_admin", tenant_id=db_seed["tenant_id"], org_unit_id=db_seed["org_unit_id"]
    ) as client:
        assert (await client.get(MANAGER)).status_code == 200
        assert (await client.get(TRENDS, params={"scope": "unit"})).status_code == 200
        assert (await client.get(TRENDS, params={"scope": "tenant"})).status_code == 200
