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

import io
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import func, select

from app.api.v1.endpoints import imports
from app.models.audit import AuditLog
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


# Read by id (#202): the same scope as the listings, on every route that opens
# one document. Trashed documents are left out: these routes answer 404 for them.
BY_ID = ("", "/versions", "/audit-logs")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "role,unit,active", [m[:3] for m in MATRIX], ids=[f"{r}@{u}" for r, u, *_ in MATRIX]
)
async def test_reading_a_document_by_id_follows_the_listing_scope(
    client_as, db_seed, tree, role, unit, active
):
    user = {"tenant_id": db_seed["tenant_id"], "org_unit_id": tree["units"][unit]}
    if role == "collaborator":
        user["id"] = tree["collaborator"]
    # Outside the perimeter: 404 like a missing document, for every role
    # (#202 for unit_admin, #247 for the others).
    refused = 404
    readable = {suffix: set() for suffix in BY_ID}
    async with client_as(role, **user) as client:
        for key in WIDE:
            for suffix in BY_ID:
                response = await client.get(f"{DOCUMENTS}{tree['ids'][key]}{suffix}")
                assert response.status_code in (200, refused), (
                    key,
                    suffix,
                    response.text,
                )
                if response.status_code == 200:
                    readable[suffix].add(key)

    assert readable == {suffix: active for suffix in BY_ID}


# Changes by id (#202): unit_admin changes only what it may read. The
# institution-wide roles keep the whole institution.
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "role,unit,reach",
    [
        ("tenant_admin", "a", WIDE),
        ("unit_admin", "a", {"a", "a1", "a2"}),
        ("unit_admin", "a1", {"a1", "a2"}),
        ("unit_admin", "b", {"b", "own"}),
    ],
    ids=["tenant_admin@a", "unit_admin@a", "unit_admin@a1", "unit_admin@b"],
)
async def test_changing_a_document_by_id_follows_the_listing_scope(
    client_as, db_seed, tree, role, unit, reach
):
    ids = tree["ids"]
    changed = {"patch": set(), "lock": set(), "trash": set(), "restore": set()}
    workflow = {}
    # The seeded account: a lock and an audit row reference users.id.
    async with client_as(
        role,
        id=db_seed["user_id"],
        tenant_id=db_seed["tenant_id"],
        org_unit_id=tree["units"][unit],
    ) as client:
        for key in sorted(WIDE):
            url = f"{DOCUMENTS}{ids[key]}"
            # Before the trash: not an archived document, so 400 when allowed and
            # 404 when out of reach.
            workflow[key] = (await client.post(f"{url}/start-workflow")).status_code
            calls = {
                "patch": await client.patch(url, json={"title": f"Renomme {key}"}),
                "lock": await client.post(f"{url}/lock"),
                "trash": await client.post(f"{url}/trash"),
            }
            for name, response in calls.items():
                assert response.status_code in (200, 404), (key, name, response.text)
                if response.status_code == 200:
                    changed[name].add(key)
        for key in ("a1_trash", "b_trash"):
            response = await client.post(f"{DOCUMENTS}{ids[key]}/restore")
            assert response.status_code in (200, 404), (key, response.text)
            if response.status_code == 200:
                changed["restore"].add(key)

    assert changed == {
        "patch": reach,
        "lock": reach,
        "trash": reach,
        "restore": {k for k in ("a1_trash", "b_trash") if k.split("_")[0] in reach},
    }
    assert workflow == {key: 400 if key in reach else 404 for key in WIDE}


@pytest.mark.asyncio
async def test_a_unit_admin_of_another_branch_reaches_nothing_of_it(
    client_as, db_session, db_seed, tree
):
    """Counter-test (#202): the unit_admin of B, beside A, reaches nothing in A."""
    units, ids = tree["units"], tree["ids"]
    async with client_as(
        "unit_admin", tenant_id=db_seed["tenant_id"], org_unit_id=units["b"]
    ) as client:
        reads = {
            key: (await client.get(f"{DOCUMENTS}{ids[key]}")).status_code
            for key in ("a", "a1", "a2", "b")
        }
    assert reads == {"a": 404, "a1": 404, "a2": 404, "b": 200}

    user = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=units["b"],
        role=SimpleNamespace(code="unit_admin"),
    )
    for outside in ("a", "a1", "a2"):
        with pytest.raises(HTTPException) as refused:
            await imports._resolve_target_org_unit_id(
                db_session, current_user=user, target_org_unit_id=units[outside]
            )
        assert refused.value.status_code == 403
    # Unknown or out of the tree: the same refusal, so no existence probe.
    for target in (uuid.uuid4(), db_seed["user_id"]):
        with pytest.raises(HTTPException) as refused:
            await imports._resolve_target_user(
                db_session, current_user=user, target_user_id=target
            )
        assert refused.value.status_code == 403
    with pytest.raises(HTTPException) as refused:
        await imports._resolve_target_org_unit_id(
            db_session, current_user=user, target_org_unit_id=uuid.uuid4()
        )
    assert refused.value.status_code == 403


