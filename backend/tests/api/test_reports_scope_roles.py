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


async def _user(db, tenant_id, org_unit_id, matricule) -> uuid.UUID:
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
    return user.id


async def _review(db, tenant_id, created_by_id, *, unit=None, person=None) -> None:
    """One import awaiting review, aimed at ``unit`` or at ``person``."""
    job = ImportJob(
        tenant_id=tenant_id,
        created_by_id=created_by_id,
        target_org_unit_id=unit,
        target_user_id=person,
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


async def _activity(db, tenant_id, org_unit_id, matricule, files) -> uuid.UUID:
    """A user of ``org_unit_id`` with one import into that unit awaiting review
    and one local organize run of ``files`` files."""
    user_id = await _user(db, tenant_id, org_unit_id, matricule)
    await _review(db, tenant_id, user_id, unit=org_unit_id)
    db.add(
        LocalOrganizeEvent(
            tenant_id=tenant_id,
            user_id=user_id,
            file_count=files,
            files_unranged=1,
            strategy="by_type",
            mode="zip",
        )
    )
    return user_id


@pytest.fixture
async def tree(db_session, db_seed):
    tenant = db_seed["tenant_id"]
    a = db_seed["org_unit_id"]
    a1 = await _unit(db_session, tenant, "DIR-A1", parent=a)
    b = await _unit(db_session, tenant, "DIR-B")
    agent_a1 = await _activity(db_session, tenant, a1, "AGENTA1", files=3)
    agent_b = await _activity(db_session, tenant, b, "AGENTB", files=7)
    await db_session.commit()
    return {
        "tenant": tenant,
        "a": a,
        "a1": a1,
        "b": b,
        "agent_a1": agent_a1,
        "agent_b": agent_b,
    }


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
async def test_import_reviews_count_for_the_import_target_not_its_creator(
    client_as, tree, db_session
):
    tenant = tree["tenant"]
    admin = await _user(db_session, tenant, None, "ADMINIMP")
    await _review(db_session, tenant, admin, unit=tree["a"])  # admin -> A
    await _review(db_session, tenant, tree["agent_a1"], unit=tree["b"])  # A1 -> B
    await _review(db_session, tenant, tree["agent_b"], person=tree["agent_a1"])
    await db_session.commit()

    async with client_as("manager", tenant_id=tenant, org_unit_id=tree["a"]) as client:
        # Own import + admin's import into A + B's import for a person of A1.
        assert (await _signals(client))[0] == 3
    async with client_as("manager", tenant_id=tenant, org_unit_id=tree["b"]) as client:
        # Own import + A1's import into B; the admin's import into A is not here.
        assert (await _signals(client))[0] == 2
    async with client_as("tenant_admin", tenant_id=tenant, org_unit_id=None) as client:
        assert (await _signals(client))[0] == 5


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
