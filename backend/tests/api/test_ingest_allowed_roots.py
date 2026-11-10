"""POST /documents/ingest-directory only reads under INGEST_ALLOWED_ROOTS.

Spec: gestion-projet/innovateur/spec-ingest-racines-autorisees.md §3 and §5.
The roots are absolute container paths; tests point them at tmp_path. Symlink
cases need a POSIX filesystem and run in Docker (skipped on Windows).
"""

import os
import pathlib
import sys

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.core.config import settings
from app.models.document import Document

INGEST = "/api/v1/documents/ingest-directory"
POSIX_ONLY = pytest.mark.skipif(
    sys.platform == "win32", reason="symlinks: Docker proof"
)


@pytest.fixture
def ingest_fs(tmp_path, monkeypatch):
    """root/lot with 2 txt files, a look-alike root-bis and an outside dir; storage on tmp."""
    root = tmp_path / "root"
    lot = root / "lot"
    lot.mkdir(parents=True)
    (lot / "a.txt").write_text("alpha", encoding="utf-8")
    (lot / "b.txt").write_text("beta", encoding="utf-8")
    outside = tmp_path / "autre"
    outside.mkdir()
    (outside / "x.txt").write_text("secret", encoding="utf-8")
    bis = tmp_path / "root-bis"
    bis.mkdir()
    (bis / "y.txt").write_text("secret", encoding="utf-8")
    monkeypatch.setattr(settings, "INGEST_ALLOWED_ROOTS_STR", str(root))
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path / "storage"))
    return {"root": root, "lot": lot, "outside": outside, "bis": bis, "tmp": tmp_path}


async def _count(db_session, tenant_id) -> int:
    result = await db_session.execute(
        select(func.count())
        .select_from(Document)
        .where(Document.tenant_id == tenant_id)
    )
    return result.scalar_one()


def _payload(path: str) -> dict:
    return {"directory_path": path, "recursive": True, "processing_mode": "archive"}


def _assert_forbidden(response) -> None:
    assert response.status_code == 403, response.text
    body = response.json()
    assert body["error_code"] == "INGEST_PATH_FORBIDDEN"
    assert body["detail"] == "Dossier hors des emplacements autorisés"
    # Neither the requested path nor the configured roots leak to the client.
    assert "root" not in response.text and "tmp" not in response.text


async def _assert_nothing_imported(
    auth_client, db_session, db_seed, fs, response
) -> None:
    _assert_forbidden(response)
    assert await _count(db_session, db_seed["tenant_id"]) == fs["_before"]
    assert not list(pathlib.Path(settings.STORAGE_PATH).rglob("*.txt"))


@pytest.fixture
async def before(db_session, db_seed, ingest_fs):
    ingest_fs["_before"] = await _count(db_session, db_seed["tenant_id"])
    return ingest_fs


@pytest.mark.asyncio
async def test_absolute_path_under_root_is_imported(auth_client: AsyncClient, before):
    response = await auth_client.post(INGEST, json=_payload(str(before["lot"])))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["imported"] == 2
    assert body["errors"] == []


@pytest.mark.asyncio
async def test_relative_path_resolves_against_first_root(
    auth_client: AsyncClient, before
):
    response = await auth_client.post(INGEST, json=_payload("lot"))
    assert response.status_code == 200, response.text
    assert response.json()["imported"] == 2


@pytest.mark.asyncio
async def test_path_outside_root_is_forbidden(
    auth_client: AsyncClient, db_session, db_seed, before
):
    response = await auth_client.post(INGEST, json=_payload(str(before["outside"])))
    await _assert_nothing_imported(auth_client, db_session, db_seed, before, response)


@pytest.mark.asyncio
async def test_traversal_is_forbidden(
    auth_client: AsyncClient, db_session, db_seed, before
):
    sneaky = os.path.join(str(before["root"]), "..", "autre")
    response = await auth_client.post(INGEST, json=_payload(sneaky))
    await _assert_nothing_imported(auth_client, db_session, db_seed, before, response)


@pytest.mark.asyncio
async def test_lookalike_prefix_is_forbidden(
    auth_client: AsyncClient, db_session, db_seed, before
):
    response = await auth_client.post(INGEST, json=_payload(str(before["bis"])))
    await _assert_nothing_imported(auth_client, db_session, db_seed, before, response)


@POSIX_ONLY
@pytest.mark.asyncio
async def test_directory_symlink_escaping_root_is_forbidden(
    auth_client: AsyncClient, db_session, db_seed, before
):
    link = before["root"] / "lien"
    os.symlink(before["outside"], link, target_is_directory=True)
    response = await auth_client.post(INGEST, json=_payload(str(link)))
    await _assert_nothing_imported(auth_client, db_session, db_seed, before, response)


@POSIX_ONLY
@pytest.mark.asyncio
async def test_file_symlink_escaping_root_is_skipped_and_reported(
    auth_client: AsyncClient, before
):
    only = before["root"] / "seul"
    only.mkdir()
    (only / "ok.txt").write_text("fine", encoding="utf-8")
    os.symlink(before["outside"] / "x.txt", only / "fuite.txt")

    response = await auth_client.post(INGEST, json=_payload(str(only)))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["imported"] == 1
    assert body["total_found"] == 2
    assert len(body["errors"]) == 1
    assert body["errors"][0]["error"] == "Lien hors des emplacements autorisés"
    assert body["errors"][0]["file"].endswith("fuite.txt")


@pytest.mark.asyncio
async def test_empty_roots_forbids_everything(
    auth_client: AsyncClient, db_session, db_seed, before, monkeypatch
):
    monkeypatch.setattr(settings, "INGEST_ALLOWED_ROOTS_STR", "")
    response = await auth_client.post(INGEST, json=_payload(str(before["lot"])))
    await _assert_nothing_imported(auth_client, db_session, db_seed, before, response)


@pytest.mark.asyncio
async def test_allowed_but_missing_directory_keeps_report_contract(
    auth_client: AsyncClient, before
):
    """uat/directory-import.spec.ts relies on 200 + report, not on a 4xx."""
    response = await auth_client.post(
        INGEST, json=_payload(str(before["root"] / "inexistant"))
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["imported"] == 0
    assert body["errors"][0]["error"] == "Le répertoire n'existe pas"
