"""Audit journal exported as an official PDF (L7-2): content, fingerprints, limits, access."""

import hashlib
import io
import re
import uuid
from datetime import datetime

import pytest
from httpx import AsyncClient
from pypdf import PdfReader
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.audit import AuditLog

EXPORT = "/api/v1/audit/logs/export"
PDF = {"format": "pdf"}


async def _seed_logs(test_engine, db_seed) -> None:
    """Three rows of the seeded tenant, stored as naive UTC like the database default."""
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        for action, table, created_at in (
            ("login", "users", datetime(2026, 11, 3, 8, 0)),
            ("upload", "documents", datetime(2026, 11, 4, 9, 30)),
            ("dup_detected", "documents", datetime(2026, 11, 5, 23, 30)),
        ):
            session.add(
                AuditLog(
                    tenant_id=db_seed["tenant_id"],
                    user_id=db_seed["user_id"],
                    table_name=table,
                    record_id=uuid.uuid4(),
                    action=action,
                    new_data={"title": f"ligne {action}"},
                    ip_address="10.0.0.7",
                    created_at=created_at,
                )
            )
        await session.commit()


def _text(response) -> str:
    assert response.status_code == 200, response.text
    assert response.content.startswith(b"%PDF-")
    reader = PdfReader(io.BytesIO(response.content))
    return " ".join(" ".join(page.extract_text() for page in reader.pages).split())


async def _export_rows(admin_client: AsyncClient) -> list[dict]:
    return (
        await admin_client.get(
            "/api/v1/audit/logs", params={"table_name": "audit_logs"}
        )
    ).json()


@pytest.mark.asyncio
async def test_pdf_export_prints_the_journal_with_its_header(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed_logs(test_engine, db_seed)

    response = await admin_client.get(EXPORT, params=PDF)

    assert response.headers["content-type"] == "application/pdf"
    assert re.fullmatch(
        r'attachment; filename="journal-audit-\d{8}-\d{4}\.pdf"',
        response.headers["content-disposition"],
    )
    text = _text(response)
    assert "Journal d'audit" in text
    for label in ("Établissement", "Exporté par", "Exporté le", "Période"):
        assert label in text
    assert "Tout le journal" in text
    assert "Nombre de lignes 3" in text
    # 23:30 UTC on the 5th is 00:30 on the 6th in Cameroon, written the French way.
    assert "06/11/2026 00:30:00" in text
    assert "Doublon refusé" in text and "TEST001" in text and "10.0.0.7" in text


@pytest.mark.asyncio
async def test_file_hash_is_sent_and_logged_and_data_hash_is_printed(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed_logs(test_engine, db_seed)

    response = await admin_client.get(EXPORT, params={**PDF, "action": "upload"})
    logged = await _export_rows(admin_client)

    file_sha256 = hashlib.sha256(response.content).hexdigest()
    assert response.headers["x-report-sha256"] == file_sha256
    assert len(logged) == 1 and logged[0]["action"] == "exported"
    new_data = logged[0]["new_data"]
    assert new_data["format"] == "pdf"
    assert new_data["rows"] == 1 and new_data["filters"] == {"action": "upload"}
    assert new_data["file_sha256"] == file_sha256
    assert re.fullmatch(r"[0-9a-f]{64}", new_data["content_sha256"])
    assert new_data["content_sha256"] in _text(response)


@pytest.mark.asyncio
async def test_same_data_gives_the_same_data_hash(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed_logs(test_engine, db_seed)
    params = {**PDF, "action": "upload"}

    await admin_client.get(EXPORT, params=params)
    await admin_client.get(EXPORT, params=params)
    await admin_client.get(EXPORT, params={**PDF, "action": "login"})
    hashes = [
        row["new_data"]["content_sha256"] for row in await _export_rows(admin_client)
    ]

    # Newest first: login, upload, upload.
    assert hashes[1] == hashes[2]
    assert hashes[0] != hashes[1]


@pytest.mark.asyncio
async def test_filters_are_printed_in_plain_words(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed_logs(test_engine, db_seed)

    text = _text(
        await admin_client.get(
            EXPORT,
            params={
                **PDF,
                "date_from": "2026-11-06",
                "date_to": "2026-11-06",
                "action": ["dup_detected", "upload"],
                "table_name": "documents",
                "user_id": str(db_seed["user_id"]),
            },
        )
    )

    assert "Du 06/11/2026 au 06/11/2026 inclus" in text
    assert "Doublon refusé, " in text
    assert "Objets Documents" in text
    assert "(TEST001)" in text
    assert "Nombre de lignes 1" in text


@pytest.mark.asyncio
async def test_other_tenant_rows_are_not_printed(client_as, test_engine, db_seed):
    await _seed_logs(test_engine, db_seed)

    async with client_as(
        "auditor", tenant_id=uuid.uuid4(), id=db_seed["user_id"]
    ) as client:
        text = _text(await client.get(EXPORT, params=PDF))

    assert "Aucune ligne pour ces filtres." in text
    assert "10.0.0.7" not in text


@pytest.mark.asyncio
async def test_too_many_rows_for_a_pdf_is_422_but_csv_still_works(
    admin_client: AsyncClient, test_engine, db_seed, monkeypatch
):
    from app.api.v1.endpoints import audit

    await _seed_logs(test_engine, db_seed)
    monkeypatch.setattr(audit, "EXPORT_MAX_ROWS_PDF", 2)

    response = await admin_client.get(EXPORT, params=PDF)

    assert response.status_code == 422
    assert "exportez en CSV" in response.json()["detail"]
    assert await _export_rows(admin_client) == []
    csv_response = await admin_client.get(EXPORT)
    assert csv_response.status_code == 200
    assert csv_response.headers["content-type"].startswith("text/csv")


@pytest.mark.asyncio
async def test_csv_stays_the_default_and_its_log_is_unchanged(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed_logs(test_engine, db_seed)

    response = await admin_client.get(
        EXPORT, params={"format": "csv", "action": "upload"}
    )

    assert response.headers["content-type"].startswith("text/csv")
    assert "x-report-sha256" not in response.headers
    assert (await _export_rows(admin_client))[0]["new_data"] == {
        "rows": 1,
        "filters": {"action": "upload"},
    }


@pytest.mark.asyncio
async def test_unknown_format_is_422(admin_client: AsyncClient):
    assert (
        await admin_client.get(EXPORT, params={"format": "xlsx"})
    ).status_code == 422


@pytest.mark.asyncio
async def test_collaborator_cannot_export_a_pdf(auth_client: AsyncClient):
    assert (await auth_client.get(EXPORT, params=PDF)).status_code == 403
