"""Duplicates view: groups of identical documents, keep one, trash the others."""

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.models.audit import AuditLog
from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.user import User
from app.models.workflow import WorkflowStep

DUPLICATES = "/api/v1/duplicates"
RESOLVE = f"{DUPLICATES}/resolve"
SHA_A = "a" * 64
SHA_B = "b" * 64


async def _doc(
    db_session, db_seed, title: str, checksum, *, day: int, owner_id=None, **fields
) -> Document:
    document = Document(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        owner_id=owner_id or db_seed["user_id"],
        title=title,
        file_path=f"x/{title}.pdf",
        created_at=datetime(2026, 11, day, 8, 0),
        **fields,
    )
    db_session.add(document)
    await db_session.flush()
    if checksum is not None:
        version = DocumentVersion(
            id=uuid.uuid4(),
            document_id=document.id,
            version_number="1.0",
            file_path=document.file_path,
            checksum_sha256=checksum,
            uploaded_at=datetime.now(timezone.utc),
        )
        db_session.add(version)
        await db_session.flush()
        document.current_version_id = version.id
    await db_session.commit()
    return document


async def _trash_audits(db_session) -> int:
    return await db_session.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(AuditLog.action == "document_trashed")
    )


async def _is_trashed(db_session, document: Document) -> bool:
    deleted_at = await db_session.scalar(
        select(Document.deleted_at)
        .where(Document.id == document.id)
        .execution_options(populate_existing=True)
    )
    return deleted_at is not None


@pytest.fixture
async def groups(db_session, db_seed):
    """Three copies of A, two of B, one single document, a trashed copy of A, and a
    document without version."""
    a1 = await _doc(db_session, db_seed, "a1", SHA_A, day=1)
    a2 = await _doc(db_session, db_seed, "a2", SHA_A, day=3)
    a3 = await _doc(db_session, db_seed, "a3", SHA_A, day=5)
    b1 = await _doc(db_session, db_seed, "b1", SHA_B, day=2)
    b2 = await _doc(db_session, db_seed, "b2", SHA_B, day=9)
    single = await _doc(db_session, db_seed, "seul", "c" * 64, day=4)
    trashed = await _doc(
        db_session,
        db_seed,
        "a-corbeille",
        SHA_A,
        day=6,
        deleted_at=datetime(2026, 11, 7, tzinfo=timezone.utc),
    )
    await _doc(db_session, db_seed, "sans-version", None, day=8)
    return {
        "a": [a1, a2, a3],
        "b": [b1, b2],
        "single": single,
        "trashed": trashed,
    }


def _ids(documents) -> list[str]:
    return [str(document.id) for document in documents]


@pytest.mark.asyncio
async def test_groups_largest_first_members_oldest_first(
    admin_client: AsyncClient, groups
):
    response = await admin_client.get(DUPLICATES)
    assert response.status_code == 200, response.text
    assert response.headers["x-total-count"] == "2"
    first, second = response.json()
    assert (first["checksum"], first["count"]) == (SHA_A, 3)
    assert [member["id"] for member in first["documents"]] == _ids(groups["a"])
    assert first["suggested_keep_id"] == str(groups["a"][0].id)
    assert first["documents"][0]["org_unit_name"]
    assert (second["checksum"], second["count"]) == (SHA_B, 2)

    paged = await admin_client.get(DUPLICATES, params={"skip": 1, "limit": 1})
    assert paged.headers["x-total-count"] == "2"
    assert [group["checksum"] for group in paged.json()] == [SHA_B]


@pytest.mark.asyncio
async def test_resolve_keeps_one_and_trashes_the_others_once(
    admin_client: AsyncClient, db_session, groups
):
    keep, *others = groups["a"]
    payload = {"keep_id": str(keep.id), "trash_ids": _ids(others)}

    response = await admin_client.post(RESOLVE, json=payload)
    assert response.status_code == 200, response.text
    assert response.json() == {
        "kept_id": str(keep.id),
        "trashed": _ids(others),
        "already_trashed": [],
    }
    assert not await _is_trashed(db_session, keep)
    for document in others:
        assert await _is_trashed(db_session, document)
    assert await _trash_audits(db_session) == 2
    details = await db_session.scalar(
        select(AuditLog.new_data).where(AuditLog.action == "document_trashed").limit(1)
    )
    assert details["reason"] == "duplicate"
    assert details["kept_document_id"] == str(keep.id)

    listed = await admin_client.get(DUPLICATES)
    assert [group["checksum"] for group in listed.json()] == [SHA_B]

    again = await admin_client.post(RESOLVE, json=payload)
    assert again.status_code == 200
    assert again.json()["trashed"] == []
    assert again.json()["already_trashed"] == _ids(others)
    assert await _trash_audits(db_session) == 2


@pytest.mark.asyncio
async def test_different_content_is_refused_and_nothing_moves(
    admin_client: AsyncClient, db_session, groups
):
    keep, other, _ = groups["a"]
    response = await admin_client.post(
        RESOLVE,
        json={
            "keep_id": str(keep.id),
            "trash_ids": [str(other.id), str(groups["b"][0].id)],
        },
    )
    assert response.status_code == 409
    assert response.json()["error_code"] == "NOT_DUPLICATE"
    assert not await _is_trashed(db_session, other)
    assert await _trash_audits(db_session) == 0


