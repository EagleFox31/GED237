"""Rules and space paths climb the unit tree on parent_id, not on org_unit_closure (#201).

No code path writes org_unit_closure: the tree below has no closure row at all,
as in production. Tree: Direction Test (seeded, level 1) > D (2) > S (3) > V (4).
"""

import uuid

import pytest
from sqlalchemy import func, select

from app.models.classification_rule import ClassificationRule
from app.models.org_unit import OrgUnit, OrgUnitClosure
from app.services.classification_rule_engine import ClassificationRuleEngine
from app.services.space_path_builder import SpacePathBuilder


async def _tree(db_session, db_seed) -> dict:
    units, parent = {}, db_seed["org_unit_id"]
    for level, code in ((2, "D"), (3, "S"), (4, "V")):
        unit = OrgUnit(
            id=uuid.uuid4(),
            tenant_id=db_seed["tenant_id"],
            parent_id=parent,
            code=f"T201-{code}",
            name=f"Unite {code}",
            level=level,
            is_active=True,
        )
        db_session.add(unit)
        await db_session.flush()
        units[code], parent = unit.id, unit.id
    count = await db_session.scalar(select(func.count()).select_from(OrgUnitClosure))
    assert count == 0
    return units


def _rule(db_seed, units, target_scope: str) -> ClassificationRule:
    return ClassificationRule(
        tenant_id=db_seed["tenant_id"],
        code=f"t201_{target_scope}",
        name=f"Rule {target_scope}",
        priority=10,
        source_scope="service",
        # The rule targets the directorate: a document of a unit below it matches.
        source_org_unit_ids=[str(units["D"])],
        document_category_id=db_seed["category_id"],
        target_scope=target_scope,
        year_strategy="current",
        is_active=True,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "target_scope, expected", [("subdirectorate", "S"), ("directorate", "D")]
)
async def test_a_rule_on_a_parent_unit_classifies_a_document_of_a_sub_unit(
    db_session, db_seed, target_scope, expected
):
    units = await _tree(db_session, db_seed)
    db_session.add(_rule(db_seed, units, target_scope))
    await db_session.flush()

    resolution = await ClassificationRuleEngine(db_session).simulate(
        tenant_id=db_seed["tenant_id"],
        document_category_id=db_seed["category_id"],
        source_scope="service",
        source_org_unit_id=units["V"],
        source_user_id=None,
        filename="note.pdf",
        mime_type="application/pdf",
    )

    assert resolution.rule is not None, resolution.message
    assert resolution.target_org_unit is not None
    assert resolution.target_org_unit.id == units[expected]


@pytest.mark.asyncio
async def test_the_space_path_lists_every_unit_from_the_root(db_session, db_seed):
    units = await _tree(db_session, db_seed)

    chain = await SpacePathBuilder(db_session)._org_chain(
        units["V"], db_seed["tenant_id"]
    )
    foreign = await SpacePathBuilder(db_session)._org_chain(units["V"], uuid.uuid4())

    assert chain == ["Direction Test", "Unite D", "Unite S", "Unite V"]
    assert foreign == []
