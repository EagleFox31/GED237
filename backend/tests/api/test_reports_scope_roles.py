"""Report scope by role (rc.1 scope fix, D-L12-1 and D-L12-2).

One rule (``resolve_report_scope``) for every ``/reports/*`` route and every
counter of their answers. Tree used here, in the seeded institution:
A (seeded unit) > A1, and B, a sibling of A.
"""

import uuid

import pytest

from app.core.security import hash_password
from app.models.classification_review import ClassificationReview
from app.models.import_job import ImportJob
from app.models.import_job_item import ImportJobItem
from app.models.local_organize_event import LocalOrganizeEvent
from app.models.org_unit import OrgUnit, OrgUnitClosure
from app.models.tenant import Tenant
from app.models.user import User

REPORTS = "/api/v1/reports"
PANELS = ["evolution", "document-activity", "workflow-activity", "service-activity"]


async def _unit(db, tenant_id, code, parent=None) -> uuid.UUID:
    unit = OrgUnit(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        parent_id=parent,
        code=code,
        name=f"Service {code}",
        level=2 if parent else 1,
        is_active=True,
    )
    db.add(unit)
    await db.flush()
    if parent:
        db.add(OrgUnitClosure(ancestor_id=parent, descendant_id=unit.id, depth=1))
    return unit.id


async def _activity(db, tenant_id, org_unit_id, matricule, files) -> None:
    """A user of ``org_unit_id`` with one import awaiting review and one local
    organize run of ``files`` files."""
    user = User(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        org_unit_id=org_unit_id,
        role_id=3,
        matricule=matricule,
        email=f"{matricule.lower()}@testministry.gov.cm",
        first_name="Agent",
        last_name=matricule,
        password_hash=hash_password("testpassword123"),
        is_active=True,
    )
    db.add(user)
    await db.flush()
    job = ImportJob(
        tenant_id=tenant_id, created_by_id=user.id, target_org_unit_id=org_unit_id
    )
    db.add(job)
    await db.flush()
    item = ImportJobItem(
        import_job_id=job.id,
        original_filename="note.pdf",
        source_relative_path="note.pdf",
    )
    db.add(item)
    await db.flush()
    db.add(ClassificationReview(tenant_id=tenant_id, import_job_item_id=item.id))
    db.add(
        LocalOrganizeEvent(
            tenant_id=tenant_id,
            user_id=user.id,
            file_count=files,
            files_unranged=1,
            strategy="by_type",
            mode="zip",
        )
    )


@pytest.fixture
async def tree(db_session, db_seed):
    tenant = db_seed["tenant_id"]
    a = db_seed["org_unit_id"]
    a1 = await _unit(db_session, tenant, "DIR-A1", parent=a)
    b = await _unit(db_session, tenant, "DIR-B")
    await _activity(db_session, tenant, a1, "AGENTA1", files=3)
    await _activity(db_session, tenant, b, "AGENTB", files=7)
    await db_session.commit()
    return {"tenant": tenant, "a": a, "a1": a1, "b": b}


async def _signals(client, **params) -> tuple[int, int, int]:
    response = await client.get(f"{REPORTS}/document-activity", params=params)
    assert response.status_code == 200, response.text
    s = response.json()["signals"]
    return (
        s["imports_needing_review"],
        s["local_organize_runs"],
        s["local_organize_files"],
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("panel", PANELS)
async def test_collaborator_has_no_reports(client_as, tree, panel):
    async with client_as(
        "collaborator", tenant_id=tree["tenant"], org_unit_id=tree["a"]
    ) as client:
        response = await client.get(f"{REPORTS}/{panel}")
    assert response.status_code == 403
    assert response.json()["detail"] == (
        "Les rapports ne sont pas accessibles à votre profil."
    )


@pytest.mark.asyncio
async def test_unit_admin_sees_own_unit_and_sub_units_only(client_as, tree):
    async with client_as(
        "unit_admin", tenant_id=tree["tenant"], org_unit_id=tree["a"]
    ) as client:
        default = await client.get(f"{REPORTS}/evolution")
        services = await client.get(f"{REPORTS}/service-activity")
        sibling = [
            await client.get(f"{REPORTS}/{panel}", params={"org_unit_id": tree["b"]})
            for panel in PANELS
        ]
        signals = await _signals(client)

    assert default.status_code == 200
    assert default.json()["filters"]["org_unit_id"] == str(tree["a"])
    assert default.json()["filters"]["recursive"] is True
    seen = {s["id"] for s in services.json()["services"]}
    assert str(tree["b"]) not in seen
    assert seen <= {str(tree["a"]), str(tree["a1"])}
    assert [r.status_code for r in sibling] == [403] * len(PANELS)
    assert signals == (1, 1, 3)


@pytest.mark.asyncio
async def test_manager_signals_count_own_unit_and_sub_units_only(client_as, tree):
    # CA3: an import under review created in B does not show for A.
    async with client_as(
        "manager", tenant_id=tree["tenant"], org_unit_id=tree["a"]
    ) as client:
        assert await _signals(client) == (1, 1, 3)
        # Own unit without sub-units: A1's activity is left out.
        assert await _signals(client, org_unit_id=tree["a"], recursive=False) == (
            0,
            0,
            0,
        )
    async with client_as(
        "manager", tenant_id=tree["tenant"], org_unit_id=tree["b"]
    ) as client:
        assert await _signals(client) == (1, 1, 7)


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["tenant_admin", "auditor"])
async def test_institution_wide_roles_keep_every_signal(client_as, tree, role):
    async with client_as(role, tenant_id=tree["tenant"], org_unit_id=None) as client:
        assert await _signals(client) == (2, 2, 10)
        # An explicit unit narrows the signals like the other counters.
        assert await _signals(client, org_unit_id=tree["b"], recursive=True) == (
            1,
            1,
            7,
        )


@pytest.mark.asyncio
async def test_another_institution_sees_none_of_it(client_as, db_session, tree):
    other = uuid.uuid4()
    db_session.add(
        Tenant(
            id=other,
            name="Autre institution",
            short_name="AUTRE",
            domain=f"autre-{other}.gov.cm",
            is_active=True,
        )
    )
    await db_session.commit()
    async with client_as("tenant_admin", tenant_id=other) as client:
        assert await _signals(client) == (0, 0, 0)
        # Another institution's unit, or its own institution forced: no data.
        assert await _signals(client, org_unit_id=tree["b"], recursive=True) == (
            0,
            0,
            0,
        )
        forced = await client.get(
            f"{REPORTS}/evolution", params={"tenant_id": str(tree["tenant"])}
        )
        assert forced.json()["filters"]["tenant_id"] == str(other)
    async with client_as(
        "unit_admin", tenant_id=other, org_unit_id=uuid.uuid4()
    ) as client:
        outside = await client.get(
            f"{REPORTS}/document-activity", params={"org_unit_id": tree["a"]}
        )
    assert outside.status_code == 403
