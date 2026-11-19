"""Simulating a rule before turning it on (#210); real classification stays active-only."""

import pytest

from app.models.classification_rule import ClassificationRule
from app.services.classification_rule_engine import ClassificationRuleEngine

URL = "/api/v1/classification-rules/simulate"


async def _rule(db_session, db_seed, *, is_active: bool):
    rule = ClassificationRule(
        tenant_id=db_seed["tenant_id"],
        code="zzsimu",
        name="Rule zzsimu",
        priority=0,
        source_scope="service",
        document_category_id=db_seed["category_id"],
        filename_pattern="zzsimu",
        target_scope="service",
        target_org_unit_id=db_seed["org_unit_id"],
        year_strategy="current",
        is_active=is_active,
    )
    db_session.add(rule)
    await db_session.commit()
    return rule


def _payload(db_seed, **extra):
    return {
        "document_category_id": str(db_seed["category_id"]),
        "source_scope": "service",
        "source_org_unit_id": str(db_seed["org_unit_id"]),
        "filename": "zzsimu-note.txt",
        "mime_type": "text/plain",
        **extra,
    }


@pytest.mark.asyncio
async def test_inactive_rule_is_ignored_by_default(admin_client, db_session, db_seed):
    await _rule(db_session, db_seed, is_active=False)
    response = await admin_client.post(URL, json=_payload(db_seed))
    assert response.status_code == 200
    assert response.json()["rule_code"] != "zzsimu"


@pytest.mark.asyncio
async def test_inactive_rule_can_be_simulated_and_is_flagged(
    admin_client, db_session, db_seed
):
    await _rule(db_session, db_seed, is_active=False)
    response = await admin_client.post(
        URL, json=_payload(db_seed, include_inactive=True)
    )
    body = response.json()
    assert response.status_code == 200
    assert body["rule_code"] == "zzsimu"
    assert body["rule_is_active"] is False


@pytest.mark.asyncio
async def test_active_rule_is_reported_active(admin_client, db_session, db_seed):
    await _rule(db_session, db_seed, is_active=True)
    body = (await admin_client.post(URL, json=_payload(db_seed))).json()
    assert body["rule_code"] == "zzsimu"
    assert body["rule_is_active"] is True


@pytest.mark.asyncio
async def test_real_classification_never_uses_an_inactive_rule(db_session, db_seed):
    await _rule(db_session, db_seed, is_active=False)
    engine = ClassificationRuleEngine(db_session)
    rules = await engine._load_rules(db_seed["tenant_id"])
    assert all(rule.is_active for rule in rules)
    resolution = await engine.simulate(
        tenant_id=db_seed["tenant_id"],
        document_category_id=db_seed["category_id"],
        source_scope="service",
        source_org_unit_id=db_seed["org_unit_id"],
        source_user_id=None,
        filename="zzsimu-note.txt",
        mime_type="text/plain",
    )
    assert resolution.rule is None or resolution.rule.code != "zzsimu"
