import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_gedrules_template_and_rule_crud(admin_client: AsyncClient, db_seed):
    empty_template = await admin_client.post(
        "/api/v1/gedrules/templates",
        json={
            "code": "EMPTY_COV",
            "name": "Empty coverage template",
            "is_active": True,
            "steps": [],
        },
    )
    assert empty_template.status_code == 400

    template_response = await admin_client.post(
        "/api/v1/gedrules/templates",
        json={
            "code": "COVERAGE_TEMPLATE",
            "name": "Coverage Template",
            "description": "Template CRUD coverage",
            "is_active": True,
            "steps": [
                {
                    "step_order": 1,
                    "label": "Visa coverage",
                    "expected_action_type": "visa",
                    "role_id": db_seed["role_id"],
                    "assignment_scope": "same_org_unit",
                }
            ],
        },
    )
    assert template_response.status_code == 201
    template = template_response.json()
    assert len(template["steps"]) == 1

    templates = await admin_client.get("/api/v1/gedrules/templates")
    assert templates.status_code == 200
    assert any(row["id"] == template["id"] for row in templates.json())

    fetched = await admin_client.get(f"/api/v1/gedrules/templates/{template['id']}")
    assert fetched.status_code == 200

    template_name_update = await admin_client.put(
        f"/api/v1/gedrules/templates/{template['id']}",
        json={"name": "Coverage Template Updated"},
    )
    assert template_name_update.status_code == 200
    assert template_name_update.json()["name"] == "Coverage Template Updated"

    invalid_categories = await admin_client.post(
        "/api/v1/gedrules/rules",
        json={
            "code": "INVALID_CAT_COV",
            "name": "Invalid categories",
            "priority": 3,
            "is_active": True,
            "document_category_ids": [str(uuid.uuid4())],
            "org_unit_ids": [],
            "workflow_template_id": template["id"],
        },
    )
    assert invalid_categories.status_code == 400

    rule_response = await admin_client.post(
        "/api/v1/gedrules/rules",
        json={
            "code": "COVERAGE_RULE",
            "name": "Coverage Rule",
            "description": "Routing rule CRUD coverage",
            "priority": 3,
            "is_active": True,
            "document_category_ids": [str(db_seed["category_id"])],
            "org_unit_ids": [str(db_seed["org_unit_id"])],
            "workflow_template_id": template["id"],
        },
    )
    assert rule_response.status_code == 201
    rule = rule_response.json()
    assert rule["category_codes"] == ["note_de_service"]

    rules = await admin_client.get("/api/v1/gedrules/rules")
    assert rules.status_code == 200
    assert any(row["id"] == rule["id"] for row in rules.json())

    blocked_template_steps = await admin_client.put(
        f"/api/v1/gedrules/templates/{template['id']}",
        json={
            "steps": [
                {
                    "step_order": 1,
                    "label": "Replacement step",
                    "expected_action_type": "visa",
                    "role_id": db_seed["role_id"],
                    "assignment_scope": "same_org_unit",
                }
            ]
        },
    )
    assert blocked_template_steps.status_code == 400

    simulation = await admin_client.post(
        "/api/v1/gedrules/simulate",
        json={
            "document_category_id": str(db_seed["category_id"]),
            "org_unit_id": str(db_seed["org_unit_id"]),
            "owner_id": str(db_seed["user_id"]),
        },
    )
    assert simulation.status_code == 200
    simulated = simulation.json()
    assert simulated["matched_rule_id"] == rule["id"]
    assert simulated["template_id"] == template["id"]
    assert simulated["resolved_steps"]

    updated_rule = await admin_client.put(
        f"/api/v1/gedrules/rules/{rule['id']}",
        json={
            "name": "Coverage Rule Updated",
            "priority": 4,
            "is_active": False,
            "document_category_ids": [str(db_seed["category_id"])],
            "org_unit_ids": [],
        },
    )
    assert updated_rule.status_code == 200
    assert updated_rule.json()["priority"] == 4
    assert updated_rule.json()["is_active"] is False

    replace_steps = await admin_client.put(
        f"/api/v1/gedrules/templates/{template['id']}",
        json={
            "steps": [
                {
                    "step_order": 1,
                    "label": "Replacement step",
                    "expected_action_type": "visa",
                    "role_id": db_seed["role_id"],
                    "assignment_scope": "same_org_unit",
                },
                {
                    "step_order": 2,
                    "label": "Second replacement step",
                    "expected_action_type": "visa",
                    "role_id": db_seed["role_id"],
                    "assignment_scope": "same_org_unit",
                },
            ]
        },
    )
    assert replace_steps.status_code == 200
    assert len(replace_steps.json()["steps"]) == 2

    blocked_delete = await admin_client.delete(
        f"/api/v1/gedrules/templates/{template['id']}"
    )
    assert blocked_delete.status_code == 400

    deleted_rule = await admin_client.delete(f"/api/v1/gedrules/rules/{rule['id']}")
    assert deleted_rule.status_code == 204

    deleted_template = await admin_client.delete(
        f"/api/v1/gedrules/templates/{template['id']}"
    )
    assert deleted_template.status_code == 204

    missing_template = await admin_client.get(
        f"/api/v1/gedrules/templates/{uuid.uuid4()}"
    )
    assert missing_template.status_code == 404

    missing_rule = await admin_client.delete(f"/api/v1/gedrules/rules/{uuid.uuid4()}")
    assert missing_rule.status_code == 404
