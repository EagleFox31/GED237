"""unit_admin stays inside its unit tree on the routes that #195 left institution-wide.

Tree, in the seeded institution: A (seeded unit) > A1 > A2, and B beside A.
Covered: GET /analytics/tenant, workflow reads, the import target unit and
``_can_commit_job``, the classification review queue, the classification rules
(read and write). tenant_admin must keep the whole institution on every one.

``test_unit_admin_crawl`` is the preventive control of LESSON-2026-055: every route
that takes a unit or a document of another unit must answer a unit_admin of A1 with
403/404 for B, and never with a body that carries B's data.
"""

import uuid
from types import SimpleNamespace

import pytest
import pytest_asyncio
from fastapi import HTTPException

from app.api.v1.endpoints.imports import (
    _can_commit_job,
    _resolve_target_org_unit_id,
)
from app.models.classification_review import ClassificationReview
from app.models.classification_rule import ClassificationRule
from app.models.document import Document
from app.models.import_job import ImportJob
from app.models.org_unit import OrgUnit
from app.models.workflow import WorkflowStep
from app.services.classification_review_service import ClassificationReviewService

ANALYTICS = "/api/v1/analytics/tenant"
REVIEWS = "/api/v1/classification-reviews"
RULES = "/api/v1/classification-rules/rules"
WORKFLOW_STEPS = "/api/v1/workflows/document/{}/steps"


async def _unit(db, tenant_id, parent=None) -> uuid.UUID:
    unit_id = uuid.uuid4()
    db.add(
        OrgUnit(
            id=unit_id,
            tenant_id=tenant_id,
            parent_id=parent,
            code=f"OU-{str(unit_id)[:8]}",
            name=f"Service {str(unit_id)[:8]}",
            level=2 if parent else 1,
            is_active=True,
        )
    )
    await db.flush()
    return unit_id


@pytest_asyncio.fixture
async def tree(db_session, db_seed):
    tenant_id = db_seed["tenant_id"]
    units = {"a": db_seed["org_unit_id"]}
    units["a1"] = await _unit(db_session, tenant_id, units["a"])
    units["a2"] = await _unit(db_session, tenant_id, units["a1"])
    units["b"] = await _unit(db_session, tenant_id)

    ids = {}
    for key in ("a1", "b"):
        document = Document(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            org_unit_id=units[key],
            owner_id=db_seed["user_id"],
            document_category_id=db_seed["category_id"],
            title=f"Dossier {key}",
            file_path=f"x/{key}.pdf",
        )
        db_session.add(document)
        await db_session.flush()
        db_session.add(
            WorkflowStep(
                id=uuid.uuid4(),
                document_id=document.id,
                step_order=1,
                label="Visa",
                status="current",
            )
        )
        review = ClassificationReview(
            tenant_id=tenant_id, document_id=document.id, review_status="open"
        )
        db_session.add(review)
        await db_session.flush()
        ids[f"doc_{key}"] = document.id
        ids[f"review_{key}"] = review.id

    for key, unit in (("rule_a1", "a1"), ("rule_b", "b"), ("rule_all", None)):
        db_session.add(
            ClassificationRule(
                tenant_id=tenant_id,
                code=key.upper(),
                name=key,
                source_scope="service",
                source_org_unit_id=units[unit] if unit else None,
                target_scope="service",
            )
        )
    await db_session.commit()
    return {"units": units, "ids": ids}


def _caller(db_seed, tree, unit="a1"):
    return {"tenant_id": db_seed["tenant_id"], "org_unit_id": tree["units"][unit]}


@pytest.mark.asyncio
async def test_analytics_tenant_is_computed_on_the_unit_tree(client_as, db_seed, tree):
    async with client_as("unit_admin", **_caller(db_seed, tree)) as client:
        scoped = await client.get(ANALYTICS)
    async with client_as("tenant_admin", **_caller(db_seed, tree)) as client:
        wide = await client.get(ANALYTICS)

    assert scoped.status_code == 200
    assert scoped.json()["documents"]["total"] == 1  # A1 only, not B
    assert wide.status_code == 200
    assert wide.json()["documents"]["total"] == 2  # tenant_admin unchanged
    assert scoped.json()["users"]["total"] < wide.json()["users"]["total"]


@pytest.mark.asyncio
async def test_analytics_tenant_unit_admin_without_unit_sees_nothing(
    client_as, db_seed, tree
):
    async with client_as(
        "unit_admin", tenant_id=db_seed["tenant_id"], org_unit_id=None
    ) as client:
        response = await client.get(ANALYTICS)

    assert response.status_code == 200
    assert response.json()["documents"]["total"] == 0


@pytest.mark.asyncio
async def test_workflow_steps_of_another_unit_are_refused(client_as, db_seed, tree):
    async with client_as("unit_admin", **_caller(db_seed, tree)) as client:
        inside = await client.get(WORKFLOW_STEPS.format(tree["ids"]["doc_a1"]))
        outside = await client.get(WORKFLOW_STEPS.format(tree["ids"]["doc_b"]))
    async with client_as("tenant_admin", **_caller(db_seed, tree)) as client:
        wide = await client.get(WORKFLOW_STEPS.format(tree["ids"]["doc_b"]))

    assert inside.status_code == 200
    assert outside.status_code in (403, 404)
    assert wide.status_code == 200


