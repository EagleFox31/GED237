"""Staff of each org unit for the organisation tree (V1.2, item 12): head and headcount.

Pure logic, tested by tests/services/test_org_unit_staff.py. There is no "head"
column on OrgUnit: the head is deduced from the reporting lines, without a migration.

Rule (deduced head)
- Only active users count, as members of the unit they are attached to
  (``org_unit_id``); sub-units are not added up.
- A candidate is a member whose N+1 is not an active member of the same unit
  (no N+1, or an N+1 elsewhere: typically the head of the parent unit).
- Threshold: exactly one candidate -> head. Zero (empty unit, or a reporting
  cycle inside it) or several (interim, two people reporting outside, missing
  reporting lines) -> ``None``: an ambiguous head is never guessed.
- Known limit: a unit with a single member reporting elsewhere shows that member
  as head, even when they are not one in practice.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, Optional
from uuid import UUID


@dataclass(frozen=True)
class Member:
    id: UUID
    full_name: str
    org_unit_id: UUID
    reports_to_user_id: Optional[UUID]


@dataclass(frozen=True)
class UnitStaff:
    users_count: int
    head: Optional[Member]


def staff_by_unit(members: Iterable[Member]) -> Dict[UUID, UnitStaff]:
    by_unit: Dict[UUID, list] = {}
    for member in members:
        by_unit.setdefault(member.org_unit_id, []).append(member)

    staff: Dict[UUID, UnitStaff] = {}
    for unit_id, unit_members in by_unit.items():
        ids = {m.id for m in unit_members}
        candidates = [m for m in unit_members if m.reports_to_user_id not in ids]
        staff[unit_id] = UnitStaff(
            users_count=len(unit_members),
            head=candidates[0] if len(candidates) == 1 else None,
        )
    return staff
