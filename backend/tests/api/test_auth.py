# backend/tests/api/test_auth.py
from httpx import AsyncClient
import pytest


@pytest.mark.asyncio
async def test_login_invalid_credentials(async_client: AsyncClient, db_seed):
    """Test that invalid login credentials return 401."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "institution": "TESTMIN",
            "matricule": "wrong_matricule",
            "password": "wrongpassword",
        },
    )
    # Auth service raises AuthenticationError → endpoint returns 401
    assert response.status_code == 401
    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_protected_route_without_token(async_client: AsyncClient):
    """Test accessing a protected route without a JWT token returns 403."""
    response = await async_client.get("/api/v1/users/me")
    # HTTPBearer returns 403 when no credentials are provided
    assert response.status_code == 403


async def _full_login(client: AsyncClient, db_seed) -> dict:
    """Helper: complete the 2FA flow (login → verify-otp) and return token response."""
    # Step 1 — credentials
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={
            "institution": "TESTMIN",
            "matricule": "TEST001",
            "password": "testpassword123",
        },
    )
    assert login_resp.status_code == 200, f"Login step 1 failed: {login_resp.text}"
    step1 = login_resp.json()
    assert "session_token" in step1
    # In development mode the OTP is returned in the response
    assert "otp" in step1, "OTP not returned (check ENVIRONMENT=development)"

    # Step 2 — OTP verification
    otp_resp = await client.post(
        "/api/v1/auth/verify-otp",
        json={"session_token": step1["session_token"], "otp": step1["otp"]},
    )
    assert otp_resp.status_code == 200, f"OTP verify failed: {otp_resp.text}"
    return otp_resp.json()


@pytest.mark.asyncio
async def test_login_success_and_me(async_client: AsyncClient, db_seed):
    """Full 2FA login returns expected tokens and grants access to /users/me."""
    tokens = await _full_login(async_client, db_seed)

    assert "access_token" in tokens
    assert "refresh_token" in tokens
    assert tokens["token_type"] == "bearer"
    assert "user" in tokens
    assert tokens["user"]["matricule"] == "TEST001"

    # Verify protected route works with the newly acquired token
    me_response = await async_client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["matricule"] == "TEST001"


@pytest.mark.asyncio
async def test_refresh_token(async_client: AsyncClient, db_seed):
    """Test refreshing an access token returns a new valid pair."""
    tokens = await _full_login(async_client, db_seed)
    refresh_token = tokens["refresh_token"]

    refresh_response = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )

    assert refresh_response.status_code == 200
    data = refresh_response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


async def _refresh(client: AsyncClient, refresh_token: str):
    return await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
    )


async def _run_sql(test_engine, statement) -> None:
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    async with async_sessionmaker(test_engine, class_=AsyncSession)() as session:
        await session.execute(statement)
        await session.commit()


@pytest.mark.asyncio
async def test_refresh_token_is_single_use(async_client: AsyncClient, db_seed):
    """#414: a rotated refresh token cannot be replayed."""
    tokens = await _full_login(async_client, db_seed)
    first = await _refresh(async_client, tokens["refresh_token"])
    assert first.status_code == 200
    assert first.json()["refresh_token"] != tokens["refresh_token"]

    replay = await _refresh(async_client, tokens["refresh_token"])
    assert replay.status_code == 401
    # The rotated token keeps working.
    assert (
        await _refresh(async_client, first.json()["refresh_token"])
    ).status_code == 200


@pytest.mark.asyncio
async def test_refresh_refused_after_logout(async_client: AsyncClient, db_seed):
    """#414: logout with the refresh token revokes it."""
    tokens = await _full_login(async_client, db_seed)
    logout = await async_client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": tokens["refresh_token"]},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert logout.status_code == 200
    assert (await _refresh(async_client, tokens["refresh_token"])).status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("body", [None, {"refresh_token": None}])
async def test_logout_without_refresh_token_still_works(
    async_client: AsyncClient, db_seed, body
):
    """Former clients send no body, the front sends null when nothing is
    stored: the access token is still revoked."""
    tokens = await _full_login(async_client, db_seed)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    assert (
        await async_client.post("/api/v1/auth/logout", headers=headers, json=body)
    ).status_code == 200
    assert (
        await async_client.get("/api/v1/users/me", headers=headers)
    ).status_code == 401


@pytest.mark.asyncio
async def test_refresh_refused_for_deactivated_account(
    async_client: AsyncClient, db_seed, test_engine
):
    """#414: a deactivated account cannot extend its session."""
    from sqlalchemy import update

    from app.models.user import User

    tokens = await _full_login(async_client, db_seed)
    await _run_sql(
        test_engine,
        update(User).where(User.id == db_seed["user_id"]).values(is_active=False),
    )
    assert (await _refresh(async_client, tokens["refresh_token"])).status_code == 401


@pytest.mark.asyncio
async def test_refresh_reads_current_role(
    async_client: AsyncClient, db_seed, test_engine
):
    """#414: a role changed after login applies at the next refresh."""
    from sqlalchemy import select, update

    from app.core.security import decode_token
    from app.models.role import Role
    from app.models.user import User

    tokens = await _full_login(async_client, db_seed)
    await _run_sql(
        test_engine,
        update(Role)
        .where(
            Role.id
            == select(User.role_id)
            .where(User.id == db_seed["user_id"])
            .scalar_subquery()
        )
        .values(code="reader"),
    )
    response = await _refresh(async_client, tokens["refresh_token"])
    assert response.status_code == 200
    assert decode_token(response.json()["access_token"])["role"] == "reader"


@pytest.mark.asyncio
async def test_login_without_demo_hints_keeps_the_code_out_of_the_response(
    async_client: AsyncClient, db_seed, monkeypatch, caplog
):
    """LOGIN_DEMO_HINTS=false: the code is in the API log, not in the response."""
    import logging

    from app.core.config import settings

    monkeypatch.setattr(settings, "LOGIN_DEMO_HINTS", False)
    with caplog.at_level(logging.WARNING, logger="app.services.auth_service"):
        response = await async_client.post(
            "/api/v1/auth/login",
            json={
                "institution": "TESTMIN",
                "matricule": "TEST001",
                "password": "testpassword123",
            },
        )

    assert response.status_code == 200, response.text
    step1 = response.json()
    # LoginResponse always serializes the field: null here.
    assert step1.get("otp") is None
    logged = [r.getMessage() for r in caplog.records if "Code OTP" in r.getMessage()]
    assert len(logged) == 1 and "TEST001" in logged[0]
    code = logged[0].split(" : ")[1].split(" ")[0]
    otp_resp = await async_client.post(
        "/api/v1/auth/verify-otp",
        json={"session_token": step1["session_token"], "otp": code},
    )
    assert otp_resp.status_code == 200, otp_resp.text
