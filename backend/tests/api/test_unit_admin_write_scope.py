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
from app.models.tenant import Tenant
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


@pytest.mark.asyncio
async def test_legacy_needs_review_queue_accepts_a_unit_scope(
    db_session, db_seed, tree
):
    """Guard in advance: the route is tenant_admin only, the service is ready if that changes."""
    service = ClassificationReviewService(db_session)
    for doc in ("doc_a1", "doc_b"):
        document = await db_session.get(Document, tree["ids"][doc])
        document.classification_status = "needs_review"
    await db_session.commit()

    scoped = await service.list_legacy_needs_review_documents(
        tenant_id=db_seed["tenant_id"],
        org_unit_ids=[tree["units"]["a1"], tree["units"]["a2"]],
    )
    wide = await service.list_legacy_needs_review_documents(
        tenant_id=db_seed["tenant_id"]
    )

    assert {d.id for d in scoped} == {tree["ids"]["doc_a1"]}
    assert {tree["ids"]["doc_a1"], tree["ids"]["doc_b"]} <= {d.id for d in wide}


# --- workflow writes by id (O/Q review of #358) ------------------------------


@pytest_asyncio.fixture
async def pending(db_session, tree):
    """One step waiting for an assignee in A1 and one in B."""
    steps = {}
    for key in ("a1", "b"):
        step = WorkflowStep(
            id=uuid.uuid4(),
            document_id=tree["ids"][f"doc_{key}"],
            step_order=2,
            label=f"A assigner {key}",
            status="pending_assignment",
        )
        db_session.add(step)
        steps[key] = step.id
    await db_session.commit()
    return steps


@pytest.mark.asyncio
async def test_start_workflow_on_a_document_of_another_unit_is_a_404(
    client_as, db_seed, tree
):
    async with client_as("unit_admin", **_caller(db_seed, tree)) as client:
        outside = await client.post(
            f"/api/v1/documents/{tree['ids']['doc_b']}/start-workflow"
        )
        inside = await client.post(
            f"/api/v1/documents/{tree['ids']['doc_a1']}/start-workflow"
        )
    assert outside.status_code == 404
    assert inside.status_code != 404


@pytest.mark.asyncio
async def test_defining_steps_on_a_document_of_another_unit_is_a_404(
    client_as, db_seed, tree
):
    doc = str(tree["ids"]["doc_b"])
    body = [{"document_id": doc, "step_order": 1, "label": "Visa"}]
    async with client_as("unit_admin", **_caller(db_seed, tree)) as client:
        outside = await client.post(
            WORKFLOW_STEPS.format(tree["ids"]["doc_b"]), json=body
        )
    assert outside.status_code == 404


@pytest.mark.asyncio
async def test_assigning_a_step_of_another_unit_is_a_404(
    client_as, db_seed, tree, pending
):
    body = {"assigned_to": str(db_seed["user_id"])}
    async with client_as("unit_admin", **_caller(db_seed, tree)) as client:
        outside = await client.post(
            f"/api/v1/workflows/steps/{pending['b']}/assign", json=body
        )
        inside = await client.post(
            f"/api/v1/workflows/steps/{pending['a1']}/assign", json=body
        )
    assert outside.status_code == 404
    assert inside.status_code != 404


@pytest.mark.asyncio
async def test_pending_assignments_list_is_limited_to_the_tree(
    client_as, db_seed, tree, pending
):
    url = "/api/v1/workflows/pending-assignments"
    async with client_as("unit_admin", **_caller(db_seed, tree)) as client:
        scoped = await client.get(url)
    async with client_as("tenant_admin", **_caller(db_seed, tree)) as client:
        wide = await client.get(url)

    assert {s["id"] for s in scoped.json()} == {str(pending["a1"])}
    assert {s["id"] for s in wide.json()} == {str(pending["a1"]), str(pending["b"])}


@pytest.mark.asyncio
async def test_resolving_a_manual_review_of_another_unit_is_a_404(
    client_as, db_seed, tree
):
    async with client_as("unit_admin", **_caller(db_seed, tree)) as client:
        outside = await client.post(
            f"/api/v1/documents/{tree['ids']['doc_b']}/resolve-review",
            json={"mark_as_resolved": True},
        )
    assert outside.status_code == 404


@pytest.mark.asyncio
async def test_rule_target_unit_cannot_be_moved_out_of_the_tree(
    client_as, db_seed, tree
):
    async with client_as("unit_admin", **_caller(db_seed, tree)) as client:
        rules = {r["code"]: r["id"] for r in (await client.get(RULES)).json()}
        moved = await client.patch(
            f"{RULES}/{rules['RULE_A1']}",
            json={"target_org_unit_id": str(tree["units"]["b"])},
        )
        kept = await client.patch(
            f"{RULES}/{rules['RULE_A1']}",
            json={"target_org_unit_id": str(tree["units"]["a2"])},
        )
    assert moved.status_code == 403
    assert kept.status_code == 200


@pytest.mark.asyncio
async def test_legacy_resolve_review_target_must_be_a_unit_of_the_tenant(
    client_as, db_seed, tree, db_session
):
    """#242: the tree check lets every unit through for the institution-wide
    roles, so the target is also checked against the caller's tenant."""
    ids, units = tree["ids"], tree["units"]
    for key in ("doc_a1", "doc_b"):
        returned = await db_session.get(Document, ids[key])
        returned.status = "returned"
        returned.classification_status = "classified"
    other_tenant, foreign_unit, closed_unit = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    db_session.add(
        Tenant(
            id=other_tenant,
            name="Autre institution",
            short_name="AUTRE",
            domain=f"autre-{other_tenant}.gov.cm",
            is_active=True,
        )
    )
    await db_session.flush()
    for unit_id, tenant_id, active in (
        (foreign_unit, other_tenant, True),
        (closed_unit, db_seed["tenant_id"], False),
    ):
        db_session.add(
            OrgUnit(
                id=unit_id,
                tenant_id=tenant_id,
                code=f"OU-{str(unit_id)[:8]}",
                name=f"Service {str(unit_id)[:8]}",
                level=1,
                is_active=active,
            )
        )
    await db_session.commit()

    resolved = {"mark_as_resolved": True}
    url = f"/api/v1/documents/{ids['doc_b']}/resolve-review"
    async with client_as(
        "tenant_admin", id=db_seed["user_id"], **_caller(db_seed, tree, "a")
    ) as client:
        refused = {
            name: await client.post(
                url, json={**resolved, "target_folder_id": str(target)}
            )
            for name, target in (
                ("foreign", foreign_unit),
                ("unknown", uuid.uuid4()),
                ("closed", closed_unit),
            )
        }
        own = await client.post(
            url, json={**resolved, "target_folder_id": str(units["a1"])}
        )
    async with client_as("unit_admin", **_caller(db_seed, tree)) as client:
        bounded = await client.post(
            f"/api/v1/documents/{ids['doc_a1']}/resolve-review",
            json={**resolved, "target_folder_id": str(foreign_unit)},
        )

    assert {
        name: (response.status_code, response.json()["detail"])
        for name, response in refused.items()
    } == {name: (422, "Target folder not found") for name in refused}
    assert own.status_code == 200, own.text
    document = await db_session.get(Document, ids["doc_b"])
    await db_session.refresh(document)
    assert document.org_unit_id == units["a1"]
    assert bounded.status_code == 403, bounded.text