@pytest.mark.asyncio
async def test_copy_under_validation_is_refused_and_nothing_moves(
    admin_client: AsyncClient, db_session, db_seed, groups
):
    keep, reviewed, stepped = groups["a"]
    reviewed.status = "in_review"
    db_session.add(
        WorkflowStep(
            document_id=stepped.id, step_order=1, label="Visa", status="current"
        )
    )
    await db_session.commit()
    for trash_ids in ([reviewed.id], [stepped.id], [reviewed.id, stepped.id]):
        response = await admin_client.post(
            RESOLVE,
            json={"keep_id": str(keep.id), "trash_ids": [str(i) for i in trash_ids]},
        )
        assert response.status_code == 409, response.text
        assert response.json()["error_code"] == "DOCUMENT_IN_VALIDATION"
        assert f"{len(trash_ids)} copie(s)" in response.json()["detail"]
    assert not await _is_trashed(db_session, reviewed)
    assert not await _is_trashed(db_session, stepped)
    assert await _trash_audits(db_session) == 0

    # The validation over (step completed, document validated): trashed as usual.
    reviewed.status = "validated"
    step = await db_session.scalar(
        select(WorkflowStep).where(WorkflowStep.document_id == stepped.id)
    )
    step.status = "completed"
    await db_session.commit()
    done = await admin_client.post(
        RESOLVE,
        json={"keep_id": str(keep.id), "trash_ids": _ids([reviewed, stepped])},
    )
    assert done.status_code == 200, done.text
    assert await _trash_audits(db_session) == 2


@pytest.mark.asyncio
async def test_kept_document_must_be_active_and_known(
    admin_client: AsyncClient, db_session, groups
):
    trashed_keep = await admin_client.post(
        RESOLVE,
        json={
            "keep_id": str(groups["trashed"].id),
            "trash_ids": [str(groups["a"][0].id)],
        },
    )
    assert trashed_keep.status_code == 409
    assert trashed_keep.json()["error_code"] == "KEPT_DOCUMENT_TRASHED"

    unknown = uuid.uuid4()
    missing = await admin_client.post(
        RESOLVE,
        json={"keep_id": str(groups["a"][0].id), "trash_ids": [str(unknown)]},
    )
    assert missing.status_code == 404
    assert missing.json()["error_code"] == "DOCUMENT_NOT_FOUND"
    assert await _trash_audits(db_session) == 0


@pytest.mark.asyncio
async def test_reader_sees_the_groups_but_cannot_trash(
    client_as, db_session, db_seed, groups
):
    keep, *others = groups["a"]
    async with client_as(
        "reader", tenant_id=db_seed["tenant_id"], org_unit_id=db_seed["org_unit_id"]
    ) as client:
        listed = await client.get(DUPLICATES)
        resolved = await client.post(
            RESOLVE, json={"keep_id": str(keep.id), "trash_ids": _ids(others)}
        )
    assert listed.headers["x-total-count"] == "2"
    assert resolved.status_code == 403
    for document in others:
        assert not await _is_trashed(db_session, document)


@pytest.mark.asyncio
async def test_collaborator_only_sees_and_trashes_own_copies(
    client_as, db_session, db_seed, groups
):
    agent = User(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        role_id=db_seed["role_id"],
        matricule="AGENT01",
        email="agent01@testministry.gov.cm",
        first_name="Agent",
        last_name="Un",
        password_hash="x",
        is_active=True,
    )
    db_session.add(agent)
    await db_session.commit()
    mine = [
        await _doc(db_session, db_seed, f"m{n}", SHA_A, day=10 + n, owner_id=agent.id)
        for n in (1, 2)
    ]

    async with client_as(
        "collaborator",
        id=agent.id,
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    ) as client:
        listed = await client.get(DUPLICATES)
        hidden = await client.post(
            RESOLVE,
            json={"keep_id": str(mine[0].id), "trash_ids": [str(groups["a"][0].id)]},
        )
        own = await client.post(
            RESOLVE, json={"keep_id": str(mine[0].id), "trash_ids": [str(mine[1].id)]}
        )

    [group] = listed.json()
    assert [member["id"] for member in group["documents"]] == _ids(mine)
    assert hidden.status_code == 404
    assert not await _is_trashed(db_session, groups["a"][0])
    assert own.status_code == 200, own.text
    assert await _is_trashed(db_session, mine[1])


@pytest.mark.asyncio
async def test_foreign_tenant_sees_nothing(client_as, groups):
    keep, *others = groups["a"]
    async with client_as("tenant_admin", tenant_id=uuid.uuid4()) as client:
        listed = await client.get(DUPLICATES)
        resolved = await client.post(
            RESOLVE, json={"keep_id": str(keep.id), "trash_ids": _ids(others)}
        )
    assert listed.json() == []
    assert listed.headers["x-total-count"] == "0"
    assert resolved.status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize("same", ["keep", "twice", "empty", "extra"])
async def test_resolve_outside_contract_is_422(admin_client: AsyncClient, same):
    keep, other = str(uuid.uuid4()), str(uuid.uuid4())
    payload = {
        "keep": {"keep_id": keep, "trash_ids": [keep]},
        "twice": {"keep_id": keep, "trash_ids": [other, other]},
        "empty": {"keep_id": keep, "trash_ids": []},
        "extra": {"keep_id": keep, "trash_ids": [other], "purge": True},
    }[same]
    response = await admin_client.post(RESOLVE, json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_limit_is_bounded(admin_client: AsyncClient):
    response = await admin_client.get(DUPLICATES, params={"limit": 101})
    assert response.status_code == 422