@pytest.mark.asyncio
async def test_import_target_unit_must_be_in_the_tree(db_session, db_seed, tree):
    def user(role):
        return SimpleNamespace(
            id=uuid.uuid4(),
            tenant_id=db_seed["tenant_id"],
            org_unit_id=tree["units"]["a1"],
            role=SimpleNamespace(code=role),
        )

    resolved = await _resolve_target_org_unit_id(
        db_session,
        current_user=user("unit_admin"),
        target_org_unit_id=tree["units"]["a2"],
    )
    assert resolved == tree["units"]["a2"]

    with pytest.raises(HTTPException) as refused:
        await _resolve_target_org_unit_id(
            db_session,
            current_user=user("unit_admin"),
            target_org_unit_id=tree["units"]["b"],
        )
    assert refused.value.status_code == 403

    unchanged = await _resolve_target_org_unit_id(
        db_session,
        current_user=user("tenant_admin"),
        target_org_unit_id=tree["units"]["b"],
    )
    assert unchanged == tree["units"]["b"]


@pytest.mark.asyncio
async def test_commit_is_limited_to_batches_of_the_tree(db_session, db_seed, tree):
    def job(unit):
        return ImportJob(
            tenant_id=db_seed["tenant_id"],
            created_by_id=uuid.uuid4(),  # someone else
            target_org_unit_id=tree["units"][unit],
        )

    def user(role):
        return SimpleNamespace(
            id=uuid.uuid4(),
            tenant_id=db_seed["tenant_id"],
            org_unit_id=tree["units"]["a1"],
            role=SimpleNamespace(code=role),
        )

    assert await _can_commit_job(db_session, user("unit_admin"), job("a2")) is True
    assert await _can_commit_job(db_session, user("unit_admin"), job("b")) is False
    assert await _can_commit_job(db_session, user("tenant_admin"), job("b")) is True


@pytest.mark.asyncio
async def test_review_queue_is_limited_to_the_tree(client_as, db_seed, tree):
    async with client_as("unit_admin", **_caller(db_seed, tree)) as client:
        scoped = (await client.get(REVIEWS)).json()
    async with client_as("tenant_admin", **_caller(db_seed, tree)) as client:
        wide = (await client.get(REVIEWS)).json()

    assert {str(r["id"]) for r in scoped} == {str(tree["ids"]["review_a1"])}
    assert {str(r["id"]) for r in wide} == {
        str(tree["ids"]["review_a1"]),
        str(tree["ids"]["review_b"]),
    }


@pytest.mark.asyncio
async def test_resolving_a_review_of_another_unit_is_a_404(db_session, db_seed, tree):
    service = ClassificationReviewService(db_session)
    in_tree = [tree["units"]["a1"], tree["units"]["a2"]]

    review = await service._get_review_or_404(
        review_id=tree["ids"]["review_a1"],
        tenant_id=db_seed["tenant_id"],
        org_unit_ids=in_tree,
    )
    assert review.id == tree["ids"]["review_a1"]
    with pytest.raises(HTTPException) as refused:
        await service._get_review_or_404(
            review_id=tree["ids"]["review_b"],
            tenant_id=db_seed["tenant_id"],
            org_unit_ids=in_tree,
        )
    assert refused.value.status_code == 404


@pytest.mark.asyncio
async def test_rules_are_limited_to_the_tree(client_as, db_seed, tree):
    async with client_as("unit_admin", **_caller(db_seed, tree)) as client:
        scoped = {r["code"] for r in (await client.get(RULES)).json()}
    async with client_as("tenant_admin", **_caller(db_seed, tree)) as client:
        wide = {r["code"] for r in (await client.get(RULES)).json()}

    # Institution-wide rules stay readable; the rule aimed at B is hidden.
    assert scoped == {"RULE_A1", "RULE_ALL"}
    assert wide == {"RULE_A1", "RULE_B", "RULE_ALL"}


@pytest.mark.asyncio
async def test_rules_cannot_be_written_outside_the_tree(client_as, db_seed, tree):
    body = {
        "code": "NEW",
        "name": "Nouvelle",
        "source_scope": "service",
        "target_scope": "service",
    }
    async with client_as("unit_admin", **_caller(db_seed, tree)) as client:
        elsewhere = await client.post(
            RULES, json={**body, "source_org_unit_id": str(tree["units"]["b"])}
        )
        institution_wide = await client.post(RULES, json=body)
        rules = {r["code"]: r["id"] for r in (await client.get(RULES)).json()}
        patch_global = await client.patch(
            f"{RULES}/{rules['RULE_ALL']}", json={"name": "x"}
        )
        delete_global = await client.delete(f"{RULES}/{rules['RULE_ALL']}")
        export = await client.get(f"{RULES}/export")

    assert elsewhere.status_code == 403
    assert institution_wide.status_code == 403
    assert patch_global.status_code == 403
    assert delete_global.status_code == 403
    assert export.status_code == 403


@pytest.mark.asyncio
async def test_tenant_admin_still_writes_institution_wide_rules(
    client_as, db_seed, tree
):
    async with client_as("tenant_admin", **_caller(db_seed, tree)) as client:
        rules = {r["code"]: r["id"] for r in (await client.get(RULES)).json()}
        patched = await client.patch(
            f"{RULES}/{rules['RULE_ALL']}", json={"name": "Renommee"}
        )

    assert patched.status_code == 200


@pytest.mark.asyncio
async def test_unit_admin_crawl(client_as, db_seed, tree):
    """Every route naming a document, review or rule of unit B is closed to A1."""
    ids = tree["ids"]
    async with client_as("unit_admin", **_caller(db_seed, tree)) as client:
        rules = {r["code"]: r["id"] for r in (await client.get(RULES)).json()}
        assert "RULE_B" not in rules
        calls = [
            await client.get(WORKFLOW_STEPS.format(ids["doc_b"])),
            await client.get(f"/api/v1/workflows/document/{ids['doc_b']}/actions"),
        ]
        leaked = (await client.get(REVIEWS)).text + (await client.get(ANALYTICS)).text

    assert all(call.status_code in (403, 404) for call in calls)
    assert str(ids["doc_b"]) not in leaked
    assert str(ids["review_b"]) not in leaked
