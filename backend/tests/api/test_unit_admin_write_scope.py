"""Write scope of unit_admin (#215): classification reviews and workflows.

policy.csv gives unit_admin ``classification_reviews, manage`` and
``workflows, manage``, which Casbin applies to the whole institution. The code
bounds them to the unit_admin's unit and the units below it, as #195 does for
reads: a resource outside the tree answers 404, a target outside it 403.
The institution-wide roles keep the whole institution.

Tree (see test_unit_admin_read_scope): A (seeded unit) > A1 > A2, and B beside A.
"""

import uuid
from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.core.config import settings
from app.models.classification_activity import ClassificationActivity
from app.models.classification_domain import ClassificationDomain
from app.models.classification_review import ClassificationReview
from app.models.document import Document
from app.models.import_job import ImportJob
from app.models.import_job_item import ImportJobItem
from app.models.workflow import WorkflowStep
from app.services.classification_review_service import ClassificationReviewService
from app.services.reports_scope import in_actor_unit_tree
from tests.api.test_unit_admin_read_scope import tree  # noqa: F401  (fixture)

REVIEWS = "/api/v1/classification-reviews"
WORKFLOWS = "/api/v1/workflows"
DOCUMENTS = "/api/v1/documents"
RESOLVED = {"mark_as_resolved": True}


@pytest.fixture(autouse=True)
def _storage(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path / "storage"))


@pytest_asyncio.fixture
async def scoped(db_session, db_seed, tree):  # noqa: F811
    """Open reviews in A1 and B, a domain to resolve them, steps to assign."""
    tenant_id = db_seed["tenant_id"]
    units, ids = tree["units"], tree["ids"]
    domain = ClassificationDomain(
        id=uuid.uuid4(), tenant_id=tenant_id, code="marches", name="Marches"
    )
    activity = ClassificationActivity(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        domain_id=domain.id,
        code="reparation",
        name="Reparation",
    )
    db_session.add_all([domain, activity])
    reviews = {}
    service = ClassificationReviewService(db_session)
    for key in ("a1", "b"):
        document = await db_session.get(Document, ids[key])
        document.classification_status = "needs_review"
        document.status = "returned"
        review = await service.ensure_open_review_for_document(document=document)
        await db_session.flush()
        reviews[f"doc_{key}"] = review.id

    async def item_review(key, unit, created_by):
        job = ImportJob(
            tenant_id=tenant_id, created_by_id=created_by, target_org_unit_id=unit
        )
        db_session.add(job)
        await db_session.flush()
        item = ImportJobItem(
            import_job_id=job.id,
            original_filename="note.pdf",
            source_relative_path="note.pdf",
        )
        db_session.add(item)
        await db_session.flush()
        review = ClassificationReview(tenant_id=tenant_id, import_job_item_id=item.id)
        db_session.add(review)
        await db_session.flush()
        reviews[key] = review.id

    await item_review("job_a1", units["a1"], tree["collaborator"])
    await item_review("job_b", units["b"], tree["collaborator"])
    # A batch the unit_admin of A sent to B: its own, so it stays visible.
    await item_review("job_own", units["b"], db_seed["user_id"])

    steps = {}
    for key in ("a1", "b"):
        step = (
            await db_session.execute(
                select(WorkflowStep).where(WorkflowStep.document_id == ids[key])
            )
        ).scalar_one()
        steps[key] = step.id
        db_session.add(
            WorkflowStep(
                id=uuid.uuid4(),
                document_id=ids[key],
                step_order=2,
                label="Visa final",
                status="pending_assignment",
            )
        )
    await db_session.commit()
    pending = {
        key: (
            await db_session.execute(
                select(WorkflowStep.id).where(
                    WorkflowStep.document_id == ids[key],
                    WorkflowStep.status == "pending_assignment",
                )
            )
        ).scalar_one()
        for key in ("a1", "b")
    }
    return {
        **tree,
        "reviews": reviews,
        "steps": steps,
        "pending": pending,
        "domain": domain.id,
        "activity": activity.id,
    }


def _as(client_as, db_seed, scoped, role, unit, **extra):
    return client_as(
        role,
        tenant_id=db_seed["tenant_id"],
        org_unit_id=scoped["units"][unit],
        **extra,
    )


def _resolve_body(scoped, target_unit):
    return {
        "classification_domain_id": str(scoped["domain"]),
        "classification_activity_id": str(scoped["activity"]),
        "classification_year": 2026,
        "classification_scope": "service",
        "classification_target_org_unit_id": str(scoped["units"][target_unit]),
        "relaunch_workflow": False,
    }


