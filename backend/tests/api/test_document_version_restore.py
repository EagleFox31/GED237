"""Restoring an old version copies it into a new current version, never overwrites (V1.2).

Outside the caller's perimeter the document answers 404 like a missing one (#247).
"""

import asyncio
import hashlib
import io
import os
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints import documents as documents_endpoint
from app.api.v1.endpoints.documents import storage_service
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.document_version import DocumentVersion
from tests.api.test_unit_admin_read_scope import tree  # noqa: F401  (fixture)

DOCUMENTS = "/api/v1/documents"


async def _upload(client: AsyncClient, db_seed, name: str, content: bytes) -> str:
    created = await client.post(
        f"{DOCUMENTS}/upload",
        files={"file": (name, io.BytesIO(content), "text/plain")},
        data={
            "title": name.rsplit(".", 1)[0],
            "document_category_id": str(db_seed["category_id"]),
            "processing_mode": "archive",
        },
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


async def _document_with_two_versions(client: AsyncClient, db_seed) -> str:
    document_id = await _upload(client, db_seed, "rapport.txt", b"version un")
    second = await client.post(
        f"{DOCUMENTS}/{document_id}/versions",
        files={"file": ("rapport.txt", io.BytesIO(b"version deux"), "text/plain")},
        data={"change_note": "correction"},
    )
    assert second.status_code == 201, second.text
    return document_id


async def _versions(db_session, document_id) -> list[DocumentVersion]:
    rows = await db_session.scalars(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == uuid.UUID(document_id))
        .order_by(DocumentVersion.uploaded_at)
    )
    return list(rows)


def _fingerprint(version: DocumentVersion) -> tuple:
    return (version.file_path, version.checksum_sha256, version.version_number)


