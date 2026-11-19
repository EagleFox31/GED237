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
async def test_parallel_refreshes_share_one_pair(async_client: AsyncClient, db_seed):
    """#414: calls sent together at expiry all succeed with the same new pair,
    so a replay never opens a second chain."""
    import asyncio

    tokens = await _full_login(async_client, db_seed)
    responses = await asyncio.gather(
        *(_refresh(async_client, tokens["refresh_token"]) for _ in range(3))
    )
    assert [r.status_code for r in responses] == [200, 200, 200]
    pairs = {(r.json()["access_token"], r.json()["refresh_token"]) for r in responses}
    assert len(pairs) == 1
    assert responses[0].json()["refresh_token"] != tokens["refresh_token"]


@pytest.mark.asyncio
async def test_replay_after_the_window_is_refused(
    async_client: AsyncClient, db_seed, monkeypatch
):
    """#414: once the reuse window is over, the rotated token is refused."""
    import asyncio

    from app.core.config import settings

    monkeypatch.setattr(settings, "REFRESH_REUSE_WINDOW_SECONDS", 1)
    tokens = await _full_login(async_client, db_seed)
    first = await _refresh(async_client, tokens["refresh_token"])
    assert first.status_code == 200
    await asyncio.sleep(1.3)

    assert (await _refresh(async_client, tokens["refresh_token"])).status_code == 401
    # The rotated token keeps working.
    assert (
        await _refresh(async_client, first.json()["refresh_token"])
    ).status_code == 200


@pytest.mark.asyncio
async def test_window_zero_is_strict_single_use(
    async_client: AsyncClient, db_seed, monkeypatch
):
    from app.core.config import settings

    monkeypatch.setattr(settings, "REFRESH_REUSE_WINDOW_SECONDS", 0)
    tokens = await _full_login(async_client, db_seed)
    assert (await _refresh(async_client, tokens["refresh_token"])).status_code == 200
    assert (await _refresh(async_client, tokens["refresh_token"])).status_code == 401


@pytest.mark.asyncio
async def test_logout_ends_the_reuse_window(async_client: AsyncClient, db_seed):
    """#414: after logout, replaying the previous refresh token within the
    window does not hand the revoked pair back."""
    tokens = await _full_login(async_client, db_seed)
    new = (await _refresh(async_client, tokens["refresh_token"])).json()
    logout = await async_client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": new["refresh_token"]},
        headers={"Authorization": f"Bearer {new['access_token']}"},
    )
    assert logout.status_code == 200
    assert (await _refresh(async_client, tokens["refresh_token"])).status_code == 401
    assert (await _refresh(async_client, new["refresh_token"])).status_code == 401


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
async def test_deactivated_account_is_refused_within_the_window(
    async_client: AsyncClient, db_seed, test_engine
):
    """#414: the pair kept for the reuse window is not served again once the
    account is deactivated; the account is re-read before every reuse."""
    from sqlalchemy import update

    from app.models.user import User

    tokens = await _full_login(async_client, db_seed)
    assert (await _refresh(async_client, tokens["refresh_token"])).status_code == 200
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


@pytest.mark.asyncio
async def test_refresh_token_is_refused_on_protected_routes(
    async_client: AsyncClient, db_seed
):
    """Only an access token opens an HTTP route; the refresh token keeps its own use."""
    tokens = await _full_login(async_client, db_seed)

    refused = await async_client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {tokens['refresh_token']}"},
    )
    assert refused.status_code == 401

    refreshed = await async_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refreshed.status_code == 200

    for access in (tokens["access_token"], refreshed.json()["access_token"]):
        me = await async_client.get(
            "/api/v1/users/me", headers={"Authorization": f"Bearer {access}"}
        )
        assert me.status_code == 200
        assert me.json()["matricule"] == "TEST001"


