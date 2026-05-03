import io
import json
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.classification_activity import ClassificationActivity
from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.classification_domain import ClassificationDomain
from app.models.classification_review import ClassificationReview
from app.models.classification_rule import ClassificationRule


@pytest.fixture
def storage_tmp_path(tmp_path, monkeypatch):
    storage_dir = tmp_path / "storage"
    monkeypatch.setattr(settings, "STORAGE_PATH", str(storage_dir))
    return storage_dir


async def _seed_classification(db_session: AsyncSession, db_seed):
    domain = ClassificationDomain(
        tenant_id=db_seed["tenant_id"],
        code="marches",
        name="Marches",
        is_active=True,
    )
    db_session.add(domain)
    await db_session.flush()

    activity = ClassificationActivity(
        tenant_id=db_seed["tenant_id"],
        domain_id=domain.id,
        code="reparation",
        name="Reparation",
        is_active=True,
    )
    db_session.add(activity)
    await db_session.flush()

    rule = ClassificationRule(
        tenant_id=db_seed["tenant_id"],
        code="BATCH_RULE",
        name="Classement batch",
        priority=10,
        source_scope="service",
        document_category_id=db_seed["category_id"],
        filename_pattern="reparation",
        target_scope="service",
        target_org_unit_id=db_seed["org_unit_id"],
        domain_id=domain.id,
        activity_id=activity.id,
        workflow_template_id=db_seed["template_id"],
        is_active=True,
    )
    db_session.add(rule)
    await db_session.commit()
    return domain, activity, rule


@pytest.mark.asyncio
async def test_analyze_import_job_creates_preview(
    auth_client, db_session: AsyncSession, db_seed, storage_tmp_path
):
    await _seed_classification(db_session, db_seed)

    response = await auth_client.post(
        "/api/v1/imports/analyze",
        files=[
            ("files", ("reparation_note.txt", io.BytesIO(b"alpha"), "text/plain")),
            ("files", ("budget.pdf", io.BytesIO(b"beta"), "application/pdf")),
        ],
        data={
            "source_scope": "service",
            "default_document_category_id": str(db_seed["category_id"]),
            "processing_mode": "archive",
            "source_relative_paths": json.dumps([
                "service/reparation_note.txt",
                "service/budget.pdf",
            ]),
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "analyzed"
    assert payload["total_files"] == 2
    assert payload["supported_files"] == 2
    assert len(payload["items"]) == 2
    assert payload["items"][0]["status"] == "classified"
    assert payload["items"][0]["logical_space_path"]

    docs = await db_session.execute(select(Document.id))
    assert docs.scalars().all() == []


@pytest.mark.asyncio
async def test_analyze_import_job_detects_duplicate(
    auth_client, db_seed, storage_tmp_path
):
    duplicate_content = b"same-content"

    upload = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("existing.txt", io.BytesIO(duplicate_content), "text/plain")},
        data={
            "title": "Existing",
            "document_category_id": str(db_seed["category_id"]),
        },
    )
    assert upload.status_code == 201

    response = await auth_client.post(
        "/api/v1/imports/analyze",
        files=[("files", ("duplicate.txt", io.BytesIO(duplicate_content), "text/plain"))],
        data={
            "source_scope": "service",
            "default_document_category_id": str(db_seed["category_id"]),
        },
    )

    assert response.status_code == 201
    item = response.json()["items"][0]
    assert item["status"] == "duplicate"


@pytest.mark.asyncio
async def test_analyze_import_job_detects_same_batch_duplicate(
    auth_client, db_seed, storage_tmp_path
):
    duplicate_content = b"same-batch"

    response = await auth_client.post(
        "/api/v1/imports/analyze",
        files=[
            ("files", ("dup-a.txt", io.BytesIO(duplicate_content), "text/plain")),
            ("files", ("dup-b.txt", io.BytesIO(duplicate_content), "text/plain")),
        ],
        data={
            "source_scope": "service",
            "default_document_category_id": str(db_seed["category_id"]),
        },
    )

    assert response.status_code == 201
    payload = response.json()
    statuses = [item["status"] for item in payload["items"]]
    assert statuses.count("duplicate") == 1
    assert payload["duplicate_files"] == 1


