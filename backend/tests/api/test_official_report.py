"""Official reports: numbered copies, register, fingerprint and audit trail."""

import asyncio
import hashlib
import io
import uuid
from datetime import datetime
from urllib.parse import unquote

import pytest
from httpx import AsyncClient
from pypdf import PdfReader
from sqlalchemy import func, select, update

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
async def test_pdf_copy_is_numbered_and_reprinted_as_is(
    admin_client: AsyncClient, db_session
):
    response = await admin_client.post(
        OFFICIAL, json={"kind": "document-activity", "format": "pdf"}
    )
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].endswith('.pdf"')
    number = unquote(response.headers["x-report-number"])
    text = "\n".join(
        page.extract_text() for page in PdfReader(io.BytesIO(response.content)).pages
    )
    assert number in text and "TESTMIN" in text

    issue_id = await db_session.scalar(
        select(ReportIssue.id).where(ReportIssue.format == "pdf")
    )
    reprint = await admin_client.get(f"{OFFICIAL}/issues/{issue_id}/file")
    assert reprint.status_code == 200
    assert reprint.content == response.content
    assert reprint.headers["content-type"] == "application/pdf"


@pytest.mark.asyncio
async def test_reprint_is_the_same_file_without_a_new_number(
    admin_client: AsyncClient, db_session
):
    first = await admin_client.post(OFFICIAL, json={"kind": "service-activity"})
    again = await admin_client.post(OFFICIAL, json={"kind": "service-activity"})
    assert unquote(again.headers["x-report-number"]).startswith("N° 0002/")

    issue_id = await db_session.scalar(
        select(ReportIssue.id).where(ReportIssue.sequence == 1)
    )
    reprint = await admin_client.get(f"{OFFICIAL}/issues/{issue_id}/file")
    assert reprint.status_code == 200
    assert reprint.content == first.content
    assert reprint.headers["x-report-number"] == first.headers["x-report-number"]
    assert reprint.headers["x-report-sha256"] == first.headers["x-report-sha256"]
    assert (
        reprint.headers["content-disposition"] == first.headers["content-disposition"]
    )
    assert await _count(db_session, ReportIssue) == 2
    assert await _count(db_session, ReportCounter) == 1
    assert (
        await _count(db_session, AuditLog, AuditLog.action == "report_reprinted") == 1
    )

    missing = await admin_client.get(f"{OFFICIAL}/issues/{uuid.uuid4()}/file")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_report_on_one_service_carries_it_in_the_number(
    admin_client: AsyncClient, db_seed
):
    response = await admin_client.post(
        OFFICIAL, json={"kind": "evolution", "org_unit_id": str(db_seed["org_unit_id"])}
    )
    assert response.status_code == 200, response.text
    year = _year()
    assert (
        unquote(response.headers["x-report-number"])
        == f"N° 0001/{year}/TESTMIN/DIR-TEST"
    )
    assert (
        f'filename="rapport-evolution-0001-{year}-TESTMIN-DIR-TEST.csv"'
        in response.headers["content-disposition"]
    )


@pytest.mark.asyncio
async def test_concurrent_issues_get_distinct_numbers_without_gap(
    admin_client: AsyncClient, db_session
):
    responses = await asyncio.gather(
        *[admin_client.post(OFFICIAL, json={"kind": "evolution"}) for _ in range(6)]
    )
    assert [response.status_code for response in responses] == [200] * 6
    numbers = sorted(unquote(r.headers["x-report-number"]) for r in responses)
    assert numbers == [f"N° {n:04d}/{_year()}/TESTMIN" for n in range(1, 7)]
    sequences = (
        await db_session.scalars(select(ReportIssue.sequence).order_by("sequence"))
    ).all()
    assert sequences == [1, 2, 3, 4, 5, 6]
    assert await db_session.scalar(select(ReportCounter.last_value)) == 6


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
    assert response.json()["detail"] == "Renseignez le sigle de l'institution"
    assert await _count(db_session, ReportCounter) == 0
    assert await _count(db_session, ReportIssue) == 0


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
        {"kind": "evolution", "format": "docx"},
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
async def test_foreign_tenant_sees_nothing(
    admin_client: AsyncClient, client_as, db_session
):
    created = await admin_client.post(OFFICIAL, json={"kind": "evolution"})
    assert created.status_code == 200

    issue_id = await db_session.scalar(select(ReportIssue.id))

    async with client_as("tenant_admin", tenant_id=uuid.uuid4()) as client:
        listed = await client.get(f"{OFFICIAL}/issues")
        issued = await client.post(OFFICIAL, json={"kind": "evolution"})
        reprint = await client.get(f"{OFFICIAL}/issues/{issue_id}/file")
    assert listed.status_code == 200
    assert listed.json() == []
    assert listed.headers["x-total-count"] == "0"
    assert issued.status_code == 404
    assert reprint.status_code == 404


@pytest.mark.asyncio
async def test_manager_lists_and_reprints_only_own_copies(
    admin_client: AsyncClient, client_as, db_session, db_seed
):
    created = await admin_client.post(OFFICIAL, json={"kind": "evolution"})
    assert created.status_code == 200
    issue_id = await db_session.scalar(select(ReportIssue.id))

    async with client_as(
        "manager", tenant_id=db_seed["tenant_id"], org_unit_id=db_seed["org_unit_id"]
    ) as client:
        listed = await client.get(f"{OFFICIAL}/issues")
        reprint = await client.get(f"{OFFICIAL}/issues/{issue_id}/file")
    assert listed.status_code == 200
    assert listed.headers["x-total-count"] == "0"
    assert reprint.status_code == 404


@pytest.mark.asyncio
async def test_bad_period_is_400(admin_client: AsyncClient, db_session):
    response = await admin_client.post(
        OFFICIAL,
        json={"kind": "evolution", "date_from": "2026-11-10", "date_to": "2026-11-01"},
    )
    assert response.status_code == 400
    assert await _count(db_session, ReportIssue) == 0