def _review_keys(scoped, rows) -> set[str]:
    by_id = {str(v): k for k, v in scoped["reviews"].items()}
    return {by_id[row["id"]] for row in rows}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "role,unit,own,expected",
    [
        ("unit_admin", "a", True, {"doc_a1", "job_a1", "job_own"}),
        ("unit_admin", "b", False, {"doc_b", "job_b", "job_own"}),
        ("tenant_admin", "a", False, {"doc_a1", "doc_b", "job_a1", "job_b", "job_own"}),
        ("super_admin", "a", False, {"doc_a1", "doc_b", "job_a1", "job_b", "job_own"}),
    ],
)
async def test_the_review_list_follows_the_unit_tree(
    client_as, db_seed, scoped, role, unit, own, expected
):
    extra = {"id": db_seed["user_id"]} if own else {}
    async with _as(client_as, db_seed, scoped, role, unit, **extra) as client:
        response = await client.get(REVIEWS)
    assert response.status_code == 200, response.text
    assert _review_keys(scoped, response.json()) == expected


@pytest.mark.asyncio
async def test_a_unit_admin_resolves_only_reviews_and_targets_of_its_tree(
    client_as, db_seed, scoped
):
    reviews = scoped["reviews"]
    me = {"id": db_seed["user_id"]}  # successful resolutions are audited
    async with _as(client_as, db_seed, scoped, "unit_admin", "a", **me) as client:
        other_branch = await client.post(
            f"{REVIEWS}/{reviews['doc_b']}/resolve", json=_resolve_body(scoped, "a")
        )
        target_outside = await client.post(
            f"{REVIEWS}/{reviews['doc_a1']}/resolve", json=_resolve_body(scoped, "b")
        )
        inside = await client.post(
            f"{REVIEWS}/{reviews['doc_a1']}/resolve", json=_resolve_body(scoped, "a2")
        )
    assert other_branch.status_code == 404
    assert target_outside.status_code == 403
    assert inside.status_code == 200, inside.text


@pytest.mark.asyncio
async def test_a_unit_admin_of_another_branch_gets_404_on_a_review(
    client_as, db_seed, scoped
):
    """Counter-test: the unit_admin of B does not reach a review of A1."""
    async with _as(client_as, db_seed, scoped, "unit_admin", "b") as client:
        response = await client.post(
            f"{REVIEWS}/{scoped['reviews']['doc_a1']}/resolve",
            json=_resolve_body(scoped, "b"),
        )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_a_tenant_admin_still_resolves_any_review(client_as, db_seed, scoped):
    async with _as(
        client_as, db_seed, scoped, "tenant_admin", "a", id=db_seed["user_id"]
    ) as client:
        response = await client.post(
            f"{REVIEWS}/{scoped['reviews']['doc_b']}/resolve",
            json=_resolve_body(scoped, "b"),
        )
    assert response.status_code == 200, response.text


@pytest.mark.asyncio
async def test_legacy_resolve_review_is_bounded_to_the_tree(
    client_as, db_seed, scoped, db_session
):
    ids, units = scoped["ids"], scoped["units"]
    # The legacy route serves returned documents that are not under review.
    for key in ("a1", "b"):
        document = await db_session.get(Document, ids[key])
        document.classification_status = "classified"
    await db_session.commit()

    me = {"id": db_seed["user_id"]}  # successful resolutions are audited
    async with _as(client_as, db_seed, scoped, "unit_admin", "a", **me) as client:
        other_branch = await client.post(
            f"{DOCUMENTS}/{ids['b']}/resolve-review", json=RESOLVED
        )
        target_outside = await client.post(
            f"{DOCUMENTS}/{ids['a1']}/resolve-review",
            json={**RESOLVED, "target_folder_id": str(units["b"])},
        )
        inside = await client.post(
            f"{DOCUMENTS}/{ids['a1']}/resolve-review", json=RESOLVED
        )
    async with _as(client_as, db_seed, scoped, "unit_admin", "b") as client:
        counter = await client.post(
            f"{DOCUMENTS}/{ids['a1']}/resolve-review", json=RESOLVED
        )
    async with _as(client_as, db_seed, scoped, "tenant_admin", "a", **me) as client:
        wide = await client.post(
            f"{DOCUMENTS}/{ids['b']}/resolve-review", json=RESOLVED
        )

    assert other_branch.status_code == 404
    assert target_outside.status_code == 403
    assert inside.status_code == 200, inside.text
    assert counter.status_code == 404
    assert wide.status_code == 200, wide.text