@pytest.mark.asyncio
async def test_restore_adds_a_new_version_and_keeps_the_old_ones(
    admin_client: AsyncClient, db_session, db_seed
):
    document_id = await _document_with_two_versions(admin_client, db_seed)
    v1, v2 = await _versions(db_session, document_id)
    before = (_fingerprint(v1), _fingerprint(v2))
    v1_id, v1_number = v1.id, v1.version_number

    resp = await admin_client.post(
        f"{DOCUMENTS}/{document_id}/versions/{v1_id}/restore"
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["restored_from"] == v1_number

    db_session.expire_all()
    versions = await _versions(db_session, document_id)
    assert len(versions) == 3
    # The old versions are untouched.
    assert (_fingerprint(versions[0]), _fingerprint(versions[1])) == before
    # The new one copies v1 into a file of its own.
    restored = versions[2]
    assert restored.checksum_sha256 == versions[0].checksum_sha256
    assert restored.file_path not in {versions[0].file_path, versions[1].file_path}
    assert os.path.exists(storage_service.get_full_path(restored.file_path))
    assert os.path.exists(storage_service.get_full_path(versions[0].file_path))
    assert restored.change_note == f"Restauration de la version {v1_number}"

    document = await db_session.get(Document, uuid.UUID(document_id))
    assert document.current_version_id == restored.id
    assert document.file_path == restored.file_path

    current = await admin_client.get(f"{DOCUMENTS}/{document_id}/content")
    assert current.content == b"version un"
    assert versions[0].file_path != versions[1].file_path

    listing = await admin_client.get(f"{DOCUMENTS}/{document_id}/versions")
    assert [row["is_current"] for row in listing.json()].count(True) == 1


@pytest.mark.asyncio
async def test_restore_writes_one_audit_row_with_a_french_label(
    admin_client: AsyncClient, db_session, db_seed
):
    document_id = await _document_with_two_versions(admin_client, db_seed)
    v1 = (await _versions(db_session, document_id))[0]
    v1_id, v1_number = v1.id, v1.version_number
    resp = await admin_client.post(
        f"{DOCUMENTS}/{document_id}/versions/{v1_id}/restore"
    )
    assert resp.status_code == 201, resp.text

    rows = list(
        await db_session.scalars(
            select(AuditLog).where(
                AuditLog.record_id == uuid.UUID(document_id),
                AuditLog.action == "version_restored",
            )
        )
    )
    assert len(rows) == 1
    assert rows[0].user_id == db_seed["user_id"]
    assert rows[0].new_data["restored_version"] == v1_number

    journal = await admin_client.get(
        "/api/v1/audit/logs", params={"table_name": "documents"}
    )
    labels = {
        entry["action_label"]
        for entry in journal.json()
        if entry["record_id"] == document_id and entry["action"] == "version_restored"
    }
    assert labels == {"Version restaurée"}


@pytest.mark.asyncio
async def test_restore_refuses_the_current_version_and_unknown_versions(
    admin_client: AsyncClient, db_session, db_seed
):
    document_id = await _document_with_two_versions(admin_client, db_seed)
    current_id = (await _versions(db_session, document_id))[-1].id

    same = await admin_client.post(
        f"{DOCUMENTS}/{document_id}/versions/{current_id}/restore"
    )
    assert same.status_code == 409
    assert "deja la version actuelle" in str(same.json())

    unknown = await admin_client.post(
        f"{DOCUMENTS}/{document_id}/versions/{uuid.uuid4()}/restore"
    )
    assert unknown.status_code == 404
    assert len(await _versions(db_session, document_id)) == 2


@pytest.mark.asyncio
async def test_restore_never_takes_a_version_of_another_document(
    admin_client: AsyncClient, db_session, db_seed
):
    mine = await _document_with_two_versions(admin_client, db_seed)
    other = await _upload(admin_client, db_seed, "autre.txt", b"autre")
    other_version_id = (await _versions(db_session, other))[0].id

    resp = await admin_client.post(
        f"{DOCUMENTS}/{mine}/versions/{other_version_id}/restore"
    )
    assert resp.status_code == 404
    assert len(await _versions(db_session, mine)) == 2


@pytest.mark.asyncio
async def test_restore_answers_404_outside_the_perimeter_403_inside_without_the_right(
    client_as,
    db_seed,
    tree,  # noqa: F811
):
    ids = tree["ids"]

    def path(document_id) -> str:
        return f"{DOCUMENTS}/{document_id}/versions/{uuid.uuid4()}/restore"

    async with client_as(
        "manager",
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=tree["units"]["a1"],
    ) as client:
        hidden = await client.post(path(ids["b"]))
        missing = await client.post(path(uuid.uuid4()))
        no_right = await client.post(path(ids["a1"]))
    assert (hidden.status_code, hidden.json()["detail"]) == (
        missing.status_code,
        missing.json()["detail"],
    )
    assert hidden.status_code == 404
    assert no_right.status_code == 403


@pytest.mark.asyncio
async def test_old_version_content_returns_its_own_bytes(
    admin_client: AsyncClient, db_session, db_seed
):
    document_id = await _document_with_two_versions(admin_client, db_seed)
    v1, v2 = await _versions(db_session, document_id)

    old = await admin_client.get(f"{DOCUMENTS}/{document_id}/versions/{v1.id}/content")
    new = await admin_client.get(f"{DOCUMENTS}/{document_id}/versions/{v2.id}/content")
    assert (old.status_code, old.content) == (200, b"version un")
    assert (new.status_code, new.content) == (200, b"version deux")
    assert old.headers["x-content-type-options"] == "nosniff"
    bad = await admin_client.get(
        f"{DOCUMENTS}/{document_id}/versions/{v1.id}/content",
        params={"disposition": "x"},
    )
    assert bad.status_code == 400


@pytest.mark.asyncio
async def test_old_version_content_404_for_another_documents_version(
    admin_client: AsyncClient, db_session, db_seed
):
    mine = await _document_with_two_versions(admin_client, db_seed)
    other = await _upload(admin_client, db_seed, "autre.txt", b"autre")
    other_version_id = (await _versions(db_session, other))[0].id

    resp = await admin_client.get(
        f"{DOCUMENTS}/{mine}/versions/{other_version_id}/content"
    )
    assert resp.status_code == 404
    assert b"autre" not in resp.content


@pytest.mark.asyncio
async def test_old_version_content_404_outside_the_perimeter(
    client_as,
    db_seed,
    tree,  # noqa: F811
):
    ids = tree["ids"]

    def path(document_id) -> str:
        return f"{DOCUMENTS}/{document_id}/versions/{uuid.uuid4()}/content"

    async with client_as(
        "manager",
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=tree["units"]["a1"],
    ) as client:
        hidden = await client.get(path(ids["b"]))
        missing = await client.get(path(uuid.uuid4()))
    assert hidden.status_code == missing.status_code == 404
    assert hidden.json()["detail"] == missing.json()["detail"]


@pytest.mark.asyncio
async def test_two_restores_at_once_get_two_distinct_version_numbers(
    admin_client: AsyncClient, db_session, db_seed
):
    """The document row is locked while the next number is computed."""
    document_id = await _document_with_two_versions(admin_client, db_seed)
    v1, _ = await _versions(db_session, document_id)
    url = f"{DOCUMENTS}/{document_id}/versions/{v1.id}/restore"

    first, second = await asyncio.gather(admin_client.post(url), admin_client.post(url))

    assert (first.status_code, second.status_code) == (201, 201), (
        first.text,
        second.text,
    )
    assert first.json()["version"] != second.json()["version"]
    db_session.expire_all()
    numbers = [v.version_number for v in await _versions(db_session, document_id)]
    assert len(numbers) == 4
    assert len(set(numbers)) == 4


@pytest.mark.asyncio
async def test_restoring_a_pdf_version_queues_the_ocr_again(
    admin_client: AsyncClient, db_session, db_seed, monkeypatch
):
    created = await admin_client.post(
        f"{DOCUMENTS}/upload",
        files={
            "file": ("plan.pdf", io.BytesIO(b"%PDF-1.4\n%%EOF\n"), "application/pdf")
        },
        data={
            "title": "plan",
            "document_category_id": str(db_seed["category_id"]),
            "processing_mode": "archive",
        },
    )
    assert created.status_code == 201, created.text
    document_id = created.json()["id"]
    second = await admin_client.post(
        f"{DOCUMENTS}/{document_id}/versions",
        files={
            "file": (
                "plan.pdf",
                io.BytesIO(b"%PDF-1.4\n%v2\n%%EOF\n"),
                "application/pdf",
            )
        },
        data={"change_note": "correction"},
    )
    assert second.status_code == 201, second.text
    v1, _ = await _versions(db_session, document_id)
    queued = []
    monkeypatch.setattr(
        documents_endpoint.process_document_ocr,
        "delay",
        lambda *args: queued.append(args),
    )

    resp = await admin_client.post(
        f"{DOCUMENTS}/{document_id}/versions/{v1.id}/restore"
    )

    assert resp.status_code == 201, resp.text
    db_session.expire_all()
    restored = (await _versions(db_session, document_id))[-1]
    assert queued == [(document_id, restored.file_path, "application/pdf")]


@pytest.mark.asyncio
async def test_restoring_a_text_version_queues_no_ocr(
    admin_client: AsyncClient, db_session, db_seed, monkeypatch
):
    document_id = await _document_with_two_versions(admin_client, db_seed)
    v1, _ = await _versions(db_session, document_id)
    queued = []
    monkeypatch.setattr(
        documents_endpoint.process_document_ocr,
        "delay",
        lambda *args: queued.append(args),
    )

    resp = await admin_client.post(
        f"{DOCUMENTS}/{document_id}/versions/{v1.id}/restore"
    )

    assert resp.status_code == 201, resp.text
    assert queued == []


@pytest.mark.asyncio
async def test_a_failed_commit_leaves_no_copied_file(
    admin_client: AsyncClient, db_session, db_seed, monkeypatch
):
    document_id = await _document_with_two_versions(admin_client, db_seed)
    v1, v2 = await _versions(db_session, document_id)
    folder = os.path.dirname(storage_service.get_full_path(v1.file_path))
    before = set(os.listdir(folder))

    async def broken_commit(self):
        raise RuntimeError("base indisponible")

    monkeypatch.setattr(AsyncSession, "commit", broken_commit)
    try:
        resp = await admin_client.post(
            f"{DOCUMENTS}/{document_id}/versions/{v1.id}/restore"
        )
        assert resp.status_code == 500
    except RuntimeError:
        pass
    monkeypatch.undo()

    assert set(os.listdir(folder)) == before
    db_session.expire_all()
    assert len(await _versions(db_session, document_id)) == 2
    document = await db_session.get(Document, uuid.UUID(document_id))
    assert document.current_version_id == v2.id


def test_a_restored_name_never_stacks_suffixes():
    stacked = "docs/2026/rapport" + "_restored_0123abcd" * 20 + ".txt"

    copy = documents_endpoint._restored_copy_path(stacked)

    assert copy.startswith("docs/2026/rapport_restored_")
    assert copy.endswith(".txt")
    assert copy.count("_restored_") == 1
    assert copy != documents_endpoint._restored_copy_path(stacked)


@pytest.mark.asyncio
async def test_restoring_a_restored_version_again_keeps_a_short_name(
    admin_client: AsyncClient, db_session, db_seed
):
    document_id = await _document_with_two_versions(admin_client, db_seed)
    v1, v2 = await _versions(db_session, document_id)
    original = max(len(os.path.basename(v.file_path)) for v in (v1, v2))
    restore_from = v1.id
    for _ in range(6):
        resp = await admin_client.post(
            f"{DOCUMENTS}/{document_id}/versions/{restore_from}/restore"
        )
        assert resp.status_code == 201, resp.text
        db_session.expire_all()
        versions = await _versions(db_session, document_id)
        # The version before last: from the third round on, a restored copy whose
        # own source was already restored.
        restore_from = versions[-2].id

    names = [os.path.basename(v.file_path) for v in versions[2:]]
    assert len(names) == 6
    assert all(name.count("_restored_") == 1 for name in names)
    assert all(len(name) <= original + len("_restored_") + 8 for name in names)
    assert len(set(names)) == 6


@pytest.mark.asyncio
async def test_restore_fingerprints_the_copied_bytes_not_the_source_row(
    admin_client: AsyncClient, db_session, db_seed
):
    document_id = await _document_with_two_versions(admin_client, db_seed)
    v1, v2 = await _versions(db_session, document_id)
    v1_id, stale_checksum = v1.id, v1.checksum_sha256
    # Older data: two versions sharing one file, which now holds the second's bytes.
    v1.file_path = v2.file_path
    await db_session.commit()

    resp = await admin_client.post(
        f"{DOCUMENTS}/{document_id}/versions/{v1_id}/restore"
    )
    assert resp.status_code == 201, resp.text

    db_session.expire_all()
    restored = (await _versions(db_session, document_id))[-1]
    assert restored.checksum_sha256 == hashlib.sha256(b"version deux").hexdigest()
    assert restored.checksum_sha256 != stale_checksum
    assert restored.file_size == len(b"version deux")
