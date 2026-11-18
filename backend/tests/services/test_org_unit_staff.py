"""Deduced head and headcount per org unit (V1.2, item 12)."""

from uuid import uuid4

from app.services.org_unit_staff import Member, staff_by_unit

UNIT = uuid4()
PARENT_HEAD = uuid4()  # head of the parent unit, member elsewhere


def member(name, reports_to=None, unit=UNIT):
    return Member(
        id=uuid4(), full_name=name, org_unit_id=unit, reports_to_user_id=reports_to
    )


def test_one_candidate_is_the_head():
    head = member("Chef", PARENT_HEAD)
    staff = staff_by_unit(
        [head, member("Agent A", head.id), member("Agent B", head.id)]
    )
    assert staff[UNIT].head == head
    assert staff[UNIT].users_count == 3


def test_several_candidates_give_no_head():
    """Two people reporting outside the unit (interim, missing line): never guessed."""
    staff = staff_by_unit([member("A", PARENT_HEAD), member("B", None)])
    assert staff[UNIT].head is None
    assert staff[UNIT].users_count == 2


def test_zero_candidate_gives_no_head():
    """Everyone reports inside the unit (a cycle): no one stands out."""
    a = member("A")
    b = member("B", a.id)
    a = Member(id=a.id, full_name="A", org_unit_id=UNIT, reports_to_user_id=b.id)
    staff = staff_by_unit([a, b])
    assert staff[UNIT].head is None
    assert staff[UNIT].users_count == 2


def test_units_are_counted_separately_and_an_empty_unit_is_absent():
    other = uuid4()
    head = member("Chef", PARENT_HEAD)
    staff = staff_by_unit([head, member("Ailleurs", head.id, unit=other)])
    assert staff[UNIT].users_count == 1
    # Reports to someone outside its own unit: candidate of `other`.
    assert staff[other].head.full_name == "Ailleurs"
    assert uuid4() not in staff