def _action():
    return {
        "action_type": "visa",
        "outcome": "accepted",
        "document_version_id": str(uuid.uuid4()),
    }


@pytest.mark.asyncio
async def test_a_unit_admin_validates_only_steps_of_its_tree(
    client_as, db_seed, scoped, db_session
):
    steps = scoped["steps"]
    async with _as(client_as, db_seed, scoped, "unit_admin", "a") as client:
        outside = await client.post(
            f"{WORKFLOWS}/step/{steps['b']}/actions", json=_action()
        )
        inside = await client.post(
            f"{WORKFLOWS}/step/{steps['a1']}/actions", json=_action()
        )
    assert outside.status_code == 403
    assert outside.json()["detail"] == "You are not assigned to this step"
    # Past the rights check: refused further on, on the (random) version.
    assert inside.status_code == 400, inside.text

    # An explicit assignment still wins over the tree.
    step = await db_session.get(WorkflowStep, steps["b"])
    step.assigned_to = db_seed["user_id"]
    await db_session.commit()
    async with _as(
        client_as, db_seed, scoped, "unit_admin", "a", id=db_seed["user_id"]
    ) as client:
        assigned = await client.post(
            f"{WORKFLOWS}/step/{steps['b']}/actions", json=_action()
        )
    assert assigned.status_code == 400, assigned.text

    async with _as(client_as, db_seed, scoped, "tenant_admin", "a") as client:
        wide = await client.post(
            f"{WORKFLOWS}/step/{steps['a1']}/actions", json=_action()
        )
    assert wide.status_code == 400, wide.text


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "role,unit,expected",
    [
        ("unit_admin", "a", {"a1"}),
        ("unit_admin", "b", {"b"}),
        ("tenant_admin", "a", {"a1", "b"}),
    ],
)
async def test_pending_assignments_follow_the_unit_tree(
    client_as, db_seed, scoped, role, unit, expected
):
    async with _as(client_as, db_seed, scoped, role, unit) as client:
        response = await client.get(f"{WORKFLOWS}/pending-assignments")
    assert response.status_code == 200, response.text
    by_id = {str(v): k for k, v in scoped["pending"].items()}
    assert {by_id[row["id"]] for row in response.json()} == expected


@pytest.mark.asyncio
async def test_a_unit_admin_cannot_assign_or_read_steps_outside_its_tree(
    client_as, db_seed, scoped
):
    ids, pending = scoped["ids"], scoped["pending"]
    body = {"assigned_to": str(db_seed["user_id"])}
    async with _as(client_as, db_seed, scoped, "unit_admin", "a") as client:
        assign = await client.post(
            f"{WORKFLOWS}/steps/{pending['b']}/assign", json=body
        )
        steps = await client.get(f"{WORKFLOWS}/document/{ids['b']}/steps")
        history = await client.get(f"{WORKFLOWS}/document/{ids['b']}/actions")
        create = await client.post(
            f"{WORKFLOWS}/document/{ids['b']}/steps",
            json=[{"document_id": str(ids["b"]), "step_order": 1, "label": "Visa"}],
        )
        own_tree = await client.get(f"{WORKFLOWS}/document/{ids['a1']}/steps")
    async with _as(client_as, db_seed, scoped, "unit_admin", "a1") as client:
        parent = await client.get(f"{WORKFLOWS}/document/{ids['a']}/steps")

    assert assign.status_code == 404
    assert steps.status_code == 404
    assert history.status_code == 404
    assert create.status_code == 404
    assert own_tree.status_code == 200, own_tree.text
    # The tree goes down, never up.
    assert parent.status_code == 404


@pytest.mark.asyncio
async def test_the_tree_check_fails_closed_for_a_unit_admin(db_session, db_seed):
    unit_admin = SimpleNamespace(
        role=SimpleNamespace(code="unit_admin"), org_unit_id=None
    )
    unit = db_seed["org_unit_id"]
    assert not await in_actor_unit_tree(db_session, unit_admin, unit)
    unit_admin.org_unit_id = unit
    assert not await in_actor_unit_tree(db_session, unit_admin, None)
    assert not await in_actor_unit_tree(None, unit_admin, unit)
    assert await in_actor_unit_tree(db_session, unit_admin, unit)

    other = SimpleNamespace(role=SimpleNamespace(code="tenant_admin"), org_unit_id=None)
    assert await in_actor_unit_tree(None, other, None)
