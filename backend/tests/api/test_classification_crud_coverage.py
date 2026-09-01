import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_classification_domain_activity_rule_crud_and_simulation(
    admin_client: AsyncClient, db_seed
):
    domain_response = await admin_client.post(
        "/api/v1/classification-rules/domains",
        json={
            "code": "Public Procurement",
            "name": "Marches",
            "description": "Domaine achats et marches",
            "is_active": True,
        },
    )
    assert domain_response.status_code == 201
    domain = domain_response.json()
    assert domain["code"] == "public_procurement"

    domains = await admin_client.get("/api/v1/classification-rules/domains")
    assert domains.status_code == 200
    assert any(row["id"] == domain["id"] for row in domains.json())

    domain_patch = await admin_client.patch(
        f"/api/v1/classification-rules/domains/{domain['id']}",
        json={"code": "Public Contracts", "name": "Marches publics"},
    )
    assert domain_patch.status_code == 200
    assert domain_patch.json()["code"] == "public_contracts"

    activity_response = await admin_client.post(
        "/api/v1/classification-rules/activities",
        json={
            "domain_id": domain["id"],
            "code": "Repair Works",
            "name": "Reparation",
            "description": "Travaux de reparation",
            "is_active": True,
        },
    )
    assert activity_response.status_code == 201
    activity = activity_response.json()
    assert activity["code"] == "repair_works"

    activities = await admin_client.get(
        "/api/v1/classification-rules/activities",
        params={"domain_id": domain["id"]},
    )
    assert activities.status_code == 200
    assert any(row["id"] == activity["id"] for row in activities.json())

    activity_patch = await admin_client.patch(
        f"/api/v1/classification-rules/activities/{activity['id']}",
        json={"code": "Maintenance Works", "name": "Maintenance"},
    )
    assert activity_patch.status_code == 200
    assert activity_patch.json()["code"] == "maintenance_works"

    rule_payload = {
        "code": "Coverage Classification Rule",
        "name": "Coverage classification",
        "description": "Exercises the full classification rule contract",
        "priority": 1,
        "is_active": True,
        "source_scope": "service",
        "source_org_unit_id": str(db_seed["org_unit_id"]),
        "source_user_id": None,
        "document_category_id": str(db_seed["category_id"]),
        "filename_pattern": "coverage",
        "mime_type_pattern": "text/plain",
        "target_scope": "service",
        "target_org_unit_id": str(db_seed["org_unit_id"]),
        "target_user_id": None,
        "domain_id": domain["id"],
        "activity_id": activity["id"],
        "year_strategy": "fixed",
        "fixed_year": 2026,
        "workflow_template_id": str(db_seed["template_id"]),
    }
    rule_response = await admin_client.post(
        "/api/v1/classification-rules/rules", json=rule_payload
    )
    assert rule_response.status_code == 201
    rule = rule_response.json()
    assert rule["code"] == "coverage_classification_rule"
    assert rule["domain_name"] == "Marches publics"
    assert rule["activity_name"] == "Maintenance"

    rules = await admin_client.get("/api/v1/classification-rules/rules")
    assert rules.status_code == 200
    assert any(row["id"] == rule["id"] for row in rules.json())

    fetched = await admin_client.get(
        f"/api/v1/classification-rules/rules/{rule['id']}"
    )
    assert fetched.status_code == 200

    patched = await admin_client.patch(
        f"/api/v1/classification-rules/rules/{rule['id']}",
        json={
            "code": "Coverage Rule Updated",
            "name": "Coverage classification updated",
            "priority": 2,
        },
    )
    assert patched.status_code == 200
    assert patched.json()["code"] == "coverage_rule_updated"
    assert patched.json()["priority"] == 2

    simulation = await admin_client.post(
        "/api/v1/classification-rules/simulate",
        json={
            "document_category_id": str(db_seed["category_id"]),
            "source_scope": "service",
            "source_org_unit_id": str(db_seed["org_unit_id"]),
            "source_user_id": str(db_seed["user_id"]),
            "filename": "coverage-note.txt",
            "mime_type": "text/plain",
        },
    )
    assert simulation.status_code == 200
    simulated = simulation.json()
    assert simulated["status"] == "classified"
    assert simulated["rule_id"] == rule["id"]
    assert simulated["classification_year"] == 2026
    assert simulated["classification_domain_name"] == "Marches publics"
    assert simulated["classification_activity_name"] == "Maintenance"

    missing_rule = await admin_client.get(
        f"/api/v1/classification-rules/rules/{uuid.uuid4()}"
    )
    assert missing_rule.status_code == 404

    deleted_rule = await admin_client.delete(
        f"/api/v1/classification-rules/rules/{rule['id']}"
    )
    assert deleted_rule.status_code == 204

    deleted_activity = await admin_client.delete(
        f"/api/v1/classification-rules/activities/{activity['id']}"
    )
    assert deleted_activity.status_code == 204

    inactive_activities = await admin_client.get(
        "/api/v1/classification-rules/activities",
        params={"domain_id": domain["id"], "include_inactive": "true"},
    )
    assert any(
        row["id"] == activity["id"] and row["is_active"] is False
        for row in inactive_activities.json()
    )

    deleted_domain = await admin_client.delete(
        f"/api/v1/classification-rules/domains/{domain['id']}"
    )
    assert deleted_domain.status_code == 204

    inactive_domains = await admin_client.get(
        "/api/v1/classification-rules/domains",
        params={"include_inactive": "true"},
    )
    assert any(
        row["id"] == domain["id"] and row["is_active"] is False
        for row in inactive_domains.json()
    )


@pytest.mark.asyncio
async def test_classification_reference_validation_errors(admin_client: AsyncClient, db_seed):
    invalid_category = await admin_client.post(
        "/api/v1/classification-rules/rules",
        json={
            "code": "invalid-category",
            "name": "Invalid category",
            "source_scope": "service",
            "document_category_id": str(uuid.uuid4()),
            "target_scope": "service",
            "target_org_unit_id": str(db_seed["org_unit_id"]),
            "year_strategy": "current",
        },
    )
    assert invalid_category.status_code == 400

    invalid_org_unit = await admin_client.post(
        "/api/v1/classification-rules/simulate",
        json={
            "source_scope": "service",
            "source_org_unit_id": str(uuid.uuid4()),
            "filename": "nothing.txt",
            "mime_type": "text/plain",
        },
    )
    assert invalid_org_unit.status_code == 400
