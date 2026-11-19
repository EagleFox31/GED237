"""GET /documents filters by creation day and by author (57 L7-3).

created_from / created_to are local calendar days (Cameroon, UTC+1), both inclusive,
like the journal's Du/Au filters; created_at is stored naive in UTC. owner_id only
narrows the caller's read scope: an author outside it gives an empty list.
"""

import uuid
from datetime import datetime, timedelta

import pytest
import pytest_asyncio

from app.core.security import hash_password
from app.models.document import Document
from app.models.org_unit import OrgUnit
from app.models.tenant import Tenant
from app.models.user import User

DOCUMENTS = "/api/v1/documents/"


def _local(day: int, hour: int, minute: int) -> datetime:
    """A local (UTC+1) time in November 2026, as the naive UTC value stored."""
    return datetime(2026, 11, day, hour, minute) - timedelta(hours=1)


def _user(tenant_id, org_unit_id, tag):
    return User(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        org_unit_id=org_unit_id,
        role_id=3,
        matricule=f"{tag}-{uuid.uuid4().hex[:8]}",
        email=f"{tag}-{uuid.uuid4().hex[:8]}@test.gov.cm",
        first_name=tag,
        last_name="Test",
        password_hash=hash_password("testpassword123"),
        is_active=True,
    )


def _unit(tenant_id, code):
    return OrgUnit(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        code=code,
        name=f"Direction {code}",
        level=1,
        is_active=True,
    )


@pytest_asyncio.fixture
async def seed(db_session, db_seed):
    """Five documents around the 10-12 November window, three authors, two units,
    and an author with a document in another tenant."""
    tenant_id = db_seed["tenant_id"]
    other_unit = _unit(tenant_id, "DIR-FILTRES")
    other_tenant = Tenant(
        id=uuid.uuid4(),
        name="Autre institution",
        short_name="AUTRE",
        domain=f"autre-{uuid.uuid4()}.gov.cm",
        is_active=True,
    )
    db_session.add_all([other_unit, other_tenant])
    await db_session.flush()
    foreign_unit = _unit(other_tenant.id, "DIR-AUTRE")
    db_session.add(foreign_unit)
    await db_session.flush()
    colleague = _user(tenant_id, db_seed["org_unit_id"], "COLLEGUE")
    elsewhere = _user(tenant_id, other_unit.id, "AILLEURS")
    foreigner = _user(other_tenant.id, foreign_unit.id, "ETRANGER")
    db_session.add_all([colleague, elsewhere, foreigner])
    await db_session.flush()

    def doc(title, created_at, owner, unit=db_seed["org_unit_id"], **extra):
        return Document(
            id=uuid.uuid4(),
            tenant_id=extra.pop("tenant_id", tenant_id),
            org_unit_id=unit,
            owner_id=owner,
            document_category_id=extra.pop("category", db_seed["category_id"]),
            title=title,
            file_path=f"/tmp/{uuid.uuid4()}.txt",
            created_at=created_at,
            **extra,
        )

    me = db_seed["user_id"]
    docs = {
        "early": doc("Note de service", _local(9, 23, 59), me),
        "first": doc("Rapport annuel", _local(10, 0, 0), me),
        "mid": doc(
            "Rapport autre direction",
            _local(11, 12, 0),
            elsewhere.id,
            unit=other_unit.id,
            status="validated",
        ),
        "last": doc(
            "Rapport mensuel", _local(12, 23, 59), colleague.id, status="validated"
        ),
        "late": doc("Note de cadrage", _local(13, 0, 0), me, status="validated"),
        "foreign": doc(
            "Rapport étranger",
            _local(11, 9, 0),
            foreigner.id,
            unit=foreign_unit.id,
            tenant_id=other_tenant.id,
            category=None,
        ),
    }
    db_session.add_all(docs.values())
    await db_session.commit()
    return {
        "ids": {key: str(d.id) for key, d in docs.items()},
        "me": str(me),
        "colleague": str(colleague.id),
        "elsewhere": str(elsewhere.id),
        "foreigner": str(foreigner.id),
    }