@pytest.mark.asyncio
async def test_unit_admin_cannot_send_a_document_out_of_its_tree(
    client_as, db_seed, tree
):
    units, ids = tree["units"], tree["ids"]
    async with client_as(
        "unit_admin",
        id=db_seed["user_id"],
        tenant_id=db_seed["tenant_id"],
        org_unit_id=units["a1"],
    ) as client:
        up = await client.patch(
            f"{DOCUMENTS}{ids['a2']}",
            json={"classification_target_org_unit_id": str(units["a"])},
        )
        to_someone_outside = await client.patch(
            f"{DOCUMENTS}{ids['a2']}",
            json={
                "classification_scope": "person",
                "classification_target_user_id": str(tree["collaborator"]),
            },
        )
        # An unknown target answers like an out-of-tree one: no existence probe.
        unknown_unit = await client.patch(
            f"{DOCUMENTS}{ids['a2']}",
            json={"classification_target_org_unit_id": str(uuid.uuid4())},
        )
        unknown_user = await client.patch(
            f"{DOCUMENTS}{ids['a2']}",
            json={
                "classification_scope": "person",
                "classification_target_user_id": str(uuid.uuid4()),
            },
        )
        down = await client.patch(
            f"{DOCUMENTS}{ids['a1']}",
            json={"classification_target_org_unit_id": str(units["a2"])},
        )

    assert up.status_code == 403, up.text
    assert to_someone_outside.status_code == 403, to_someone_outside.text
    assert unknown_unit.json()["detail"] == up.json()["detail"]
    assert (unknown_unit.status_code, unknown_user.status_code) == (403, 403)
    assert unknown_user.json()["detail"] == to_someone_outside.json()["detail"]
    assert down.status_code == 200, down.text
    assert down.json()["org_unit_id"] == str(units["a2"])


@pytest.mark.asyncio
async def test_unit_admin_imports_only_into_its_tree(
    client_as, db_session, db_seed, tree
):
    """Import on behalf of a unit or a person (#202).

    The policy gives unit_admin no documents/create, so the import is refused at
    the door. The target check below holds the tree rule if that ever changes.
    """
    units = tree["units"]
    async with client_as(
        "unit_admin", tenant_id=db_seed["tenant_id"], org_unit_id=units["a1"]
    ) as client:
        door = await client.post(
            f"{IMPORTS}/analyze",
            files=[("files", ("note.txt", io.BytesIO(b"alpha"), "text/plain"))],
            data={"source_scope": "service", "target_org_unit_id": str(units["a2"])},
        )
    assert door.status_code == 403, door.text

    user = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=units["a1"],
        role=SimpleNamespace(code="unit_admin"),
    )
    below = await imports._resolve_target_org_unit_id(
        db_session, current_user=user, target_org_unit_id=units["a2"]
    )
    assert below == units["a2"]
    for outside in (units["b"], units["a"]):
        with pytest.raises(HTTPException) as refused:
            await imports._resolve_target_org_unit_id(
                db_session, current_user=user, target_org_unit_id=outside
            )
        assert refused.value.status_code == 403
    with pytest.raises(HTTPException) as refused:
        await imports._resolve_target_user(
            db_session, current_user=user, target_user_id=tree["collaborator"]
        )
    assert refused.value.status_code == 403


async def _every_route_by_id(client, document_id) -> dict:
    """One call per route that opens a document by id, the destructive ones last."""
    url = f"{DOCUMENTS}{document_id}"
    pdf = {"file": ("v2.pdf", b"%PDF-1.4\n%%EOF\n", "application/pdf")}
    calls = {
        "read": lambda: client.get(url),
        "versions": lambda: client.get(f"{url}/versions"),
        "audit-logs": lambda: client.get(f"{url}/audit-logs"),
        "ocr": lambda: client.get(f"{url}/ocr"),
        "content": lambda: client.get(f"{url}/content"),
        "patch": lambda: client.patch(url, json={"title": "Renomme"}),
        "lock": lambda: client.post(f"{url}/lock"),
        "refresh-lock": lambda: client.post(f"{url}/refresh-lock"),
        "unlock": lambda: client.post(f"{url}/unlock"),
        "new-version": lambda: client.post(f"{url}/versions", files=pdf),
        "start-workflow": lambda: client.post(f"{url}/start-workflow"),
        "resolve-review": lambda: client.post(
            f"{url}/resolve-review", json={"mark_as_resolved": True}
        ),
        "trash": lambda: client.post(f"{url}/trash"),
        "delete": lambda: client.delete(url),
    }
    codes = {}
    for name, call in calls.items():
        response = await call()
        codes[name] = response.status_code
        if response.status_code == 404:
            # Tells a hidden document from a known one whose file is missing.
            codes[name] = (404, response.json().get("detail"))
    return codes


@pytest.mark.asyncio
async def test_every_route_by_id_hides_a_document_outside_the_tree(
    client_as, db_session, db_seed, tree
):
    """#202: out of a unit_admin's tree, every route by id answers 404, before
    any right or state check; inside the tree, none of them does."""
    units, ids = tree["units"], tree["ids"]
    async with client_as(
        "unit_admin",
        id=db_seed["user_id"],
        tenant_id=db_seed["tenant_id"],
        org_unit_id=units["a1"],
    ) as client:
        above = await _every_route_by_id(client, ids["a"])
        inside = await _every_route_by_id(client, ids["a2"])

    hidden = (404, "Document not found")
    assert above == {name: hidden for name in above}
    assert inside == {
        "read": 200,
        "versions": 200,
        "audit-logs": 200,
        "ocr": 200,
        # No file in the test storage: 404 inside too, but only after the
        # consultation is audited (checked below), so past the tree check.
        "content": hidden,
        "patch": 200,
        "lock": 200,
        "refresh-lock": 200,
        "unlock": 200,
        "new-version": 201,
        "start-workflow": 400,
        # Not a review any more: the route moved (#215), the document is reached.
        "resolve-review": 410,
        "trash": 200,
        "delete": 204,
    }
    viewed = select(func.count()).where(
        AuditLog.record_id.in_([ids["a"], ids["a2"]]),
        AuditLog.action == "content_viewed",
    )
    assert (await db_session.execute(viewed)).scalar_one() == 1
