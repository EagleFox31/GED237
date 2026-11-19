"""Read scope by role on the listings (#195, decision D-L12-1).

unit_admin reads its unit and the units below it, like in the reports; the
institution-wide roles (tenant_admin, auditor, super_admin) keep the whole
institution; manager and reader keep their own unit; a collaborator keeps its
own documents. Same answer on GET /documents, /documents/trash, /search,
/documents/stats, /workflows/stats and GET /imports/{job}.

Tree, in the seeded institution: A (seeded unit) > A1 > A2, and B beside A.
No row is written to org_unit_closure: the application never fills it, so the
rule must hold on ``parent_id`` alone.
"""

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio

from app.models.document import Document
from app.models.import_job import ImportJob
from app.models.org_unit import OrgUnit
from app.models.user import User
from app.models.workflow import WorkflowStep
from app.services.reports_scope import is_within_unit_tree, unit_subtree_ids

DOCUMENTS = "/api/v1/documents/"
TRASH = "/api/v1/documents/trash"
WORKSPACE = "/api/v1/documents/workspace"
SEARCH = "/api/v1/search/"
DOCUMENT_STATS = "/api/v1/documents/stats"
WORKFLOW_STATS = "/api/v1/workflows/stats"
IMPORTS = "/api/v1/imports"
SERVICES = "/api/v1/reports/service-activity"
NEEDLE = "perimetre"

WIDE = {"a", "a1", "a2", "b", "own"}
# Institution-wide roles read every batch of the institution, whoever created it.
ALL_JOBS = {"job_a1", "job_b", "job_own"}
# role, unit of the caller, active documents seen, trashed seen, imports readable
MATRIX = [
    ("super_admin", "a", WIDE, {"a1_trash", "b_trash"}, ALL_JOBS),
    ("tenant_admin", "a", WIDE, {"a1_trash", "b_trash"}, ALL_JOBS),
    ("auditor", "a", WIDE, {"a1_trash", "b_trash"}, ALL_JOBS),
    ("unit_admin", "a", {"a", "a1", "a2"}, {"a1_trash"}, {"job_a1"}),
    ("unit_admin", "a1", {"a1", "a2"}, {"a1_trash"}, {"job_a1"}),
    ("manager", "a", {"a"}, set(), set()),
    ("reader", "a", {"a"}, set(), set()),
    ("collaborator", "a", {"own"}, set(), {"job_own"}),
]


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
    # A real account: documents and import jobs reference users.id.
    seeded = await db_session.get(User, db_seed["user_id"])
    collaborator = uuid.uuid4()
    db_session.add(
        User(
            id=collaborator,
            tenant_id=tenant_id,
            org_unit_id=units["b"],
            role_id=seeded.role_id,
            matricule=f"COL-{collaborator.hex[:8]}",
            email=f"{collaborator.hex[:8]}@example.test",
            first_name="Agent",
            last_name="Collaborateur",
            password_hash="unused",
            is_active=True,
        )
    )
    await db_session.flush()

    ids = {}

    async def doc(key, unit, *, owner=None, trashed=False):
        document = Document(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            org_unit_id=units[unit],
            owner_id=owner or db_seed["user_id"],
            document_category_id=db_seed["category_id"],
            title=f"Dossier {NEEDLE} {key}",
            file_path=f"x/{key}.pdf",
            deleted_at=datetime.now(timezone.utc) if trashed else None,
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
        ids[key] = document.id

    for unit in ("a", "a1", "a2", "b"):
        await doc(unit, unit)
    await doc("own", "b", owner=collaborator)
    await doc("a1_trash", "a1", trashed=True)
    await doc("b_trash", "b", trashed=True)

    async def job(key, unit, created_by):
        import_job = ImportJob(
            tenant_id=tenant_id,
            created_by_id=created_by,
            target_org_unit_id=units[unit],
        )
        db_session.add(import_job)
        await db_session.flush()
        ids[key] = import_job.id

    await job("job_a1", "a1", db_seed["user_id"])
    await job("job_b", "b", db_seed["user_id"])
    await job("job_own", "b", collaborator)
    await db_session.commit()
    return {"units": units, "ids": ids, "collaborator": collaborator}


def _keys(tree, found_ids) -> set[str]:
    by_id = {str(value): key for key, value in tree["ids"].items()}
    return {by_id[str(found)] for found in found_ids}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "role,unit,active,trashed,jobs", MATRIX, ids=[f"{r}@{u}" for r, u, *_ in MATRIX]
)
async def test_every_listing_shows_the_same_scope(
    client_as, db_seed, tree, role, unit, active, trashed, jobs
):
    user = {"tenant_id": db_seed["tenant_id"], "org_unit_id": tree["units"][unit]}
    if role == "collaborator":
        user["id"] = tree["collaborator"]
    async with client_as(role, **user) as client:
        listed = (await client.get(DOCUMENTS)).json()
        in_trash = (await client.get(TRASH)).json()
        found = (await client.get(SEARCH, params={"q": NEEDLE, "limit": 100})).json()
        stats = (await client.get(DOCUMENT_STATS)).json()
        workflows = await client.get(WORKFLOW_STATS)
        readable = {
            key
            for key in ("job_a1", "job_b", "job_own")
            if (await client.get(f"{IMPORTS}/{tree['ids'][key]}")).status_code == 200
        }

    assert _keys(tree, [d["id"] for d in listed]) == active
    assert _keys(tree, [d["id"] for d in in_trash]) == trashed
    assert _keys(tree, [h["document_id"] for h in found["hits"]]) == active
    assert (stats["total"], stats["trashed"]) == (len(active), len(trashed))
    if role == "collaborator":
        assert workflows.status_code == 403
    else:
        steps = len(active) + len(trashed)
        assert workflows.json()["active_workflow_steps"] == steps
    assert readable == jobs


