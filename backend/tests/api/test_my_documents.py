"""« Mes documents »: favourites, recently opened, shared with me."""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, update

from app.core.config import settings
from app.models.document import Document
from app.models.my_documents import DocumentFavorite, DocumentRecentAccess
from app.models.org_unit import OrgUnit
from app.models.user import User
from app.models.workflow import WorkflowStep

ME = "/api/v1/me"


async def _count(db_session, model) -> int:
    return await db_session.scalar(select(func.count()).select_from(model))


def _doc(db_seed, title: str, *, owner_id=None, org_unit_id=None, **fields) -> Document:
    return Document(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=org_unit_id or db_seed["org_unit_id"],
        owner_id=owner_id or db_seed["user_id"],
        title=title,
        file_path=f"x/{title}.pdf",
        **fields,
    )


async def _add(db_session, *rows):
    db_session.add_all(rows)
    await db_session.commit()
    return rows if len(rows) > 1 else rows[0]


async def _user(db_session, db_seed, matricule: str, org_unit_id=None) -> User:
    return await _add(
        db_session,
        User(
            id=uuid.uuid4(),
            tenant_id=db_seed["tenant_id"],
            org_unit_id=org_unit_id or db_seed["org_unit_id"],
            role_id=db_seed["role_id"],
            matricule=matricule,
            email=f"{matricule.lower()}@testministry.gov.cm",
            first_name="Agent",
            last_name=matricule,
            password_hash="x",
            is_active=True,
        ),
    )


async def _other_unit(db_session, db_seed) -> OrgUnit:
    return await _add(
        db_session,
        OrgUnit(
            id=uuid.uuid4(),
            tenant_id=db_seed["tenant_id"],
            code="DIR-AUTRE",
            name="Autre direction",
            level=1,
            is_active=True,
        ),
    )


def _ids(response) -> list[str]:
    return [item["id"] for item in response.json()]


@pytest.mark.asyncio
async def test_favorite_is_idempotent_and_listed(
    admin_client: AsyncClient, db_session, db_seed
):
    document = await _add(db_session, _doc(db_seed, "note"))
    path = f"{ME}/favorites/{document.id}"

    assert (await admin_client.put(path)).status_code == 204
    assert (await admin_client.put(path)).status_code == 204
    assert await _count(db_session, DocumentFavorite) == 1

    listed = await admin_client.get(f"{ME}/favorites")
    assert listed.status_code == 200
    assert listed.headers["x-total-count"] == "1"
    [item] = listed.json()
    assert item["id"] == str(document.id)
    assert item["is_favorite"] is True
    assert item["marked_at"] is not None

    assert (await admin_client.delete(path)).status_code == 204
    assert (await admin_client.delete(path)).status_code == 204
    assert (await admin_client.get(f"{ME}/favorites")).json() == []


@pytest.mark.asyncio
async def test_trashed_document_leaves_the_lists(
    admin_client: AsyncClient, db_session, db_seed
):
    document = await _add(db_session, _doc(db_seed, "note"))
    assert (await admin_client.put(f"{ME}/favorites/{document.id}")).status_code == 204

    await db_session.execute(
        update(Document)
        .where(Document.id == document.id)
        .values(deleted_at=datetime(2026, 11, 2, tzinfo=timezone.utc))
    )
    await db_session.commit()
    assert (await admin_client.get(f"{ME}/favorites")).json() == []
    assert (await admin_client.put(f"{ME}/favorites/{document.id}")).status_code == 404
    assert (await admin_client.put(f"{ME}/favorites/{uuid.uuid4()}")).status_code == 404

    await db_session.execute(
        update(Document).where(Document.id == document.id).values(deleted_at=None)
    )
    await db_session.commit()
    assert _ids(await admin_client.get(f"{ME}/favorites")) == [str(document.id)]


