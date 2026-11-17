"""Official reports: numbered copies, register, fingerprint and audit trail."""

import hashlib
import uuid
from datetime import datetime
from urllib.parse import unquote

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, update

from app.core.config import settings
from app.models.audit import AuditLog
from app.models.report_issue import ReportCounter, ReportIssue
from app.models.tenant import Tenant
from app.services.official_report import LOCAL_TZ

OFFICIAL = "/api/v1/reports/official"
KINDS = ["evolution", "document-activity", "workflow-activity", "service-activity"]


def _year() -> int:
    return datetime.now(LOCAL_TZ).year


async def _count(db_session, model, *where) -> int:
    return await db_session.scalar(
        select(func.count()).select_from(model).where(*where)
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", KINDS)
async def test_each_kind_is_issued_as_csv(admin_client: AsyncClient, kind):
    response = await admin_client.post(OFFICIAL, json={"kind": kind})
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/csv")
    text = response.content.decode("utf-8")
    assert text.startswith("﻿Rapport officiel;")
    assert f"Numéro;N° 0001/{_year()}/TESTMIN\r\n" in text


@pytest.mark.asyncio
async def test_copy_is_numbered_registered_fingerprinted_and_logged(
    admin_client: AsyncClient, db_session
):
    first = await admin_client.post(OFFICIAL, json={"kind": "document-activity"})
    second = await admin_client.post(OFFICIAL, json={"kind": "document-activity"})
    assert first.status_code == second.status_code == 200

    year = _year()
    assert unquote(first.headers["x-report-number"]) == f"N° 0001/{year}/TESTMIN"
    assert unquote(second.headers["x-report-number"]) == f"N° 0002/{year}/TESTMIN"
    assert first.headers["x-report-sha256"] == hashlib.sha256(first.content).hexdigest()
    assert (
        f'filename="rapport-document-activity-0001-{year}-TESTMIN.csv"'
        in first.headers["content-disposition"]
    )

    issues = (
        await db_session.scalars(select(ReportIssue).order_by(ReportIssue.sequence))
    ).all()
    assert [issue.sequence for issue in issues] == [1, 2]
    assert issues[0].file_sha256 == first.headers["x-report-sha256"]
    assert issues[0].filters == {"recursive": False}
    assert (
        await _count(db_session, AuditLog, AuditLog.action == "report_generated") == 2
    )

    listed = await admin_client.get(f"{OFFICIAL}/issues")
    assert listed.status_code == 200
    assert listed.headers["x-total-count"] == "2"
    assert [item["sequence"] for item in listed.json()] == [2, 1]


@pytest.mark.asyncio
async def test_html_copy_is_self_contained(admin_client: AsyncClient):
    response = await admin_client.post(
        OFFICIAL, json={"kind": "workflow-activity", "format": "html"}
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    page = response.content.decode("utf-8")
    assert page.startswith("<!doctype html>")
    assert "TESTMIN" in page
    assert "http://" not in page and "https://" not in page


@pytest.mark.asyncio
async def test_identical_report_keeps_its_number_when_configured(
    admin_client: AsyncClient, db_session, monkeypatch
):
    monkeypatch.setattr(settings, "OFFICIAL_REPORT_NEW_NUMBER_EACH_TIME", False)
    first = await admin_client.post(OFFICIAL, json={"kind": "service-activity"})
    again = await admin_client.post(OFFICIAL, json={"kind": "service-activity"})
    other = await admin_client.post(
        OFFICIAL, json={"kind": "service-activity", "format": "html"}
    )

    assert again.content == first.content
    assert again.headers["x-report-sha256"] == first.headers["x-report-sha256"]
    assert again.headers["x-report-number"] == first.headers["x-report-number"]
    assert unquote(other.headers["x-report-number"]).startswith("N° 0002/")
    assert await _count(db_session, ReportIssue) == 2
    assert (
        await _count(db_session, AuditLog, AuditLog.action == "report_generated") == 3
    )


@pytest.mark.asyncio
async def test_institution_without_short_name_is_refused_without_taking_a_number(
    admin_client: AsyncClient, db_session, db_seed
):
    await db_session.execute(
        update(Tenant).where(Tenant.id == db_seed["tenant_id"]).values(short_name=" ")
    )
    await db_session.commit()

    response = await admin_client.post(OFFICIAL, json={"kind": "evolution"})
    assert response.status_code == 422
    assert "sigle" in response.json()["detail"]
    assert await _count(db_session, ReportCounter) == 0
    assert await _count(db_session, ReportIssue) == 0


@pytest.mark.asyncio
async def test_institution_without_short_name_when_allowed(
    admin_client: AsyncClient, db_session, db_seed, monkeypatch
):
    monkeypatch.setattr(settings, "OFFICIAL_REPORT_REQUIRE_SHORT_NAME", False)
    await db_session.execute(
        update(Tenant).where(Tenant.id == db_seed["tenant_id"]).values(short_name=None)
    )
    await db_session.commit()

    response = await admin_client.post(OFFICIAL, json={"kind": "evolution"})
    assert response.status_code == 200
    assert unquote(response.headers["x-report-number"]) == f"N° 0001/{_year()}"


@pytest.mark.asyncio
async def test_reader_cannot_issue_nor_list(client_as, db_seed):
    async with client_as(
        "reader", tenant_id=db_seed["tenant_id"], org_unit_id=db_seed["org_unit_id"]
    ) as client:
        issued = await client.post(OFFICIAL, json={"kind": "evolution"})
        listed = await client.get(f"{OFFICIAL}/issues")
    assert issued.status_code == 403
    assert listed.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"kind": "unknown"},
        {"kind": "evolution", "format": "pdf"},
        {"kind": "evolution", "unexpected": 1},
        {},
    ],
)
async def test_payload_outside_contract_is_422(admin_client: AsyncClient, payload):
    response = await admin_client.post(OFFICIAL, json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_limit_is_bounded(admin_client: AsyncClient):
    response = await admin_client.get(f"{OFFICIAL}/issues", params={"limit": 201})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_foreign_tenant_sees_nothing(admin_client: AsyncClient, client_as):
    created = await admin_client.post(OFFICIAL, json={"kind": "evolution"})
    assert created.status_code == 200

    async with client_as("tenant_admin", tenant_id=uuid.uuid4()) as client:
        listed = await client.get(f"{OFFICIAL}/issues")
        issued = await client.post(OFFICIAL, json={"kind": "evolution"})
    assert listed.status_code == 200
    assert listed.json() == []
    assert listed.headers["x-total-count"] == "0"
    assert issued.status_code == 404


@pytest.mark.asyncio
async def test_manager_lists_only_own_copies(
    admin_client: AsyncClient, client_as, db_seed
):
    created = await admin_client.post(OFFICIAL, json={"kind": "evolution"})
    assert created.status_code == 200

    async with client_as(
        "manager", tenant_id=db_seed["tenant_id"], org_unit_id=db_seed["org_unit_id"]
    ) as client:
        listed = await client.get(f"{OFFICIAL}/issues")
    assert listed.status_code == 200
    assert listed.headers["x-total-count"] == "0"


@pytest.mark.asyncio
async def test_bad_period_is_400(admin_client: AsyncClient, db_session):
    response = await admin_client.post(
        OFFICIAL,
        json={"kind": "evolution", "date_from": "2026-11-10", "date_to": "2026-11-01"},
    )
    assert response.status_code == 400
    assert await _count(db_session, ReportIssue) == 0
