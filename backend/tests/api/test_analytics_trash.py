"""The dashboards leave the recycle bin out, as the manager one does (#218, #256).

A trashed document is no longer among the institution files: it leaves the
document count and the storage shown on the tenant and platform dashboards.
"""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient

from app.models.document import Document

MB = 1024 * 1024


def _document(db_seed, *, trashed: bool) -> Document:
    return Document(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        owner_id=db_seed["user_id"],
        title="Corbeille" if trashed else "Visible",
        file_path=f"tenant/unit/{uuid.uuid4()}.pdf",
        file_type="pdf",
        mime_type="application/pdf",
        file_size=MB,
        document_category_id=db_seed["category_id"],
        status="draft",
        deleted_at=datetime.now(timezone.utc) if trashed else None,
    )


async def _section(client: AsyncClient, url: str, key: str) -> dict:
    response = await client.get(url)
    assert response.status_code == 200, response.text
    return response.json()[key]


@pytest.mark.asyncio
async def test_a_trashed_document_leaves_the_tenant_dashboard(
    admin_client: AsyncClient, db_session, db_seed
):
    url = "/api/v1/analytics/tenant"
    before = await _section(admin_client, url, "documents")

    db_session.add_all(
        [_document(db_seed, trashed=False), _document(db_seed, trashed=True)]
    )
    await db_session.commit()

    after = await _section(admin_client, url, "documents")
    assert after["total"] == before["total"] + 1
    # A Decimal sum on PostgreSQL: the API sends it as a string.
    assert float(after["storage_used_mb"]) == pytest.approx(
        float(before["storage_used_mb"]) + 1.0, abs=0.01
    )


@pytest.mark.asyncio
async def test_a_trashed_document_leaves_the_platform_count(
    client_as, db_session, db_seed
):
    url = "/api/v1/analytics/platform"
    async with client_as("super_admin", tenant_id=db_seed["tenant_id"]) as client:
        before = await _section(client, url, "platform")
        db_session.add(_document(db_seed, trashed=True))
        await db_session.commit()
        after = await _section(client, url, "platform")
    assert after["total_documents"] == before["total_documents"]
