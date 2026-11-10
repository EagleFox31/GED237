"""Lot 2 (V1.1): export and import of classification rules as a portable JSON file."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.classification_activity import ClassificationActivity
from app.models.classification_domain import ClassificationDomain
from app.models.classification_rule import ClassificationRule
from app.models.org_unit import OrgUnit
from app.models.tenant import Tenant

BASE = "/api/v1/classification-rules/rules"


async def _seed_rules(test_engine, db_seed) -> None:
    """Two rules: one using every kind of reference, one inactive with a fixed year."""
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        domain = ClassificationDomain(
            tenant_id=db_seed["tenant_id"], code="rh", name="RH", is_active=True
        )
        session.add(domain)
        await session.flush()
        activity = ClassificationActivity(
            tenant_id=db_seed["tenant_id"],
            domain_id=domain.id,
            code="conges",
            name="Conges",
            is_active=True,
        )
        session.add(activity)
        child = OrgUnit(
            tenant_id=db_seed["tenant_id"],
            parent_id=db_seed["org_unit_id"],
            code="DIR-SOUS",
            name="Sous-direction",
            level=2,
            is_active=True,
        )
        session.add(child)
        await session.flush()
        session.add_all(
            [
                ClassificationRule(
                    tenant_id=db_seed["tenant_id"],
                    code="rh_conges",
                    name="Conges RH",
                    description="Demandes de conge",
                    priority=10,
                    is_active=True,
                    source_scope="person",
                    source_user_ids=[str(db_seed["user_id"])],
                    document_category_ids=[str(db_seed["category_id"])],
                    source_org_unit_ids=[str(db_seed["org_unit_id"])],
                    source_org_unit_excluded_ids=[str(child.id)],
                    filename_pattern="conge",
                    mime_type_pattern="pdf",
                    target_scope="service",
                    target_org_unit_id=db_seed["org_unit_id"],
                    domain_id=domain.id,
                    activity_id=activity.id,
                    year_strategy="current",
                    workflow_template_id=db_seed["template_id"],
                ),
                ClassificationRule(
                    tenant_id=db_seed["tenant_id"],
                    code="archives_2020",
                    name="Archives 2020",
                    priority=50,
                    is_active=False,
                    source_scope="service",
                    source_org_unit_id=db_seed["org_unit_id"],
                    target_scope="service",
                    target_org_unit_id=db_seed["org_unit_id"],
                    year_strategy="fixed",
                    fixed_year=2020,
                ),
            ]
        )
        await session.commit()


async def _rule_count(test_engine, tenant_id) -> int:
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        return await session.scalar(
            select(func.count())
            .select_from(ClassificationRule)
            .where(ClassificationRule.tenant_id == tenant_id)
        )


async def _delete_rules(test_engine, tenant_id) -> None:
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        for rule in (
            await session.execute(
                select(ClassificationRule).where(
                    ClassificationRule.tenant_id == tenant_id
                )
            )
        ).scalars():
            await session.delete(rule)
        await session.commit()


async def _export(client: AsyncClient) -> dict:
    response = await client.get(f"{BASE}/export")
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.asyncio
async def test_export_writes_codes_not_ids(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed_rules(test_engine, db_seed)

    response = await admin_client.get(f"{BASE}/export")

    assert response.status_code == 200
    disposition = response.headers["content-disposition"]
    assert disposition.startswith('attachment; filename="regles-classement-testmin-')
    body = response.json()
    assert body["format"] == "ged237-classification-rules"
    assert body["version"] == 1
    assert body["tenant_code"] == "TESTMIN"
    assert [rule["code"] for rule in body["rules"]] == ["rh_conges", "archives_2020"]
    first = body["rules"][0]
    assert first["source_user_matricules"] == ["TEST001"]
    assert first["document_category_codes"] == ["note_de_service"]
    assert first["source_org_unit_codes"] == ["DIR-TEST"]
    assert first["source_org_unit_excluded_codes"] == ["DIR-SOUS"]
    assert first["target_org_unit_code"] == "DIR-TEST"
    assert first["domain_code"] == "rh"
    assert first["activity_code"] == "conges"
    assert first["workflow_template_code"] == "NS_TEMPLATE"
    assert str(db_seed["org_unit_id"]) not in response.text
    assert body["rules"][1]["is_active"] is False
    assert body["rules"][1]["fixed_year"] == 2020


@pytest.mark.asyncio
async def test_roundtrip_recreates_identical_rules_and_second_import_is_noop(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed_rules(test_engine, db_seed)
    exported = await _export(admin_client)
    await _delete_rules(test_engine, db_seed["tenant_id"])

    first = await admin_client.post(f"{BASE}/import?dry_run=false", json=exported)
    second = await admin_client.post(f"{BASE}/import?dry_run=false", json=exported)

    assert first.status_code == 200, first.text
    assert first.json()["created"] == 2 and first.json()["applied"] is True
    reexported = await _export(admin_client)
    assert reexported["rules"] == exported["rules"]
    report = second.json()
    assert (report["created"], report["updated"], report["skipped"]) == (0, 0, 2)
    assert {item["reason"] for item in report["items"]} == {"identique"}


@pytest.mark.asyncio
async def test_upsert_updates_and_create_only_skips_changed_rule(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed_rules(test_engine, db_seed)
    exported = await _export(admin_client)
    exported["rules"][0]["priority"] = 7

    create_only = await admin_client.post(
        f"{BASE}/import?dry_run=false&mode=create_only", json=exported
    )
    upsert = await admin_client.post(
        f"{BASE}/import?dry_run=false&mode=upsert", json=exported
    )

    assert create_only.json()["items"][0] == {
        "code": "rh_conges",
        "action": "skip",
        "reason": "existe deja",
    }
    assert upsert.json()["items"][0] == {
        "code": "rh_conges",
        "action": "update",
        "reason": None,
    }
    assert (await _export(admin_client))["rules"][0]["priority"] == 7


@pytest.mark.asyncio
async def test_dry_run_reports_without_writing(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed_rules(test_engine, db_seed)
    exported = await _export(admin_client)
    await _delete_rules(test_engine, db_seed["tenant_id"])

    response = await admin_client.post(f"{BASE}/import", json=exported)

    report = response.json()
    assert response.status_code == 200
    assert report["dry_run"] is True and report["applied"] is False
    assert report["created"] == 2
    assert await _rule_count(test_engine, db_seed["tenant_id"]) == 0


@pytest.mark.asyncio
async def test_unknown_reference_rejects_and_writes_nothing(
    admin_client: AsyncClient, test_engine, db_seed
):
    await _seed_rules(test_engine, db_seed)
    exported = await _export(admin_client)
    await _delete_rules(test_engine, db_seed["tenant_id"])
    exported["rules"][1]["source_org_unit_code"] = "DIR-INCONNUE"

    response = await admin_client.post(f"{BASE}/import?dry_run=false", json=exported)

    report = response.json()
    assert response.status_code == 200
    assert report["applied"] is False
    assert (report["created"], report["rejected"]) == (1, 1)
    rejected = report["items"][1]
    assert rejected["action"] == "reject"
    assert (
        "source_org_unit_code" in rejected["reason"]
        and "DIR-INCONNUE" in rejected["reason"]
    )
    assert await _rule_count(test_engine, db_seed["tenant_id"]) == 0


@pytest.mark.asyncio
async def test_invalid_rule_and_duplicate_code_are_rejected(
    admin_client: AsyncClient, db_seed
):
    rule = {
        "code": "Mauvaise Regle",
        "name": "x",
        "source_scope": "service",
        "target_scope": "service",
        "target_org_unit_code": "DIR-TEST",
        "year_strategy": "fixed",
    }
    file = {
        "format": "ged237-classification-rules",
        "version": 1,
        "rules": [rule, dict(rule)],
    }

    report = (await admin_client.post(f"{BASE}/import", json=file)).json()

    assert [item["action"] for item in report["items"]] == ["reject", "reject"]
    assert report["items"][0]["code"] == "mauvaise_regle"
    assert "annee fixe" in report["items"][0]["reason"]
    assert "plusieurs fois" in report["items"][1]["reason"]


@pytest.mark.asyncio
async def test_import_resolves_codes_in_the_importing_tenant_only(
    admin_client: AsyncClient, client_as, test_engine, db_seed
):
    await _seed_rules(test_engine, db_seed)
    exported = await _export(admin_client)
    other_tenant, other_unit = uuid.uuid4(), uuid.uuid4()
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        session.add(
            Tenant(
                id=other_tenant,
                name="Autre",
                short_name="AUTRE",
                domain=f"autre-{other_tenant}.cm",
            )
        )
        await session.flush()
        session.add(
            OrgUnit(
                id=other_unit,
                tenant_id=other_tenant,
                code="DIR-TEST",
                name="Autre DIR",
                level=1,
            )
        )
        await session.commit()
    simple = {**exported, "rules": [exported["rules"][1]]}

    async with client_as(
        "super_admin", tenant_id=other_tenant, org_unit_id=other_unit
    ) as client:
        assert (await _export(client))["rules"] == []
        full = (await client.post(f"{BASE}/import", json=exported)).json()
        applied = (
            await client.post(f"{BASE}/import?dry_run=false", json=simple)
        ).json()
        reexported = await _export(client)

    assert full["rejected"] == 1 and "introuvable" in full["items"][0]["reason"]
    assert applied["applied"] is True
    assert reexported["rules"][0]["target_org_unit_code"] == "DIR-TEST"
    async with session_factory() as session:
        imported = (
            await session.execute(
                select(ClassificationRule).where(
                    ClassificationRule.tenant_id == other_tenant
                )
            )
        ).scalar_one()
    assert imported.target_org_unit_id == other_unit
    assert await _rule_count(test_engine, db_seed["tenant_id"]) == 2


@pytest.mark.asyncio
async def test_unknown_format_or_too_many_rules_is_422(admin_client: AsyncClient):
    wrong_format = await admin_client.post(
        f"{BASE}/import", json={"format": "autre", "version": 1, "rules": []}
    )
    wrong_version = await admin_client.post(
        f"{BASE}/import",
        json={"format": "ged237-classification-rules", "version": 2, "rules": []},
    )
    too_many = await admin_client.post(
        f"{BASE}/import",
        json={
            "format": "ged237-classification-rules",
            "version": 1,
            "rules": [{}] * 501,
        },
    )

    assert (
        wrong_format.status_code,
        wrong_version.status_code,
        too_many.status_code,
    ) == (422, 422, 422)


@pytest.mark.asyncio
async def test_reader_cannot_import(client_as, db_seed):
    file = {"format": "ged237-classification-rules", "version": 1, "rules": []}
    async with client_as("reader", tenant_id=db_seed["tenant_id"]) as client:
        response = await client.post(f"{BASE}/import", json=file)
    assert response.status_code == 403
