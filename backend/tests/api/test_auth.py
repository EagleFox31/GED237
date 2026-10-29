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
