import io
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.user import User


@pytest.mark.asyncio
async def test_category_admin_crud_and_inactive_listing(
    admin_client: AsyncClient, db_seed
):
    initial = await admin_client.get("/api/v1/categories/")
    assert initial.status_code == 200
    assert any(row["id"] == str(db_seed["category_id"]) for row in initial.json())

    created = await admin_client.post(
        "/api/v1/categories/",
        json={
            "code": "Policy Memo",
            "name": "Policy Memo",
            "description": "Policy documents",
            "is_active": True,
        },
    )
    assert created.status_code == 201
    category = created.json()
    assert category["code"] == "policy_memo"

    duplicate = await admin_client.post(
        "/api/v1/categories/",
        json={"code": "Policy Memo", "name": "Duplicate", "is_active": True},
    )
    assert duplicate.status_code == 400

    patched = await admin_client.patch(
        f"/api/v1/categories/{category['id']}",
        json={"name": "Policy Memorandum", "description": "Updated"},
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "Policy Memorandum"

    deleted = await admin_client.delete(f"/api/v1/categories/{category['id']}")
    assert deleted.status_code == 204

    active_only = await admin_client.get("/api/v1/categories/")
    assert all(row["id"] != category["id"] for row in active_only.json())

    with_inactive = await admin_client.get(
        "/api/v1/categories/", params={"include_inactive": "true"}
    )
    assert any(
        row["id"] == category["id"] and row["is_active"] is False
        for row in with_inactive.json()
    )

    missing = await admin_client.patch(
        f"/api/v1/categories/{uuid.uuid4()}", json={"name": "Missing"}
    )
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_org_unit_admin_crud_and_delete_guards(
    admin_client: AsyncClient, db_seed
):
    child_payload = {
        "tenant_id": str(db_seed["tenant_id"]),
        "parent_id": str(db_seed["org_unit_id"]),
        "code": "SRV-COV",
        "name": "Service Coverage",
        "level": 2,
        "is_active": True,
    }
    created = await admin_client.post("/api/v1/org-units/", json=child_payload)
    assert created.status_code == 201
    child = created.json()

    duplicate = await admin_client.post("/api/v1/org-units/", json=child_payload)
    assert duplicate.status_code == 400

    listing = await admin_client.get(
        "/api/v1/org-units/", params={"parent_id": str(db_seed["org_unit_id"])}
    )
    assert listing.status_code == 200
    assert any(row["id"] == child["id"] for row in listing.json())

    fetched = await admin_client.get(f"/api/v1/org-units/{child['id']}")
    assert fetched.status_code == 200

    patched = await admin_client.patch(
        f"/api/v1/org-units/{child['id']}", json={"name": "Service Coverage Updated"}
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "Service Coverage Updated"

    grandchild_payload = {
        "tenant_id": str(db_seed["tenant_id"]),
        "parent_id": child["id"],
        "code": "CELL-COV",
        "name": "Cellule Coverage",
        "level": 3,
        "is_active": True,
    }
    grandchild = await admin_client.post(
        "/api/v1/org-units/", json=grandchild_payload
    )
    assert grandchild.status_code == 201
    grandchild_id = grandchild.json()["id"]

    blocked = await admin_client.delete(f"/api/v1/org-units/{child['id']}")
    assert blocked.status_code == 409
    assert "child unit" in blocked.json()["detail"]

    assert (
        await admin_client.delete(f"/api/v1/org-units/{grandchild_id}")
    ).status_code == 204
    assert (
        await admin_client.delete(f"/api/v1/org-units/{child['id']}")
    ).status_code == 204

    missing = await admin_client.get(f"/api/v1/org-units/{uuid.uuid4()}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_tenant_admin_crud_and_public_listing(admin_client: AsyncClient, db_seed):
    public = await admin_client.get("/api/v1/tenants/public")
    assert public.status_code == 200
    assert any(row["short_name"] == "TESTMIN" for row in public.json())

    payload = {
        "name": "Coverage Ministry",
        "short_name": "COVMIN",
        "domain": "coverage-ministry.gov.cm",
        "settings": {"locale": "fr"},
        "is_active": True,
    }
    created = await admin_client.post("/api/v1/tenants/", json=payload)
    assert created.status_code == 201
    tenant = created.json()

    duplicate = await admin_client.post(
        "/api/v1/tenants/",
        json={**payload, "name": "Duplicate", "short_name": "DUPCOV"},
    )
    assert duplicate.status_code == 400

    reserved = await admin_client.post(
        "/api/v1/tenants/",
        json={
            "name": "Reserved",
            "short_name": "PLATFORM",
            "domain": "reserved-platform.gov.cm",
            "is_active": True,
        },
    )
    assert reserved.status_code == 400

    listing = await admin_client.get("/api/v1/tenants/")
    assert listing.status_code == 200
    assert any(row["id"] == tenant["id"] for row in listing.json())

    fetched = await admin_client.get(f"/api/v1/tenants/{tenant['id']}")
    assert fetched.status_code == 200

    patched = await admin_client.patch(
        f"/api/v1/tenants/{tenant['id']}",
        json={"name": "Coverage Ministry Updated", "is_active": False},
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "Coverage Ministry Updated"
    assert patched.json()["is_active"] is False

    missing = await admin_client.get(f"/api/v1/tenants/{uuid.uuid4()}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_user_admin_crud_and_hierarchy(admin_client: AsyncClient, db_seed):
    payload = {
        "matricule": "COV001",
        "email": "coverage.user@testministry.gov.cm",
        "first_name": "Coverage",
        "last_name": "User",
        "role_id": db_seed["role_id"],
        "tenant_id": str(db_seed["tenant_id"]),
        "org_unit_id": str(db_seed["org_unit_id"]),
        "reports_to_user_id": str(db_seed["user_id"]),
        "password": "coverage123",
        "is_active": True,
    }
    created = await admin_client.post("/api/v1/users/", json=payload)
    assert created.status_code == 201
    body = created.json()
    assert body["generated_password"] is None
    user = body["user"]

    duplicate_matricule = await admin_client.post(
        "/api/v1/users/",
        json={**payload, "email": "coverage.user2@testministry.gov.cm"},
    )
    assert duplicate_matricule.status_code == 400

    listing = await admin_client.get(
        "/api/v1/users/", params={"tenant_id": str(db_seed["tenant_id"])}
    )
    assert listing.status_code == 200
    assert any(row["id"] == user["id"] for row in listing.json())

    fetched = await admin_client.get(f"/api/v1/users/{user['id']}")
    assert fetched.status_code == 200

    up = await admin_client.get(f"/api/v1/users/{user['id']}/hierarchy-up")
    assert up.status_code == 200
    assert up.json()[0]["id"] == str(db_seed["user_id"])

    down = await admin_client.get(
        f"/api/v1/users/{db_seed['user_id']}/hierarchy-down"
    )
    assert down.status_code == 200
    assert any(row["id"] == user["id"] for row in down.json())

    patched = await admin_client.patch(
        f"/api/v1/users/{user['id']}",
        json={"first_name": "Covered", "password": "coverage456"},
    )
    assert patched.status_code == 200
    assert patched.json()["first_name"] == "Covered"

    self_delete = await admin_client.delete(f"/api/v1/users/{db_seed['user_id']}")
    assert self_delete.status_code == 400

    deleted = await admin_client.delete(f"/api/v1/users/{user['id']}")
    assert deleted.status_code == 204

    missing = await admin_client.get(f"/api/v1/users/{uuid.uuid4()}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_notifications_list_and_read_mutations(
    admin_client: AsyncClient, db_session, db_seed
):
    first = Notification(
        user_id=db_seed["user_id"],
        tenant_id=db_seed["tenant_id"],
        event_type="SYSTEM_ALERT",
        message="First coverage alert",
        channel="in_app",
        is_read=False,
        meta_data={"kind": "coverage"},
    )
    second = Notification(
        user_id=db_seed["user_id"],
        tenant_id=db_seed["tenant_id"],
        event_type="WORKFLOW_ASSIGNED",
        message="Second coverage alert",
        channel="in_app",
        is_read=False,
        meta_data={},
    )
    db_session.add_all([first, second])
    await db_session.commit()
    await db_session.refresh(first)

    unread = await admin_client.get(
        "/api/v1/notifications/", params={"unread_only": "true"}
    )
    assert unread.status_code == 200
    assert len(unread.json()) == 2

    marked = await admin_client.put(f"/api/v1/notifications/{first.id}/read")
    assert marked.status_code == 200
    assert marked.json() == {"status": "success"}

    unread_after = await admin_client.get(
        "/api/v1/notifications/", params={"unread_only": "true"}
    )
    assert len(unread_after.json()) == 1

    all_marked = await admin_client.put("/api/v1/notifications/read-all")
    assert all_marked.status_code == 200

    final_unread = await admin_client.get(
        "/api/v1/notifications/", params={"unread_only": "true"}
    )
    assert final_unread.json() == []


@pytest.mark.asyncio
async def test_audit_log_serialization_filters_and_document_label(
    admin_client: AsyncClient, db_session, db_seed
):
    upload = await admin_client.post(
        "/api/v1/documents/upload",
        files={"file": ("audit-coverage.txt", io.BytesIO(b"audit"), "text/plain")},
        data={"title": "Audit Coverage Document", "processing_mode": "archive"},
    )
    assert upload.status_code == 201
    document_id = uuid.UUID(upload.json()["id"])

    log = AuditLog(
        tenant_id=db_seed["tenant_id"],
        user_id=db_seed["user_id"],
        table_name="documents",
        record_id=document_id,
        action="update",
        old_data={"status": "draft"},
        new_data={"reason": "Coverage audit reason"},
        user_agent="pytest",
    )
    db_session.add(log)
    await db_session.commit()

    response = await admin_client.get(
        "/api/v1/audit/logs",
        params={"table_name": "documents", "action": "UPDATE"},
    )
    assert response.status_code == 200
    rows = response.json()
    assert rows
    row = next(item for item in rows if item["record_id"] == str(document_id))
    assert row["resource_label"] == "Audit Coverage Document"
    assert row["action_label"] == "Modification"
    assert row["detail"] == "Coverage audit reason"
    assert row["user_matricule"] == "TEST001"

    empty = await admin_client.get(
        "/api/v1/audit/logs", params={"action": "does-not-exist"}
    )
    assert empty.status_code == 200
    assert empty.json() == []
