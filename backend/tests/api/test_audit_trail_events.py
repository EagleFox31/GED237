"""Audit rows written for login, refused login, document upload and import commit (D3)."""

import io
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.models.audit import AuditLog

PASSWORD = "testpassword123"
WRONG_PASSWORD = "zzzzzzzzzz"
CREDENTIALS = {"institution": "TESTMIN", "matricule": "TEST001", "password": PASSWORD}


@pytest.fixture(autouse=True)
def generous_auth_limits(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_LOGIN_RATE_LIMIT", "1000/minute")
    monkeypatch.setattr(settings, "AUTH_OTP_RATE_LIMIT", "1000/minute")


@pytest.fixture
def storage_tmp_path(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path / "storage"))
    return tmp_path


async def _rows(db_session, action: str) -> list[AuditLog]:
    db_session.expire_all()
    result = await db_session.execute(
        select(AuditLog).where(AuditLog.action == action).order_by(AuditLog.created_at)
    )
    return list(result.scalars())


async def _start_login(client: AsyncClient) -> dict:
    response = await client.post("/api/v1/auth/login", json=CREDENTIALS)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.asyncio
async def test_login_is_logged_once_the_code_is_verified(
    async_client: AsyncClient, db_session, db_seed
):
    step1 = await _start_login(async_client)
    assert await _rows(db_session, "login") == []

    response = await async_client.post(
        "/api/v1/auth/verify-otp",
        json={"session_token": step1["session_token"], "otp": step1["otp"]},
    )
    assert response.status_code == 200, response.text

    [row] = await _rows(db_session, "login")
    assert (row.table_name, row.record_id, row.user_id, row.tenant_id) == (
        "users",
        db_seed["user_id"],
        db_seed["user_id"],
        db_seed["tenant_id"],
    )
    assert row.new_data["matricule"] == "TEST001"
    assert row.ip_address is not None


@pytest.mark.asyncio
async def test_wrong_password_is_logged_without_the_password(
    async_client: AsyncClient, db_session, db_seed
):
    response = await async_client.post(
        "/api/v1/auth/login", json={**CREDENTIALS, "password": WRONG_PASSWORD}
    )
    assert response.status_code == 401

    [row] = await _rows(db_session, "login_failed")
    assert row.record_id == db_seed["user_id"]
    assert row.new_data["reason"] == "mot de passe incorrect"
    assert WRONG_PASSWORD not in str(row.new_data)


@pytest.mark.asyncio
async def test_wrong_code_is_logged_without_the_code(
    async_client: AsyncClient, db_session, db_seed
):
    step1 = await _start_login(async_client)
    wrong = "000000" if step1["otp"] != "000000" else "111111"

    response = await async_client.post(
        "/api/v1/auth/verify-otp",
        json={"session_token": step1["session_token"], "otp": wrong},
    )
    assert response.status_code == 401

    [row] = await _rows(db_session, "login_failed")
    assert row.record_id == db_seed["user_id"]
    assert row.new_data["reason"] == "code de verification incorrect"
    assert wrong not in str(row.new_data)
    assert await _rows(db_session, "login") == []


@pytest.mark.asyncio
async def test_unknown_account_leaves_no_row(
    async_client: AsyncClient, db_session, db_seed
):
    response = await async_client.post(
        "/api/v1/auth/login", json={**CREDENTIALS, "matricule": "INCONNU"}
    )
    assert response.status_code == 401
    assert await _rows(db_session, "login_failed") == []


@pytest.mark.asyncio
async def test_upload_is_logged_on_the_document(
    auth_client: AsyncClient, db_session, db_seed, storage_tmp_path
):
    response = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("note.txt", io.BytesIO(b"note"), "text/plain")},
        data={"title": "Note de service", "processing_mode": "archive"},
    )
    assert response.status_code == 201, response.text

    [row] = await _rows(db_session, "upload")
    assert (row.table_name, row.record_id, row.user_id) == (
        "documents",
        uuid.UUID(response.json()["id"]),
        db_seed["user_id"],
    )
    assert row.new_data == {
        "title": "Note de service",
        "filename": "note.txt",
        "version": "1.0",
    }


@pytest.mark.asyncio
async def test_import_commit_is_logged_with_its_counts(
    auth_client: AsyncClient, db_session, db_seed, storage_tmp_path
):
    analyze = await auth_client.post(
        "/api/v1/imports/analyze",
        files=[("files", ("lot.txt", io.BytesIO(b"lot"), "text/plain"))],
        data={
            "source_scope": "service",
            "default_document_category_id": str(db_seed["category_id"]),
            "processing_mode": "archive",
        },
    )
    assert analyze.status_code == 201, analyze.text
    job_id = analyze.json()["id"]
    commit = await auth_client.post(f"/api/v1/imports/{job_id}/commit")
    assert commit.status_code == 200, commit.text

    [row] = await _rows(db_session, "import_committed")
    assert (row.table_name, row.record_id) == ("imports", uuid.UUID(job_id))
    assert sum(row.new_data.values()) == 1
    assert set(row.new_data) == {"imported", "pending_review", "failed"}


@pytest.mark.asyncio
async def test_login_rows_are_labelled_in_the_audit_list(
    async_client: AsyncClient, admin_client: AsyncClient, db_seed
):
    await async_client.post(
        "/api/v1/auth/login", json={**CREDENTIALS, "password": WRONG_PASSWORD}
    )

    response = await admin_client.get(
        "/api/v1/audit/logs", params={"table_name": "users", "action": "login_failed"}
    )
    assert response.status_code == 200, response.text
    [row] = response.json()
    assert (row["table_label"], row["action_label"]) == (
        "Utilisateurs",
        "Connexion refusee",
    )
    assert row["user_matricule"] == "TEST001"
