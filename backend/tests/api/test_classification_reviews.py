import io
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.models.classification_activity import ClassificationActivity
from app.models.classification_domain import ClassificationDomain
from app.models.classification_review import ClassificationReview
from app.models.document import Document
from app.models.document_version import DocumentVersion
from app.models.import_job_item import ImportJobItem
from app.services.classification_review_service import ClassificationReviewService


@pytest.fixture
def storage_tmp_path(tmp_path, monkeypatch):
    storage_dir = tmp_path / "storage"
    monkeypatch.setattr(settings, "STORAGE_PATH", str(storage_dir))
    return storage_dir


@pytest.mark.asyncio
async def test_list_and_resolve_classification_review(
    admin_client: AsyncClient,
    db_session,
    db_seed,
):
    domain = ClassificationDomain(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        code="marches",
        name="Marches",
        is_active=True,
    )
    activity = ClassificationActivity(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        domain_id=domain.id,
        code="reparation",
        name="Reparation",
        is_active=True,
    )
    document = Document(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        owner_id=db_seed["user_id"],
        title="Document ambigu",
        file_path="tenant/unit/doc-ambiguous.pdf",
        file_type="pdf",
        mime_type="application/pdf",
        file_size=128,
        document_category_id=db_seed["category_id"],
        status="draft",
        processing_mode="archive",
        classification_status="needs_review",
    )
    db_session.add(domain)
    db_session.add(activity)
    db_session.add(document)
    review_service = ClassificationReviewService(db_session)
    await review_service.ensure_open_review_for_document(document=document)
    await db_session.commit()

    list_response = await admin_client.get("/api/v1/classification-reviews")
    assert list_response.status_code == 200
    reviews = list_response.json()
    assert len(reviews) == 1
    assert reviews[0]["document"]["id"] == str(document.id)
    assert reviews[0]["review_status"] == "open"

    resolve_response = await admin_client.post(
        f"/api/v1/classification-reviews/{reviews[0]['id']}/resolve",
        json={
            "classification_domain_id": str(domain.id),
            "classification_activity_id": str(activity.id),
            "classification_year": 2026,
            "classification_scope": "service",
            "classification_target_org_unit_id": str(db_seed["org_unit_id"]),
            "comment": "Arbitrage de test",
            "relaunch_workflow": False,
        },
    )
    assert resolve_response.status_code == 200
    resolved = resolve_response.json()
    assert resolved["success"] is True
    assert resolved["review_status"] == "resolved"
    assert resolved["document_classification_status"] == "classified"
    assert (
        resolved["logical_space_path"] == "Direction Test / Marches / Reparation / 2026"
    )

    refreshed = await admin_client.get("/api/v1/classification-reviews")
    assert refreshed.status_code == 200
    assert refreshed.json() == []


@pytest.mark.asyncio
async def test_resolve_import_item_review_creates_final_document(
    auth_client: AsyncClient,
    admin_client: AsyncClient,
    db_session,
    db_seed,
    storage_tmp_path,
):
    domain = ClassificationDomain(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        code="marches",
        name="Marches",
        is_active=True,
    )
    activity = ClassificationActivity(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        domain_id=domain.id,
        code="reparation",
        name="Reparation",
        is_active=True,
    )
    db_session.add(domain)
    db_session.add(activity)
    await db_session.commit()

    analyze = await auth_client.post(
        "/api/v1/imports/analyze",
        files=[("files", ("note_inconnue.txt", io.BytesIO(b"note"), "text/plain"))],
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
    commit_payload = commit.json()
    assert commit_payload["pending_review_items"] == 1
    assert commit_payload["imported_documents"] == 0
    assert commit_payload["job"]["status"] == "completed_with_errors"

    list_response = await admin_client.get("/api/v1/classification-reviews")
    assert list_response.status_code == 200
    reviews = list_response.json()
    assert len(reviews) == 1
    assert reviews[0]["review_source"] == "import_job_item"
    assert reviews[0]["document"] is None
    assert reviews[0]["import_job_item"]["status"] == "pending"

    resolve_response = await admin_client.post(
        f"/api/v1/classification-reviews/{reviews[0]['id']}/resolve",
        json={
            "classification_domain_id": str(domain.id),
            "classification_activity_id": str(activity.id),
            "classification_year": 2026,
            "classification_scope": "service",
            "classification_target_org_unit_id": str(db_seed["org_unit_id"]),
            "comment": "Arbitrage import",
            "relaunch_workflow": False,
        },
    )
    assert resolve_response.status_code == 200
    resolved = resolve_response.json()
    assert resolved["success"] is True
    assert resolved["review_status"] == "resolved"
    assert resolved["document_classification_status"] == "classified"

    documents = await db_session.execute(select(Document))
    versions = await db_session.execute(select(DocumentVersion))
    items = await db_session.execute(select(ImportJobItem))
    reviews_db = await db_session.execute(select(ClassificationReview))

    created_documents = documents.scalars().all()
    created_versions = versions.scalars().all()
    job_items = items.scalars().all()
    persisted_reviews = reviews_db.scalars().all()

    assert len(created_documents) == 1
    assert len(created_versions) == 1
    assert job_items[0].status == "imported"
    assert job_items[0].document_id == created_documents[0].id
    assert persisted_reviews[0].review_status == "resolved"

    refreshed = await admin_client.get("/api/v1/classification-reviews")
    assert refreshed.status_code == 200
    assert refreshed.json() == []

    job_response = await auth_client.get(f"/api/v1/imports/{job_id}")
    assert job_response.status_code == 200
    assert job_response.json()["status"] == "completed"
