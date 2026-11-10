"""Lot 3a (V1.1): CSV export of the audit journal."""

import csv
import io
import uuid
from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.audit import AuditLog

EXPORT = "/api/v1/audit/logs/export"
HEADER = [
    "Date",
    "Matricule",
    "Utilisateur",
    "Objet",
    "Ressource",
    "Action",
    "Détail",
    "Adresse IP",
]


async def _seed_logs(test_engine, db_seed, *, tenant_id=None) -> None:
    """Three rows of the seeded tenant, stored as naive UTC like the database default."""
    tenant_id = tenant_id or db_seed["tenant_id"]
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
                    tenant_id=tenant_id,
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


def _rows(response) -> list[list[str]]:
    assert response.status_code == 200, response.text
    assert response.content.startswith("﻿".encode("utf-8"))
    return list(
        csv.reader(io.StringIO(response.content.decode("utf-8-sig")), delimiter=";")
    )


@pytest.mark.asyncio
async def test_export_is_a_french_excel_csv(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed_logs(test_engine, db_seed)

    response = await admin_client.get(EXPORT)

    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["content-disposition"].startswith(
        'attachment; filename="journal-audit-'
    )
    rows = _rows(response)
    assert rows[0] == HEADER
    assert len(rows) == 4
    newest = rows[1]
    # 23:30 UTC on the 5th is 00:30 on the 6th in Cameroon.
    assert newest[0] == "2026-11-06T00:30:00+01:00"
    assert newest[1] == "TEST001"
    assert newest[5] == "Doublon refuse"
    assert newest[7] == "10.0.0.7"
    # The first export is logged, so a second export shows one more line.
    assert len(_rows(await admin_client.get(EXPORT))) == 5


@pytest.mark.asyncio
async def test_filters_and_local_dates(admin_client: AsyncClient, test_engine, db_seed):
    await _seed_logs(test_engine, db_seed)

    by_action = _rows(await admin_client.get(EXPORT, params={"action": "dup_detected"}))
    local_day = _rows(
        await admin_client.get(
            EXPORT, params={"date_from": "2026-11-06", "date_to": "2026-11-06"}
        )
    )
    after_all = _rows(
        await admin_client.get(
            EXPORT, params={"date_from": "2026-11-07", "table_name": "documents"}
        )
    )

    assert len(by_action) == 2 and by_action[1][5] == "Doublon refuse"
    assert len(local_day) == 2 and local_day[1][0].startswith("2026-11-06")
    assert after_all == [HEADER]


@pytest.mark.asyncio
async def test_other_tenant_rows_are_not_exported(client_as, test_engine, db_seed):
    await _seed_logs(test_engine, db_seed)

    async with client_as(
        "auditor", tenant_id=uuid.uuid4(), id=db_seed["user_id"]
    ) as client:
        rows = _rows(await client.get(EXPORT))

    assert rows == [HEADER]


@pytest.mark.asyncio
async def test_collaborator_is_forbidden(auth_client: AsyncClient):
    assert (await auth_client.get(EXPORT)).status_code == 403


@pytest.mark.asyncio
async def test_export_is_logged_with_row_count_and_filters(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed_logs(test_engine, db_seed)

    await admin_client.get(EXPORT, params={"action": "upload"})
    logged = (
        await admin_client.get(
            "/api/v1/audit/logs", params={"table_name": "audit_logs"}
        )
    ).json()

    assert len(logged) == 1
    assert logged[0]["action"] == "exported"
    assert logged[0]["new_data"] == {"rows": 1, "filters": {"action": "upload"}}


@pytest.mark.asyncio
async def test_too_many_rows_is_422(
    admin_client: AsyncClient, test_engine, db_seed, monkeypatch
):
    from app.api.v1.endpoints import audit

    await _seed_logs(test_engine, db_seed)
    monkeypatch.setattr(audit, "EXPORT_MAX_ROWS", 2)

    response = await admin_client.get(EXPORT)

    assert response.status_code == 422
    assert "affinez" in response.json()["detail"]


async def _add_log(test_engine, db_seed, *, title: str, created_at: datetime) -> None:
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        session.add(
            AuditLog(
                tenant_id=db_seed["tenant_id"],
                user_id=db_seed["user_id"],
                table_name="documents",
                record_id=uuid.uuid4(),
                action="upload",
                new_data={"title": title},
                created_at=created_at,
            )
        )
        await session.commit()


@pytest.mark.asyncio
async def test_formula_in_a_file_name_is_exported_as_text(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _add_log(
        test_engine, db_seed, title="=1+1.pdf", created_at=datetime(2026, 11, 5)
    )
    await _add_log(
        test_engine, db_seed, title="@SUM(A1)", created_at=datetime(2026, 11, 4)
    )

    rows = _rows(await admin_client.get(EXPORT))

    assert [row[4] for row in rows[1:]] == ["'=1+1.pdf", "'@SUM(A1)"]


@pytest.mark.asyncio
async def test_rows_logged_after_the_export_started_are_left_out(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed_logs(test_engine, db_seed)
    # Stands for a row written while the export pages are being read.
    await _add_log(
        test_engine, db_seed, title="pendant", created_at=datetime(2099, 1, 1)
    )

    rows = _rows(await admin_client.get(EXPORT))

    assert len(rows) == 4
    assert "pendant" not in {row[4] for row in rows}


@pytest.mark.asyncio
async def test_several_tables_and_actions_match_any_of_them(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed_logs(test_engine, db_seed)

    response = await admin_client.get(
        f"{EXPORT}?table_name=users&table_name=documents&action=LOGIN&action=upload"
    )
    one_table = _rows(await admin_client.get(EXPORT, params={"table_name": "users"}))

    rows = _rows(response)
    # login (users) and upload (documents) match; dup_detected does not.
    assert len(rows) == 3
    assert "Doublon refuse" not in {row[5] for row in rows}
    assert len(one_table) == 2
    logged = (
        await admin_client.get(
            "/api/v1/audit/logs", params={"table_name": "audit_logs"}
        )
    ).json()
    assert {
        "table_name": ["users", "documents"],
        "action": ["LOGIN", "upload"],
    } in [entry["new_data"]["filters"] for entry in logged]


@pytest.mark.asyncio
async def test_user_filter_keeps_only_that_user(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed_logs(test_engine, db_seed)
    await _add_log(
        test_engine, db_seed, title="autre agent", created_at=datetime(2026, 11, 2)
    )
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        session.add(
            AuditLog(
                tenant_id=db_seed["tenant_id"],
                user_id=None,
                table_name="documents",
                record_id=uuid.uuid4(),
                action="upload",
                new_data={"title": "systeme"},
                created_at=datetime(2026, 11, 1),
            )
        )
        await session.commit()

    mine = _rows(
        await admin_client.get(EXPORT, params={"user_id": str(db_seed["user_id"])})
    )
    nobody = _rows(
        await admin_client.get(EXPORT, params={"user_id": str(uuid.uuid4())})
    )

    assert len(mine) == 5
    assert "systeme" not in {row[4] for row in mine}
    assert nobody == [HEADER]
