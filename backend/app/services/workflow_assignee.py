"""Who may act on a workflow step: the assignee, or their stand-in (DEC-2026-007).

The single place deciding "my tasks". The task list, the task counters, document
reading through a step and the action policy all go through these clauses, so a
stand-in sees, reads and acts on exactly the same steps.

A delegation counts while ``starts_at <= now() < ends_at`` and it is not revoked,
read in each query: the automatic end and a revocation take effect at once. The
clause is never recursive, so a delegation does not chain (no redelegation).
Acting also re-checks that the stand-in's role still allows resolving reviews.
"""

from typing import Optional
from uuid import UUID

from sqlalchemy import ColumnElement, Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import can_perform
from app.models.delegation import Delegation
from app.models.user import User
from app.models.workflow import WorkflowStep


def active_delegation_filter():
    """Delegations in force right now (not revoked, inside their period)."""
    now = func.now()
    return and_(
        Delegation.revoked_at.is_(None),
        Delegation.starts_at <= now,
        Delegation.ends_at > now,
    )


def active_delegators(user: User) -> Select:
    """Ids of the agents ``user`` stands in for right now, in ``user``'s tenant."""
    return select(Delegation.delegator_id).where(
        Delegation.tenant_id == user.tenant_id,
        Delegation.delegate_id == user.id,
        active_delegation_filter(),
    )


def _pending_assignee_clause(user: User) -> ColumnElement[bool]:
    """Steps assigned to ``user`` or to an agent ``user`` stands in for (no role check:
    use ``pending_assignee_clause``, which also drops the stand-in part when the role
    no longer allows resolving reviews)."""
    return or_(
        WorkflowStep.assigned_to == user.id,
        WorkflowStep.assigned_to.in_(active_delegators(user)),
    )


async def may_stand_in(user: User) -> bool:
    """The stand-in's role was checked at designation; it may have changed since."""
    return bool(user.is_active) and await can_perform(
        user, "workflows", "resolve_review"
    )


async def pending_assignee_clause(user: User) -> ColumnElement[bool]:
    """Steps ``user`` may see in "my tasks": their own, plus the absent agent's while
    ``user``'s role still allows resolving reviews (same rule as acting)."""
    if await may_stand_in(user):
        return _pending_assignee_clause(user)
    return WorkflowStep.assigned_to == user.id


async def actionable_step_clause(user: User) -> ColumnElement[bool]:
    """Steps ``user`` can act on now: their own or a stand-in's, and current."""
    return and_(await pending_assignee_clause(user), WorkflowStep.status == "current")


async def resolve_step_actor(
    db: AsyncSession, user: User, step: WorkflowStep
) -> tuple[bool, Optional[UUID]]:
    """``(can_act, on_behalf_of)`` for ``user`` on ``step``.

    ``on_behalf_of`` is the absent assignee when ``user`` acts as a stand-in,
    ``None`` when ``user`` is the assignee.
    """
    if step.assigned_to == user.id:
        return True, None
    if step.assigned_to is None:
        return False, None
    row = await db.execute(
        select(WorkflowStep.id).where(
            WorkflowStep.id == step.id, _pending_assignee_clause(user)
        )
    )
    if row.first() is None or not await may_stand_in(user):
        return False, None
    return True, step.assigned_to


async def active_delegate_ids(
    db: AsyncSession, tenant_id: UUID, delegator_id: UUID
) -> list[UUID]:
    """Stand-ins currently covering ``delegator_id`` (for notifications)."""
    rows = await db.execute(
        select(Delegation.delegate_id).where(
            Delegation.tenant_id == tenant_id,
            Delegation.delegator_id == delegator_id,
            active_delegation_filter(),
        )
    )
    return list(rows.scalars().all())
