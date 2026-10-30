"""Authorization bounds and scope pinning on ``/api/v1/reports``.

Nominal granularities and panels live in ``test_reports_usage_coverage.py``.
"""

import uuid

import pytest
from httpx import AsyncClient

REPORTS = "/api/v1/reports"
PANELS = ["evolution", "document-activity", "workflow-activity", "service-activity"]


@pytest.mark.asyncio
@pytest.mark.parametrize("panel", PANELS)
async def test_reports_require_authentication(async_client: AsyncClient, panel):
    response = await async_client.get(f"{REPORTS}/{panel}")
    # FastAPI's HTTPBearer answers 403 when the header is missing (401 from 0.115).
    assert response.status_code in {401, 403}


@pytest.mark.asyncio
@pytest.mark.parametrize("panel", PANELS)
async def test_reader_has_no_tenant_analytics_access(client_as, db_seed, panel):
    async with client_as(
        "reader",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        response = await client.get(f"{REPORTS}/{panel}")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_manager_reports_are_pinned_to_own_org_unit(client_as, db_seed):
    own_unit = str(db_seed["org_unit_id"])
    async with client_as(
        "manager",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        default_scope = await client.get(f"{REPORTS}/evolution")
        own_scope = await client.get(
            f"{REPORTS}/evolution", params={"org_unit_id": own_unit}
        )
        outside = [
            await client.get(
                f"{REPORTS}/{panel}", params={"org_unit_id": str(uuid.uuid4())}
            )
            for panel in PANELS
        ]
        panels = [await client.get(f"{REPORTS}/{panel}") for panel in PANELS[1:]]

    # Without an explicit unit, a manager sees their unit and everything below it.
    assert default_scope.status_code == 200
    assert default_scope.json()["filters"]["org_unit_id"] == own_unit
    assert default_scope.json()["filters"]["recursive"] is True
    # An explicit own unit keeps the caller's recursive choice.
    assert own_scope.json()["filters"]["recursive"] is False
    assert [r.status_code for r in outside] == [403] * len(PANELS)
    assert [r.status_code for r in panels] == [200] * len(panels)


@pytest.mark.asyncio
@pytest.mark.parametrize("panel", PANELS)
async def test_manager_without_org_unit_is_denied(client_as, db_seed, panel):
    async with client_as(
        "manager", tenant_id=db_seed["tenant_id"], org_unit_id=None
    ) as client:
        response = await client.get(f"{REPORTS}/{panel}")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_super_admin_can_report_on_another_tenant(admin_client: AsyncClient):
    other_tenant = str(uuid.uuid4())

    honoured = await admin_client.get(
        f"{REPORTS}/evolution", params={"tenant_id": other_tenant}
    )
    assert honoured.status_code == 200
    assert honoured.json()["filters"]["tenant_id"] == other_tenant


@pytest.mark.asyncio
async def test_tenant_admin_tenant_override_is_ignored(client_as, db_seed):
    async with client_as("tenant_admin", tenant_id=db_seed["tenant_id"]) as client:
        response = await client.get(
            f"{REPORTS}/evolution", params={"tenant_id": str(uuid.uuid4())}
        )
    assert response.status_code == 200
    assert response.json()["filters"]["tenant_id"] == str(db_seed["tenant_id"])