@pytest.mark.asyncio
async def test_commit_import_job_creates_documents(
    auth_client, db_session: AsyncSession, db_seed, storage_tmp_path
):
    await _seed_classification(db_session, db_seed)

    analyze = await auth_client.post(
        "/api/v1/imports/analyze",
        files=[("files", ("reparation_batch.txt", io.BytesIO(b"content"), "text/plain"))],
        data={
            "source_scope": "service",
            "default_document_category_id": str(db_seed["category_id"]),
            "processing_mode": "archive",
        },
    )
    assert analyze.status_code == 201
    job_id = analyze.json()["id"]

    commit = await auth_client.post(f"/api/v1/imports/{job_id}/commit")
    assert commit.status_code == 200
    payload = commit.json()
    assert payload["job"]["status"] == "completed"
    assert payload["imported_documents"] == 1
    assert payload["job"]["items"][0]["status"] == "imported"
    assert payload["job"]["items"][0]["document_id"]

    docs = await db_session.execute(select(Document))
    versions = await db_session.execute(select(DocumentVersion))
    assert len(docs.scalars().all()) == 1
    assert len(versions.scalars().all()) == 1


@pytest.mark.asyncio
async def test_commit_import_job_handles_partial_validity(
    auth_client, db_session: AsyncSession, db_seed, storage_tmp_path
):
    await _seed_classification(db_session, db_seed)

    analyze = await auth_client.post(
        "/api/v1/imports/analyze",
        files=[
            ("files", ("reparation_batch.txt", io.BytesIO(b"ok"), "text/plain")),
            ("files", ("inconnu.txt", io.BytesIO(b"unknown"), "text/plain")),
            ("files", ("unsupported.exe", io.BytesIO(b"bad"), "application/octet-stream")),
        ],
        data={
            "source_scope": "service",
            "default_document_category_id": str(db_seed["category_id"]),
            "processing_mode": "archive",
        },
    )
    assert analyze.status_code == 201
    job_id = analyze.json()["id"]

    commit = await auth_client.post(f"/api/v1/imports/{job_id}/commit")
    assert commit.status_code == 200
    payload = commit.json()
    statuses = [item["status"] for item in payload["job"]["items"]]
    assert payload["job"]["status"] == "completed_with_errors"
    assert payload["pending_review_items"] == 1
    assert payload["failed_items"] == 0
    assert statuses.count("imported") == 1
    assert "pending" in statuses
    assert "ignored" in statuses

    reviews = await db_session.execute(select(ClassificationReview))
    assert len(reviews.scalars().all()) == 1


@pytest.mark.asyncio
async def test_non_admin_cannot_target_another_user_for_person_scope(
    auth_client, db_session: AsyncSession, db_seed, storage_tmp_path
):
    from app.models.user import User
    from app.core.security import hash_password

    new_user = User(
        id=uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        role_id=db_seed["role_id"],
        matricule="TEST002",
        email="other@testministry.gov.cm",
        first_name="Other",
        last_name="User",
        password_hash=hash_password("testpassword123"),
        is_active=True,
    )
    db_session.add(new_user)
    await db_session.commit()

    response = await auth_client.post(
        "/api/v1/imports/analyze",
        files=[("files", ("mine.txt", io.BytesIO(b"mine"), "text/plain"))],
        data={
            "source_scope": "person",
            "target_user_id": str(new_user.id),
            "default_document_category_id": str(db_seed["category_id"]),
        },
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_import_job_read_endpoints(
    auth_client, db_seed, storage_tmp_path
):
    analyze = await auth_client.post(
        "/api/v1/imports/analyze",
        files=[("files", ("single.txt", io.BytesIO(b"one"), "text/plain"))],
        data={
            "source_scope": "service",
            "default_document_category_id": str(db_seed["category_id"]),
        },
    )
    assert analyze.status_code == 201
    job_id = analyze.json()["id"]

    job_resp = await auth_client.get(f"/api/v1/imports/{job_id}")
    items_resp = await auth_client.get(f"/api/v1/imports/{job_id}/items")

    assert job_resp.status_code == 200
    assert items_resp.status_code == 200
    assert job_resp.json()["id"] == job_id
    assert len(items_resp.json()) == 1


@pytest.mark.asyncio
async def test_import_job_commit_wrong_status_is_rejected(
    auth_client, db_seed, storage_tmp_path
):
    analyze = await auth_client.post(
        "/api/v1/imports/analyze",
        files=[("files", ("single.txt", io.BytesIO(b"one"), "text/plain"))],
        data={
            "source_scope": "service",
            "default_document_category_id": str(db_seed["category_id"]),
        },
    )
    job_id = analyze.json()["id"]

    first_commit = await auth_client.post(f"/api/v1/imports/{job_id}/commit")
    assert first_commit.status_code == 200

    second_commit = await auth_client.post(f"/api/v1/imports/{job_id}/commit")
    assert second_commit.status_code == 409