@pytest.mark.asyncio
async def test_unit_admin_workspace_stays_in_its_tree(client_as, db_seed, tree):
    units = tree["units"]
    async with client_as(
        "unit_admin", tenant_id=db_seed["tenant_id"], org_unit_id=units["a"]
    ) as client:
        below = await client.get(
            WORKSPACE, params={"org_unit_id": str(units["a1"]), "recursive": "true"}
        )
        beside = await client.get(WORKSPACE, params={"org_unit_id": str(units["b"])})
    async with client_as(
        "unit_admin", tenant_id=db_seed["tenant_id"], org_unit_id=units["a1"]
    ) as client:
        above = await client.get(WORKSPACE, params={"org_unit_id": str(units["a"])})

    assert _keys(tree, [d["id"] for d in below.json()]) == {"a1", "a2"}
    assert beside.status_code == 403
    assert above.status_code == 403


@pytest.mark.asyncio
async def test_unit_admin_opens_by_id_only_in_its_tree(client_as, db_seed, tree):
    """Par id, hors de son sous-arbre, le document n'existe pas pour unit_admin (404)."""
    units, ids = tree["units"], tree["ids"]
    async with client_as(
        "unit_admin", tenant_id=db_seed["tenant_id"], org_unit_id=units["a1"]
    ) as client:
        below = await client.get(f"{DOCUMENTS}{ids['a2']}")
        beside = await client.get(f"{DOCUMENTS}{ids['b']}")
        above = await client.get(f"{DOCUMENTS}{ids['a']}")

    assert below.status_code == 200
    assert beside.status_code == 404
    assert above.status_code == 404


@pytest.mark.asyncio
async def test_unit_admin_edits_only_in_its_tree(client_as, db_seed, tree):
    """PATCH hors de son sous-arbre : 404 et document inchangé ; dans le sous-arbre : 200."""
    units, ids = tree["units"], tree["ids"]
    async with client_as(
        "unit_admin", tenant_id=db_seed["tenant_id"], org_unit_id=units["a"]
    ) as client:
        outside = await client.patch(
            f"{DOCUMENTS}{ids['b']}", json={"title": "Hors perimetre"}
        )
        inside = await client.patch(
            f"{DOCUMENTS}{ids['a2']}", json={"title": "Dans le perimetre"}
        )
    async with client_as(
        "tenant_admin", tenant_id=db_seed["tenant_id"], org_unit_id=units["a"]
    ) as client:
        untouched = await client.get(f"{DOCUMENTS}{ids['b']}")

    assert outside.status_code == 404
    assert inside.status_code == 200
    assert untouched.json()["title"] == f"Dossier {NEEDLE} b"


@pytest.mark.asyncio
async def test_reports_reach_a_grandchild_without_closure_rows(
    client_as, db_seed, tree
):
    units = tree["units"]
    async with client_as(
        "unit_admin", tenant_id=db_seed["tenant_id"], org_unit_id=units["a"]
    ) as client:
        services = await client.get(SERVICES)
        grandchild = await client.get(
            SERVICES, params={"org_unit_id": str(units["a2"])}
        )

    seen = {s["id"] for s in services.json()["services"]}
    assert {str(units["a1"]), str(units["a2"])} <= seen
    assert str(units["b"]) not in seen
    assert grandchild.status_code == 200


@pytest.mark.asyncio
async def test_subtree_follows_parent_links(db_session, db_seed, tree):
    units = tree["units"]
    subtree = set((await db_session.execute(unit_subtree_ids(units["a"]))).scalars())
    assert subtree == {units["a"], units["a1"], units["a2"]}
    assert await is_within_unit_tree(db_session, units["a2"], units["a"])
    assert not await is_within_unit_tree(db_session, units["b"], units["a"])
    assert not await is_within_unit_tree(db_session, units["a"], units["a1"])
