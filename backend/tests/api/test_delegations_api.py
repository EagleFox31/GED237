"""``/delegations``: create, list, revoke (DEC-2026-007 § 2)."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.models.audit import AuditLog
from app.models.delegation import Delegation
from app.models.notification import Notification

URL = "/api/v1/delegations"
H = timedelta(hours=1)


def _iso(moment: datetime) -> str:
    return moment.isoformat()


def _payload(world, delegator="absent", delegate="standin", start=None, end=None):
    now = datetime.now(timezone.utc)
    users = world["users"]
    return {
        "delegator_id": str(users[delegator].id),
        "delegate_id": str(users[delegate].id),
        "starts_at": _iso(start or now - timedelta(minutes=5)),
        "ends_at": _iso(end or now + 8 * H),
    }


async def _count(db_session, model, *where) -> int:
    return (
        await db_session.execute(select(func.count()).select_from(model).where(*where))
    ).scalar_one()


# ── Creation ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_manager_designates_within_service_once(
    db_session, delegation_world, as_agent
):
    world = delegation_world
    payload = _payload(world)
    async with as_agent("manager_u") as client:
        first = await client.post(URL, json=payload)
        retry = await client.post(URL, json=payload)
    assert first.status_code == 201, first.text
    body = first.json()
    assert body["status"] == "active"
    assert body["delegator"]["full_name"] == "Awa Absente"
    assert body["delegate"]["full_name"] == "Paul Interim"
    assert body["created_by"] == str(world["users"]["manager_u"].id)
    # Identical retry: same delegation, nothing written.
    assert retry.status_code == 200, retry.text
    assert retry.json()["id"] == body["id"]
    assert await _count(db_session, Delegation) == 1
    assert (
        await _count(db_session, AuditLog, AuditLog.action == "delegation_created") == 1
    )
    assert (
        await _count(
            db_session,
            Notification,
            Notification.event_type == "DELEGATION_GRANTED",
            Notification.user_id == world["users"]["standin"].id,
        )
        == 1
    )


@pytest.mark.asyncio
async def test_tenant_admin_designates_in_any_service(delegation_world, as_agent):
    async with as_agent("admin") as client:
        response = await client.post(URL, json=_payload(delegation_world))
    assert response.status_code == 201, response.text


@pytest.mark.asyncio
async def test_manager_of_another_service_is_refused(delegation_world, as_agent):
    async with as_agent("manager_v") as client:
        response = await client.post(URL, json=_payload(delegation_world))
    assert response.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["reader", "third"])
async def test_roles_without_the_right_are_refused(delegation_world, as_agent, role):
    async with as_agent(role) as client:
        response = await client.post(URL, json=_payload(delegation_world))
    assert response.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "delegator,delegate,expected",
    [
        ("manager_u", "standin", 403),  # the creator is the absent agent
        ("absent", "manager_u", 403),  # the creator is the stand-in
        ("absent", "absent", 422),  # same person
        ("absent", "reader", 422),  # cannot resolve reviews
        ("absent", "inactive", 422),
        ("absent", "manager_v", 422),  # another service
        ("absent", "foreign", 404),  # another institution: nothing leaks
    ],
)
async def test_designation_rules(
    db_session, delegation_world, as_agent, delegator, delegate, expected
):
    async with as_agent("manager_u") as client:
        response = await client.post(
            URL, json=_payload(delegation_world, delegator, delegate)
        )
    assert response.status_code == expected, response.text
    assert await _count(db_session, Delegation) == 0


@pytest.mark.asyncio
async def test_period_rules(delegation_world, as_agent):
    now = datetime.now(timezone.utc)
    world = delegation_world
    async with as_agent("manager_u") as client:
        reversed_ = await client.post(
            URL, json=_payload(world, start=now + 2 * H, end=now + H)
        )
        in_the_past = await client.post(
            URL, json=_payload(world, start=now - 2 * H, end=now - H)
        )
        naive = _payload(world)
        naive["starts_at"] = naive["starts_at"][:19]
        naive_response = await client.post(URL, json=naive)
    assert reversed_.status_code == 422
    assert in_the_past.status_code == 422
    assert naive_response.status_code == 422


@pytest.mark.asyncio
async def test_overlap_conflicts_but_back_to_back_is_fine(delegation_world, as_agent):
    now = datetime.now(timezone.utc)
    world = delegation_world
    t1, t2, t3 = now + H, now + 3 * H, now + 5 * H
    async with as_agent("manager_u") as client:
        first = await client.post(URL, json=_payload(world, start=t1, end=t2))
        overlap = await client.post(
            URL, json=_payload(world, delegate="third", start=t1 + H, end=t3)
        )
        next_ = await client.post(
            URL, json=_payload(world, delegate="third", start=t2, end=t3)
        )
    assert first.status_code == 201, first.text
    assert first.json()["status"] == "scheduled"
    assert overlap.status_code == 409
    assert next_.status_code == 201, next_.text


# ── Revocation ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_revoke_is_idempotent_and_allows_a_new_one(
    db_session, delegation_world, as_agent
):
    world = delegation_world
    async with as_agent("manager_u") as client:
        created = (await client.post(URL, json=_payload(world))).json()
        first = await client.post(f"{URL}/{created['id']}/revoke")
        again = await client.post(f"{URL}/{created['id']}/revoke")
        recreated = await client.post(URL, json=_payload(world))
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "revoked"
    assert again.status_code == 200
    assert again.json()["revoked_at"] == first.json()["revoked_at"]
    assert (
        await _count(db_session, AuditLog, AuditLog.action == "delegation_revoked") == 1
    )
    assert (
        await _count(
            db_session, Notification, Notification.event_type == "DELEGATION_REVOKED"
        )
        == 1
    )
    assert recreated.status_code == 201, recreated.text
    assert recreated.json()["id"] != created["id"]


@pytest.mark.asyncio
async def test_manager_of_another_service_cannot_revoke(delegation_world, as_agent):
    async with as_agent("manager_u") as client:
        created = (await client.post(URL, json=_payload(delegation_world))).json()
    async with as_agent("manager_v") as client:
        response = await client.post(f"{URL}/{created['id']}/revoke")
    assert response.status_code == 404


# ── Listing ───────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_is_scoped_and_filtered(delegation_world, as_agent):
    world = delegation_world
    now = datetime.now(timezone.utc)
    async with as_agent("manager_u") as client:
        active = (await client.post(URL, json=_payload(world))).json()
        scheduled = (
            await client.post(
                URL,
                json=_payload(
                    world, "third", "standin", start=now + 2 * H, end=now + 4 * H
                ),
            )
        ).json()
        everything = (await client.get(URL)).json()
        only_active = (await client.get(URL, params={"status": "active"})).json()
        by_absent = (
            await client.get(
                URL, params={"delegator_id": str(world["users"]["third"].id)}
            )
        ).json()
        bad_status = await client.get(URL, params={"status": "whatever"})
    assert {d["id"] for d in everything} == {active["id"], scheduled["id"]}
    assert [d["id"] for d in only_active] == [active["id"]]
    assert [d["id"] for d in by_absent] == [scheduled["id"]]
    assert bad_status.status_code == 422

    async with as_agent("manager_v") as client:
        assert (await client.get(URL)).json() == []
    async with as_agent("admin") as client:
        assert len((await client.get(URL)).json()) == 2
    async with as_agent("reader") as client:
        assert (await client.get(URL)).status_code == 403


@pytest.mark.asyncio
async def test_mine_lists_only_what_concerns_me(delegation_world, as_agent):
    world = delegation_world
    async with as_agent("manager_u") as client:
        created = (await client.post(URL, json=_payload(world))).json()
    for name, expected in (("standin", [created["id"]]), ("absent", [created["id"]])):
        async with as_agent(name) as client:
            assert [
                d["id"] for d in (await client.get(f"{URL}/mine")).json()
            ] == expected
    async with as_agent("reader") as client:
        assert (await client.get(f"{URL}/mine")).json() == []


# ── Database guards ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize("broken", ["same_user", "reversed_period"])
async def test_check_constraints(db_session, delegation_world, broken):
    world = delegation_world
    users = world["users"]
    now = datetime.now(timezone.utc)
    row = Delegation(
        tenant_id=world["tenant_id"],
        org_unit_id=world["units"]["u"],
        delegator_id=users["absent"].id,
        delegate_id=users["absent" if broken == "same_user" else "standin"].id,
        starts_at=now,
        ends_at=now - H if broken == "reversed_period" else now + H,
    )
    db_session.add(row)
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()