@pytest.mark.asyncio
async def test_websocket_auth_refuses_refresh_and_revoked_tokens(
    async_client: AsyncClient, db_seed
):
    """The WebSocket follows the HTTP rules: no refresh token, no token revoked by a logout."""
    from app.core.dependencies import get_current_user_ws

    tokens = await _full_login(async_client, db_seed)
    assert await get_current_user_ws(tokens["refresh_token"]) is None

    logout = await async_client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert logout.status_code == 200
    assert await get_current_user_ws(tokens["access_token"]) is None


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_logout_revokes_the_whole_login_session(
    async_client: AsyncClient, db_seed
):
    """After logout, neither the refresh token nor an access token it issued still works."""
    tokens = await _full_login(async_client, db_seed)
    refreshed = await async_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refreshed.status_code == 200
    sibling = refreshed.json()["access_token"]
    assert (
        await async_client.get("/api/v1/users/me", headers=_bearer(sibling))
    ).status_code == 200

    logout = await async_client.post(
        "/api/v1/auth/logout", headers=_bearer(tokens["access_token"])
    )
    assert logout.status_code == 200

    for refresh in (tokens["refresh_token"], refreshed.json()["refresh_token"]):
        again = await async_client.post(
            "/api/v1/auth/refresh", json={"refresh_token": refresh}
        )
        assert again.status_code == 401
    assert (
        await async_client.get("/api/v1/users/me", headers=_bearer(sibling))
    ).status_code == 401


@pytest.mark.asyncio
async def test_logout_leaves_other_sessions_open(async_client: AsyncClient, db_seed):
    first = await _full_login(async_client, db_seed)
    second = await _full_login(async_client, db_seed)
    await async_client.post(
        "/api/v1/auth/logout", headers=_bearer(first["access_token"])
    )

    assert (
        await async_client.get(
            "/api/v1/users/me", headers=_bearer(second["access_token"])
        )
    ).status_code == 200
    refreshed = await async_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": second["refresh_token"]}
    )
    assert refreshed.status_code == 200


@pytest.mark.asyncio
async def test_token_issued_before_sessions_gets_one_at_refresh(
    async_client: AsyncClient, db_seed
):
    """Retroactive: a refresh token without ``sid`` still works, and is revocable afterwards."""
    from app.core.security import create_refresh_token, decode_token

    legacy = create_refresh_token(
        {
            "sub": str(db_seed["user_id"]),
            "tenant_id": str(db_seed["tenant_id"]),
            "role": "collaborator",
            "matricule": "TEST001",
        }
    )
    refreshed = await async_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": legacy}
    )
    assert refreshed.status_code == 200
    body = refreshed.json()
    assert decode_token(body["access_token"])["sid"]
    assert (
        decode_token(body["refresh_token"])["sid"]
        == decode_token(body["access_token"])["sid"]
    )

    await async_client.post(
        "/api/v1/auth/logout", headers=_bearer(body["access_token"])
    )
    again = await async_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": body["refresh_token"]}
    )
    assert again.status_code == 401


@pytest.mark.asyncio
async def test_tenant_dependency_applies_the_same_checks(
    async_client: AsyncClient, db_seed
):
    """get_current_tenant_id refuses refresh and revoked tokens like get_current_user_id."""
    from fastapi import HTTPException
    from fastapi.security import HTTPAuthorizationCredentials

    from app.core.dependencies import get_current_tenant_id

    def creds(token: str) -> HTTPAuthorizationCredentials:
        return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    tokens = await _full_login(async_client, db_seed)
    assert await get_current_tenant_id(creds(tokens["access_token"])) == str(
        db_seed["tenant_id"]
    )

    for token in (tokens["refresh_token"], "not-a-token"):
        with pytest.raises(HTTPException) as refused:
            await get_current_tenant_id(creds(token))
        assert refused.value.status_code == 401

    await async_client.post(
        "/api/v1/auth/logout", headers=_bearer(tokens["access_token"])
    )
    with pytest.raises(HTTPException) as revoked:
        await get_current_tenant_id(creds(tokens["access_token"]))
    assert revoked.value.status_code == 401
