"""Every upload gets its own stored file: the key is never the bare file name.

Same name twice used to overwrite the previous bytes (other documents, previous
versions), and the duplicate branches then deleted the shared file.
"""

import hashlib
import io
import os
import uuid
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from starlette.datastructures import UploadFile

from app.api.v1.endpoints.documents import storage_service
from app.models.document_version import DocumentVersion
from app.services.storage.s3 import S3StorageService

DOCUMENTS = "/api/v1/documents"


async def _upload(client: AsyncClient, db_seed, name: str, content: bytes):
    return await client.post(
        f"{DOCUMENTS}/upload",
        files={"file": (name, io.BytesIO(content), "text/plain")},
        data={
            "title": name.rsplit(".", 1)[0],
            "document_category_id": str(db_seed["category_id"]),
            "processing_mode": "archive",
        },
    )


async def _versions(db_session, document_id) -> list[DocumentVersion]:
    rows = await db_session.scalars(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == uuid.UUID(document_id))
        .order_by(DocumentVersion.uploaded_at)
    )
    return list(rows)


def _read(path: str) -> bytes:
    with open(storage_service.get_full_path(path), "rb") as handle:
        return handle.read()


@pytest.mark.asyncio
async def test_same_name_twice_keeps_two_files_readable_with_their_checksum(
    admin_client: AsyncClient, db_session, db_seed
):
    created = await _upload(admin_client, db_seed, "rapport.txt", b"version un")
    assert created.status_code == 201, created.text
    document_id = created.json()["id"]
    second = await admin_client.post(
        f"{DOCUMENTS}/{document_id}/versions",
        files={"file": ("rapport.txt", io.BytesIO(b"version deux"), "text/plain")},
    )
    assert second.status_code == 201, second.text

    v1, v2 = await _versions(db_session, document_id)
    assert v1.file_path != v2.file_path
    for version, content in ((v1, b"version un"), (v2, b"version deux")):
        assert _read(version.file_path) == content
        assert hashlib.sha256(content).hexdigest() == version.checksum_sha256
    assert os.path.basename(v1.file_path).endswith("_rapport.txt")


@pytest.mark.asyncio
async def test_identical_upload_is_refused_and_the_current_file_survives(
    admin_client: AsyncClient, db_session, db_seed
):
    created = await _upload(admin_client, db_seed, "rapport.txt", b"meme contenu")
    document_id = created.json()["id"]
    again = await admin_client.post(
        f"{DOCUMENTS}/{document_id}/versions",
        files={"file": ("rapport.txt", io.BytesIO(b"meme contenu"), "text/plain")},
    )
    assert again.status_code == 409

    (only,) = await _versions(db_session, document_id)
    assert _read(only.file_path) == b"meme contenu"
    content = await admin_client.get(f"{DOCUMENTS}/{document_id}/content")
    assert content.content == b"meme contenu"


@pytest.mark.asyncio
async def test_a_previous_version_re_uploaded_is_refused_and_files_survive(
    admin_client: AsyncClient, db_session, db_seed
):
    created = await _upload(admin_client, db_seed, "rapport.txt", b"un")
    document_id = created.json()["id"]
    await admin_client.post(
        f"{DOCUMENTS}/{document_id}/versions",
        files={"file": ("rapport.txt", io.BytesIO(b"deux"), "text/plain")},
    )
    back = await admin_client.post(
        f"{DOCUMENTS}/{document_id}/versions",
        files={"file": ("rapport.txt", io.BytesIO(b"un"), "text/plain")},
    )
    assert back.status_code == 409

    v1, v2 = await _versions(db_session, document_id)
    assert (_read(v1.file_path), _read(v2.file_path)) == (b"un", b"deux")


@pytest.mark.asyncio
async def test_two_direct_uploads_with_the_same_name_keep_two_files(
    admin_client: AsyncClient, db_session, db_seed
):
    first = await _upload(admin_client, db_seed, "scan.txt", b"premier")
    second = await _upload(admin_client, db_seed, "scan.txt", b"second")
    assert first.status_code == second.status_code == 201, (first.text, second.text)

    (a,) = await _versions(db_session, first.json()["id"])
    (b,) = await _versions(db_session, second.json()["id"])
    assert a.file_path != b.file_path
    assert (_read(a.file_path), _read(b.file_path)) == (b"premier", b"second")


@pytest.mark.asyncio
async def test_s3_backend_also_uses_a_key_per_upload(monkeypatch):
    client = MagicMock()
    monkeypatch.setattr("app.services.storage.s3.boto3.client", lambda *a, **k: client)
    service = S3StorageService()

    keys = []
    for content in (b"a", b"b"):
        upload = UploadFile(file=io.BytesIO(content), filename="rapport.txt")
        key, _ = await service.save_file_with_checksum(upload, directory="t/u")
        keys.append(key)

    assert keys[0] != keys[1]
    assert all(k.startswith("t/u/") and k.endswith("_rapport.txt") for k in keys)


@pytest.mark.parametrize(
    "name",
    ["a" * 400 + ".pdf", "é" * 300 + ".txt", "b" * 400, "c" * 100 + "." + "x" * 300],
)
def test_a_very_long_file_name_still_fits_the_filesystem_limit(name):
    from app.services.storage.base import unique_storage_name

    stored = unique_storage_name(name)
    assert len(stored.encode("utf-8")) <= 240
    if name.endswith(".pdf") or name.endswith(".txt"):
        assert stored.endswith(name[-4:])
    assert unique_storage_name(name) != stored  # still one key per upload
