"""Duplicates KPI on GET /analytics/tenant: refused uploads (audited) + duplicates of committed imports."""

import io
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.audit import AuditLog
from app.models.import_job import ImportJob

TENANT_URL = "/api/v1/analytics/tenant"


async def _add(test_engine, *rows):
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        session.add_all(rows)
        await session.commit()


def _job(db_seed, status: str, duplicates: int) -> ImportJob:
    return ImportJob(
        tenant_id=db_seed["tenant_id"],
        created_by_id=db_seed["user_id"],
        target_org_unit_id=db_seed["org_unit_id"],
        status=status,
        duplicate_files=duplicates,
    )


async def _duplicates(client: AsyncClient) -> dict:
    response = await client.get(TENANT_URL)
    assert response.status_code == 200
    return response.json()["duplicates"]


@pytest.mark.asyncio
async def test_existing_keys_unchanged_and_zero_by_default(auth_client: AsyncClient):
    data = (await auth_client.get(TENANT_URL)).json()
    assert {"users", "documents", "workflows"} <= data.keys()
    assert data["duplicates"] == {
        "refused": 0,
        "refused_upload": 0,
        "refused_import": 0,
    }


@pytest.mark.asyncio
async def test_refused_upload_is_counted(auth_client: AsyncClient, db_seed):
    content = b"kpi duplicate content"
    for name in ("first.txt", "second.txt"):
        response = await auth_client.post(
            "/api/v1/documents/upload",
            files={"file": (name, io.BytesIO(content), "text/plain")},
            data={"title": name, "document_category_id": str(db_seed["category_id"])},
        )
    assert response.status_code == 409
    assert await _duplicates(auth_client) == {
        "refused": 1,
        "refused_upload": 1,
        "refused_import": 0,
    }


@pytest.mark.asyncio
async def test_committed_import_duplicates_are_counted(
    auth_client: AsyncClient, db_seed, test_engine
):
    await _add(
        test_engine,
        _job(db_seed, "completed", 2),
        _job(db_seed, "completed_with_errors", 1),
        # analysed but never committed: re-running the analysis must not count the same files twice
        _job(db_seed, "analyzed", 5),
        _job(db_seed, "cancelled", 4),
        _job(db_seed, "draft", 3),
    )
    assert await _duplicates(auth_client) == {
        "refused": 3,
        "refused_upload": 0,
        "refused_import": 3,
    }


@pytest.mark.asyncio
async def test_other_tenant_is_not_counted(auth_client: AsyncClient, test_engine):
    await _add(
        test_engine,
        AuditLog(
            tenant_id=uuid.uuid4(),
            table_name="documents",
            record_id=uuid.uuid4(),
            action="dup_detected",
        ),
    )
    assert await _duplicates(auth_client) == {
        "refused": 0,
        "refused_upload": 0,
        "refused_import": 0,
    }


@pytest.mark.asyncio
async def test_reader_still_forbidden(client_as, db_seed):
    async with client_as("reader", tenant_id=db_seed["tenant_id"]) as client:
        assert (await client.get(TENANT_URL)).status_code == 403
