"""The "Open" link of a document (F-NEXT-02): POST request-access, GET stream.

The link needs no Authorization header, so the stream route re-checks everything
the bearer token would have: link type and expiry, logout, active account, rights.
"""

import io
import uuid
from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from jose import jwt
from sqlalchemy import select, update

from app.api.v1.endpoints import documents as documents_module
from app.core.config import settings
from app.core.dependencies import get_current_user_ws
from app.core.security import (
    create_access_token,
    create_document_access_token,
    revoked_session_key,
)
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.user import User

CONTENT = b"signed-url-content-0123456789"


@pytest.fixture
def link_redis(fake_redis, monkeypatch):
    async def _get_redis():
        return fake_redis

    monkeypatch.setattr(documents_module, "get_redis", _get_redis)
    return fake_redis


async def _upload(client: AsyncClient, db_seed) -> str:
    response = await client.post(
        "/api/v1/documents/upload",
        files={"file": ("note-ouverture.txt", io.BytesIO(CONTENT), "text/plain")},
        data={
            "title": "note-ouverture",
            "document_category_id": str(db_seed["category_id"]),
            "processing_mode": "archive",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def _request_url(client: AsyncClient, document_id: str) -> str:
    response = await client.post(f"/api/v1/documents/{document_id}/request-access")
    assert response.status_code == 200, response.text
    return response.json()["url"]


async def _actions(db_session, document_id: str) -> list[str]:
    rows = await db_session.execute(
        select(AuditLog.action).where(AuditLog.record_id == uuid.UUID(document_id))
    )
    return list(rows.scalars())


@pytest.mark.asyncio
async def test_link_opens_the_document_without_authorization(
    auth_client: AsyncClient, db_session, db_seed, link_redis
):
    document_id = await _upload(auth_client, db_seed)

    issued = await auth_client.post(f"/api/v1/documents/{document_id}/request-access")
    assert issued.status_code == 200, issued.text
    body = issued.json()
    assert set(body) == {"url", "expires_at", "expires_in"}
    assert body["url"].startswith("/api/v1/documents/stream/")
    assert body["expires_in"] == settings.DOCUMENT_ACCESS_URL_TTL_SECONDS
    expires_at = datetime.fromisoformat(body["expires_at"].replace("Z", "+00:00"))
    assert expires_at.tzinfo is not None
    lifetime = (expires_at.replace(tzinfo=None) - datetime.utcnow()).total_seconds()
    assert 0 < lifetime <= settings.DOCUMENT_ACCESS_URL_TTL_SECONDS

    opened = await auth_client.get(body["url"])
    assert opened.status_code == 200, opened.text
    assert opened.content == CONTENT
    assert opened.headers["content-disposition"].startswith("inline;")
    assert opened.headers["x-content-type-options"] == "nosniff"
    assert opened.headers["content-security-policy"] == "default-src 'none'; sandbox"
    assert opened.headers["cache-control"].startswith("private")
    assert opened.headers["referrer-policy"] == "no-referrer"

    # A viewer reads by ranges: same link, no new audit row.
    ranged = await auth_client.get(body["url"], headers={"Range": "bytes=0-9"})
    assert ranged.status_code == 206
    assert ranged.content == CONTENT[:10]

    download = await auth_client.get(body["url"], params={"disposition": "attachment"})
    assert download.headers["content-disposition"].startswith("attachment;")

    actions = await _actions(db_session, document_id)
    assert actions.count("access_url_issued") == 1
    assert actions.count("content_opened") == 1


@pytest.mark.asyncio
async def test_each_link_is_audited_once(
    auth_client: AsyncClient, db_session, db_seed, link_redis
):
    document_id = await _upload(auth_client, db_seed)
    for _ in range(2):
        url = await _request_url(auth_client, document_id)
        assert (await auth_client.get(url)).status_code == 200

    actions = await _actions(db_session, document_id)
    assert actions.count("access_url_issued") == 2
    assert actions.count("content_opened") == 2


@pytest.mark.asyncio
async def test_request_access_on_an_unknown_document_is_404(auth_client: AsyncClient):
    response = await auth_client.post(
        f"/api/v1/documents/{uuid.uuid4()}/request-access"
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_stream_refuses_tokens_that_are_not_open_links(
    auth_client: AsyncClient, db_seed, link_redis
):
    document_id = await _upload(auth_client, db_seed)
    url = await _request_url(auth_client, document_id)
    link_token = url.rsplit("/", 1)[1]

    access_token = create_access_token(
        {"sub": str(db_seed["user_id"]), "tenant_id": str(db_seed["tenant_id"])}
    )
    expired = jwt.encode(
        {
            "type": "document_access",
            "doc": document_id,
            "sub": str(db_seed["user_id"]),
            "tenant_id": str(db_seed["tenant_id"]),
            "jti": "expired",
            "exp": datetime.utcnow() - timedelta(seconds=5),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    tampered = link_token[:-2] + ("AA" if link_token[-2:] != "AA" else "BB")
    for token in (access_token, expired, tampered, "not-a-token"):
        response = await auth_client.get(f"/api/v1/documents/stream/{token}")
        assert response.status_code == 401, token

    # And the link is no bearer token for the rest of the API.
    assert await get_current_user_ws(link_token) is None


@pytest.mark.asyncio
async def test_link_dies_with_the_login_session(
    auth_client: AsyncClient, db_seed, link_redis
):
    document_id = await _upload(auth_client, db_seed)
    token, _, _ = create_document_access_token(
        document_id=document_id,
        user_id=str(db_seed["user_id"]),
        tenant_id=str(db_seed["tenant_id"]),
        session_id="session-logged-out",
    )
    assert (
        await auth_client.get(f"/api/v1/documents/stream/{token}")
    ).status_code == 200

    await link_redis.set(revoked_session_key("session-logged-out"), "1")
    assert (
        await auth_client.get(f"/api/v1/documents/stream/{token}")
    ).status_code == 401


@pytest.mark.asyncio
async def test_link_refused_once_the_account_is_disabled(
    auth_client: AsyncClient, db_session, db_seed, link_redis
):
    document_id = await _upload(auth_client, db_seed)
    url = await _request_url(auth_client, document_id)

    await db_session.execute(
        update(User).where(User.id == db_seed["user_id"]).values(is_active=False)
    )
    await db_session.commit()

    assert (await auth_client.get(url)).status_code == 401


@pytest.mark.asyncio
async def test_link_refused_once_the_document_is_no_longer_readable(
    auth_client: AsyncClient, db_session, db_seed, link_redis
):
    """A collaborator reads only their own documents: hand it over, the link dies."""
    document_id = await _upload(auth_client, db_seed)
    url = await _request_url(auth_client, document_id)

    other = User(
        id=uuid.uuid4(),
        email="autre@testministry.gov.cm",
        password_hash="fakehash",
        first_name="Autre",
        last_name="Agent",
        matricule="TEST002",
        role_id=db_seed["role_id"],
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        is_active=True,
    )
    db_session.add(other)
    await db_session.flush()
    await db_session.execute(
        update(Document)
        .where(Document.id == uuid.UUID(document_id))
        .values(owner_id=other.id)
    )
    await db_session.commit()

    assert (await auth_client.get(url)).status_code == 404
