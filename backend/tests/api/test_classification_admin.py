from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.classification_activity import ClassificationActivity
from app.models.classification_domain import ClassificationDomain
from app.models.classification_rule import ClassificationRule


async def _seed_domain(
    db_session: AsyncSession,
    *,
    tenant_id,
    code: str,
    name: str,
) -> ClassificationDomain:
    domain = ClassificationDomain(
        tenant_id=tenant_id,
        code=code,
        name=name,
        is_active=True,
    )
    db_session.add(domain)
    await db_session.flush()
    return domain


async def _seed_activity(
    db_session: AsyncSession,
    *,
    tenant_id,
    domain_id,
    code: str,
    name: str,
) -> ClassificationActivity:
    activity = ClassificationActivity(
        tenant_id=tenant_id,
        domain_id=domain_id,
        code=code,
        name=name,
        is_active=True,
    )
    db_session.add(activity)
    await db_session.flush()
    return activity


async def _seed_rule(
    db_session: AsyncSession,
    *,
    tenant_id,
    category_id,
    org_unit_id,
    code: str,
) -> ClassificationRule:
    # The public API normalizes classification rule codes before persistence.
    # Keep direct test seeding aligned with that invariant so duplicate-code
    # tests exercise the endpoint logic rather than an artificial casing drift.
    normalized_code = code.strip().lower()
    rule = ClassificationRule(
        tenant_id=tenant_id,
        code=normalized_code,
        name=f"Rule {normalized_code}",
        priority=10,
        source_scope="service",
        document_category_id=category_id,
        target_scope="service",
        target_org_unit_id=org_unit_id,
        year_strategy="current",
        is_active=True,
    )
    db_session.add(rule)
    await db_session.flush()
    return rule


@pytest.mark.asyncio
async def test_create_classification_rule_rejects_activity_outside_domain(
    admin_client, db_session: AsyncSession, db_seed
):
    domain_a = await _seed_domain(
        db_session, tenant_id=db_seed["tenant_id"], code="marches", name="Marches"
    )
    domain_b = await _seed_domain(
        db_session, tenant_id=db_seed["tenant_id"], code="budget", name="Budget"
    )
    activity = await _seed_activity(
        db_session,
        tenant_id=db_seed["tenant_id"],
        domain_id=domain_b.id,
        code="engagement",
        name="Engagement",
    )
    await db_session.commit()

    response = await admin_client.post(
        "/api/v1/classification-rules/rules",
        json={
            "code": "RULE_MISMATCH",
            "name": "Rule mismatch",
            "priority": 5,
            "source_scope": "service",
            "document_category_id": str(db_seed["category_id"]),
            "target_scope": "service",
            "target_org_unit_id": str(db_seed["org_unit_id"]),
            "domain_id": str(domain_a.id),
            "activity_id": str(activity.id),
            "year_strategy": "current",
            "is_active": True,
        },
    )

    assert response.status_code == 400
    assert "n'appartient pas au domaine" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_classification_rule_rejects_target_user_for_non_person_scope(
    admin_client, db_seed
):
    response = await admin_client.post(
        "/api/v1/classification-rules/rules",
        json={
            "code": "RULE_BAD_TARGET",
            "name": "Rule bad target",
            "priority": 5,
            "source_scope": "service",
            "document_category_id": str(db_seed["category_id"]),
            "target_scope": "service",
            "target_org_unit_id": str(db_seed["org_unit_id"]),
            "target_user_id": str(db_seed["user_id"]),
            "year_strategy": "current",
            "is_active": True,
        },
    )

    assert response.status_code == 400
    assert "utilisateur cible" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_classification_rule_rejects_fixed_year_without_value(
    admin_client, db_seed
):
    response = await admin_client.post(
        "/api/v1/classification-rules/rules",
        json={
            "code": "RULE_FIXED_YEAR",
            "name": "Rule fixed year",
            "priority": 5,
            "source_scope": "service",
            "document_category_id": str(db_seed["category_id"]),
            "target_scope": "service",
            "target_org_unit_id": str(db_seed["org_unit_id"]),
            "year_strategy": "fixed",
            "is_active": True,
        },
    )

    assert response.status_code == 400
    assert "annee fixe" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_classification_domain_rejects_duplicate_code(
    admin_client, db_session: AsyncSession, db_seed
):
    domain_a = await _seed_domain(
        db_session, tenant_id=db_seed["tenant_id"], code="courrier", name="Courrier"
    )
    domain_b = await _seed_domain(
        db_session, tenant_id=db_seed["tenant_id"], code="budget", name="Budget"
    )
    await db_session.commit()

    response = await admin_client.patch(
        f"/api/v1/classification-rules/domains/{domain_b.id}",
        json={"code": domain_a.code},
    )

    assert response.status_code == 400
    assert "code de domaine" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_classification_activity_rejects_duplicate_code_within_domain(
    admin_client, db_session: AsyncSession, db_seed
):
    domain = await _seed_domain(
        db_session, tenant_id=db_seed["tenant_id"], code="marches", name="Marches"
    )
    activity_a = await _seed_activity(
        db_session,
        tenant_id=db_seed["tenant_id"],
        domain_id=domain.id,
        code="reparation",
        name="Reparation",
    )
    activity_b = await _seed_activity(
        db_session,
        tenant_id=db_seed["tenant_id"],
        domain_id=domain.id,
        code="maintenance",
        name="Maintenance",
    )
    await db_session.commit()

    response = await admin_client.patch(
        f"/api/v1/classification-rules/activities/{activity_b.id}",
        json={"code": activity_a.code},
    )

    assert response.status_code == 400
    assert "code d'activite" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_classification_rule_rejects_duplicate_code(
    admin_client, db_session: AsyncSession, db_seed
):
    rule_a = await _seed_rule(
        db_session,
        tenant_id=db_seed["tenant_id"],
        category_id=db_seed["category_id"],
        org_unit_id=db_seed["org_unit_id"],
        code="RULE_ALPHA",
    )
    rule_b = await _seed_rule(
        db_session,
        tenant_id=db_seed["tenant_id"],
        category_id=db_seed["category_id"],
        org_unit_id=db_seed["org_unit_id"],
        code="RULE_BETA",
    )
    await db_session.commit()

    response = await admin_client.patch(
        f"/api/v1/classification-rules/rules/{rule_b.id}",
        json={"code": rule_a.code},
    )

    assert response.status_code == 400
    assert "code de regle" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_simulate_classification_rejects_foreign_source_context(
    admin_client, db_seed
):
    response = await admin_client.post(
        "/api/v1/classification-rules/simulate",
        json={
            "document_category_id": str(db_seed["category_id"]),
            "source_scope": "service",
            "source_org_unit_id": str(uuid4()),
            "filename": "note_2026.pdf",
            "mime_type": "application/pdf",
        },
    )

    assert response.status_code == 400
    assert "unite source invalide" in response.json()["detail"].lower()