@pytest.mark.asyncio
async def test_collaborator_cannot_mark_a_hidden_document(
    client_as, db_session, db_seed
):
    agent = await _user(db_session, db_seed, "AGENT01")
    other = await _add(db_session, _doc(db_seed, "autre"))
    mine = await _add(db_session, _doc(db_seed, "mien", owner_id=agent.id))

    async with client_as(
        "collaborator",
        id=agent.id,
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        hidden = await client.put(f"{ME}/favorites/{other.id}")
        own = await client.put(f"{ME}/favorites/{mine.id}")
        listed = await client.get(f"{ME}/favorites")
    assert hidden.status_code == 403
    assert own.status_code == 204
    assert _ids(listed) == [str(mine.id)]


@pytest.mark.asyncio
async def test_recent_is_not_tracked_by_default(
    admin_client: AsyncClient, db_session, db_seed
):
    origin = settings.ALLOWED_ORIGINS[0]
    document = await _add(db_session, _doc(db_seed, "note"))
    opened = await admin_client.get(f"/api/v1/documents/{document.id}")
    assert opened.status_code == 200
    assert await _count(db_session, DocumentRecentAccess) == 0
    listed = await admin_client.get(f"{ME}/recent", headers={"Origin": origin})
    assert listed.json() == []
    assert listed.headers["x-recent-tracking-enabled"] == "false"
    # Readable by the frontend, which is served from another origin in dev.
    assert "x-recent-tracking-enabled" in (
        listed.headers["access-control-expose-headers"].lower()
    )


@pytest.mark.asyncio
async def test_recent_keeps_the_latest_documents_when_tracking_is_on(
    admin_client: AsyncClient, db_session, db_seed, monkeypatch
):
    monkeypatch.setattr(settings, "RECENT_DOCUMENTS_TRACKING_ENABLED", True)
    monkeypatch.setattr(settings, "RECENT_DOCUMENTS_MAX_PER_USER", 2)
    a, b, c = await _add(
        db_session, _doc(db_seed, "a"), _doc(db_seed, "b"), _doc(db_seed, "c")
    )

    for document in (a, b, a):
        opened = await admin_client.get(f"/api/v1/documents/{document.id}")
        assert opened.status_code == 200
    listed = await admin_client.get(f"{ME}/recent")
    assert _ids(listed) == [str(a.id), str(b.id)]
    assert listed.headers["x-recent-tracking-enabled"] == "true"
    count_a = await db_session.scalar(
        select(DocumentRecentAccess.access_count).where(
            DocumentRecentAccess.document_id == a.id
        )
    )
    assert count_a == 2

    await admin_client.get(f"/api/v1/documents/{c.id}")
    assert _ids(await admin_client.get(f"{ME}/recent")) == [str(c.id), str(a.id)]
    assert await _count(db_session, DocumentRecentAccess) == 2

    assert (await admin_client.delete(f"{ME}/recent")).status_code == 204
    assert (await admin_client.get(f"{ME}/recent")).json() == []


@pytest.mark.asyncio
async def test_shared_lists_assigned_then_visible_documents(
    client_as, db_session, db_seed
):
    manager = await _user(db_session, db_seed, "CHEF01")
    unit = await _other_unit(db_session, db_seed)
    mine = _doc(db_seed, "mien", owner_id=manager.id)
    visible = _doc(db_seed, "visible")
    assigned = _doc(db_seed, "assigne", org_unit_id=unit.id)
    elsewhere = _doc(db_seed, "ailleurs", org_unit_id=unit.id)
    trashed = _doc(
        db_seed, "corbeille", deleted_at=datetime(2026, 11, 2, tzinfo=timezone.utc)
    )
    await _add(db_session, mine, visible, assigned, elsewhere, trashed)
    await _add(
        db_session,
        WorkflowStep(
            document_id=assigned.id,
            step_order=1,
            label="Visa",
            status="current",
            assigned_to=manager.id,
        ),
    )

    async with client_as(
        "manager",
        id=manager.id,
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        shared = await client.get(f"{ME}/shared")
        only_assigned = await client.get(f"{ME}/shared", params={"reason": "assigned"})
        only_visible = await client.get(f"{ME}/shared", params={"reason": "visible"})
        marked = await client.put(f"{ME}/favorites/{assigned.id}")
        hidden = await client.put(f"{ME}/favorites/{elsewhere.id}")

    assert shared.status_code == 200
    assert shared.headers["x-total-count"] == "2"
    assert [(item["title"], item["reason"]) for item in shared.json()] == [
        ("assigne", "assigned"),
        ("visible", "visible"),
    ]
    assert _ids(only_assigned) == [str(assigned.id)]
    assert _ids(only_visible) == [str(visible.id)]
    assert marked.status_code == 204
    assert hidden.status_code == 403


@pytest.mark.asyncio
async def test_foreign_tenant_sees_nothing(client_as, db_session, db_seed):
    document = await _add(db_session, _doc(db_seed, "note"))
    async with client_as("tenant_admin", tenant_id=uuid.uuid4()) as client:
        responses = [
            await client.get(f"{ME}/{name}")
            for name in ("favorites", "recent", "shared")
        ]
        marked = await client.put(f"{ME}/favorites/{document.id}")
    for response in responses:
        assert response.status_code == 200
        assert response.json() == []
        assert response.headers["x-total-count"] == "0"
    assert marked.status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path, params",
    [
        ("favorites", {"limit": 201}),
        ("recent", {"limit": 0}),
        ("shared", {"reason": "unknown"}),
        ("shared", {"skip": -1}),
    ],
)
async def test_outside_contract_is_422(admin_client: AsyncClient, path, params):
    response = await admin_client.get(f"{ME}/{path}", params=params)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_bad_document_id_is_422(admin_client: AsyncClient):
    assert (await admin_client.put(f"{ME}/favorites/not-a-uuid")).status_code == 422