def _keys(response, seed):
    assert response.status_code == 200, response.text
    by_id = {doc_id: key for key, doc_id in seed["ids"].items()}
    return [by_id.get(d["id"], d["id"]) for d in response.json()]


def _admin(client_as, db_seed):
    return client_as(
        "tenant_admin",
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
    )


WINDOW = {"created_from": "2026-11-10", "created_to": "2026-11-12"}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "params, expected",
    [
        ({}, {"early", "first", "mid", "last", "late"}),
        ({"created_from": "2026-11-10"}, {"first", "mid", "last", "late"}),
        ({"created_to": "2026-11-12"}, {"early", "first", "mid", "last"}),
        (WINDOW, {"first", "mid", "last"}),
        # 23:59 local on created_to is in, 00:00 the next day is out.
        ({"created_from": "2026-11-12", "created_to": "2026-11-12"}, {"last"}),
        ({"owner_id": "me"}, {"early", "first", "late"}),
        ({"owner_id": "colleague"}, {"last"}),
        ({**WINDOW, "q": "rapport"}, {"first", "mid", "last"}),
        ({**WINDOW, "q": "rapport", "owner_id": "me"}, {"first"}),
        ({**WINDOW, "status": "validated"}, {"mid", "last"}),
        ({"owner_id": "me", "status": "validated"}, {"late"}),
        ({"owner_id": "me", "q": "cadrage"}, {"late"}),
    ],
)
async def test_filters_alone_and_combined(client_as, db_seed, seed, params, expected):
    params = {
        key: seed.get(value, value) if key == "owner_id" else value
        for key, value in params.items()
    }
    async with _admin(client_as, db_seed) as client:
        found = _keys(await client.get(DOCUMENTS, params=params), seed)
    assert len(found) == len(set(found))
    assert set(found) == expected


@pytest.mark.asyncio
async def test_filters_keep_order_and_pagination(client_as, db_seed, seed):
    async with _admin(client_as, db_seed) as client:
        first = _keys(await client.get(DOCUMENTS, params={**WINDOW, "limit": 2}), seed)
        rest = _keys(
            await client.get(DOCUMENTS, params={**WINDOW, "skip": 2, "limit": 2}), seed
        )
    assert first == ["last", "mid"]
    assert rest == ["first"]


@pytest.mark.asyncio
async def test_start_after_end_is_refused(client_as, db_seed, seed):
    async with _admin(client_as, db_seed) as client:
        response = await client.get(
            DOCUMENTS,
            params={"created_from": "2026-11-12", "created_to": "2026-11-10"},
        )
    assert response.status_code == 422
    assert "created_from" in response.json()["detail"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "params", [{"created_from": "12/11/2026"}, {"owner_id": "pas-un-uuid"}]
)
async def test_malformed_values_are_refused(client_as, db_seed, seed, params):
    async with _admin(client_as, db_seed) as client:
        response = await client.get(DOCUMENTS, params=params)
    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "role, owner, expected",
    [
        # A reader sees their own unit: the colleague's document, not the other unit's.
        ("reader", "colleague", ["last"]),
        ("reader", "elsewhere", []),
        ("reader", "foreigner", []),
        ("tenant_admin", "elsewhere", ["mid"]),
        ("tenant_admin", "foreigner", []),
        ("tenant_admin", "unknown", []),
    ],
)
async def test_owner_outside_scope_gives_an_empty_list(
    client_as, db_seed, seed, role, owner, expected
):
    owner_id = seed.get(owner) or str(uuid.uuid4())
    async with client_as(
        role, tenant_id=db_seed["tenant_id"], org_unit_id=db_seed["org_unit_id"]
    ) as client:
        response = await client.get(DOCUMENTS, params={"owner_id": owner_id})
    assert _keys(response, seed) == expected
