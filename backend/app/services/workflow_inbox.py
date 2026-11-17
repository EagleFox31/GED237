"""Validation queues: one query builder for every screen that lists steps to handle.

Three scopes share the same rows, order and serialization:

- ``mine``: steps assigned to the user and waiting for their action;
- ``unit``: steps waiting for action on documents of an organisational unit;
- ``unassigned``: steps nobody could be assigned to (routing failure).

``GET /workflows/pending`` and ``GET /workflows/pending-assignments`` are the
``mine`` and ``unassigned`` scopes without pagination.
"""

from typing import Any, Literal, Optional, Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.document import Document
from app.models.org_unit import OrgUnit
from app.models.routing_audit import DocumentRoutingDecision
from app.models.user import User
from app.models.workflow import WorkflowStep
from app.schemas.workflow import DocumentSummary, WorkflowStepWithDocument

InboxScope = Literal["mine", "unit", "unassigned"]

INBOX_PAGE_DEFAULT = 50
INBOX_PAGE_MAX = 200

STEP_CURRENT = "current"
STEP_PENDING_ASSIGNMENT = "pending_assignment"

OwnerUser = aliased(User, name="inbox_owner_user")


def owner_display_name(owner: Optional[User]) -> Optional[str]:
    if owner is None:
        return None
    if owner.first_name or owner.last_name:
        return f"{owner.first_name or ''} {owner.last_name or ''}".strip()
    return owner.matricule


def assignment_error_for(
    step: WorkflowStep, decisions: Sequence[DocumentRoutingDecision]
) -> Optional[str]:
    """Why routing could not assign this step: the step's own error, else the explanation."""
    for decision in decisions:
        for summary in decision.resolved_steps_summary or []:
            if summary.get("label") == step.label and summary.get("error"):
                return summary["error"]
    for decision in decisions:
        if decision.resolved_steps_summary and decision.explanation:
            return decision.explanation
    return None


def serialize_step(
    step: WorkflowStep,
    document: Document,
    owner: Optional[User],
    *,
    assignment_error: Optional[str] = None,
) -> WorkflowStepWithDocument:
    data = WorkflowStepWithDocument.model_validate(step)
    data.document = DocumentSummary(
        id=document.id,
        title=document.title,
        status=document.status,
        document_category_id=document.document_category_id,
        file_type=document.file_type,
        owner_name=owner_display_name(owner),
        current_version_id=document.current_version_id,
        created_at=document.created_at,
    )
    data.assignment_error = assignment_error
    return data


async def descendant_org_unit_ids(
    db: AsyncSession, *, tenant_id: UUID, root_org_unit_id: UUID
) -> list[UUID]:
    """The unit and every unit below it, following ``parent_id`` inside the tenant."""
    result = await db.execute(
        select(OrgUnit.id, OrgUnit.parent_id).where(OrgUnit.tenant_id == tenant_id)
    )
    children: dict[Optional[UUID], list[UUID]] = {}
    for org_unit_id, parent_id in result.all():
        children.setdefault(parent_id, []).append(org_unit_id)

    collected: list[UUID] = []
    seen: set[UUID] = set()
    stack = [root_org_unit_id]
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.add(current)
        collected.append(current)
        stack.extend(children.get(current, []))
    return collected


def _base_query(tenant_id: UUID, *, exclude_trashed: bool):
    query = (
        select(WorkflowStep, Document, OwnerUser)
        .join(Document, Document.id == WorkflowStep.document_id)
        .join(OwnerUser, OwnerUser.id == Document.owner_id, isouter=True)
        .where(Document.tenant_id == tenant_id)
    )
    if exclude_trashed:
        query = query.where(Document.deleted_at.is_(None))
    return query


def scope_query(
    scope: InboxScope,
    *,
    tenant_id: UUID,
    user_id: UUID,
    org_unit_ids: Optional[Sequence[UUID]] = None,
    exclude_trashed: bool = True,
):
    """Rows of one scope, without order nor page."""
    query = _base_query(tenant_id, exclude_trashed=exclude_trashed)
    if scope == "mine":
        return query.where(
            WorkflowStep.assigned_to == user_id, WorkflowStep.status == STEP_CURRENT
        )
    if scope == "unit":
        return query.where(
            WorkflowStep.status == STEP_CURRENT,
            Document.org_unit_id.in_(list(org_unit_ids or [])),
        )
    return query.where(WorkflowStep.status == STEP_PENDING_ASSIGNMENT)


async def _routing_decisions(
    db: AsyncSession, document_ids: Sequence[UUID]
) -> dict[UUID, list[DocumentRoutingDecision]]:
    if not document_ids:
        return {}
    result = await db.execute(
        select(DocumentRoutingDecision)
        .where(DocumentRoutingDecision.document_id.in_(document_ids))
        .order_by(DocumentRoutingDecision.created_at.desc(), DocumentRoutingDecision.id)
    )
    by_document: dict[UUID, list[DocumentRoutingDecision]] = {}
    for decision in result.scalars().all():
        by_document.setdefault(decision.document_id, []).append(decision)
    return by_document


async def list_steps(
    db: AsyncSession,
    scope: InboxScope,
    *,
    tenant_id: UUID,
    user_id: UUID,
    org_unit_ids: Optional[Sequence[UUID]] = None,
    exclude_trashed: bool = True,
    limit: Optional[int] = None,
    offset: int = 0,
) -> tuple[list[WorkflowStepWithDocument], int]:
    """One page of a scope (oldest step first, stable) and the total before paging.

    ``limit`` None returns every row: the two historical routes are not paginated.
    """
    query = scope_query(
        scope,
        tenant_id=tenant_id,
        user_id=user_id,
        org_unit_ids=org_unit_ids,
        exclude_trashed=exclude_trashed,
    )
    total: Any = await db.scalar(
        select(func.count()).select_from(
            query.with_only_columns(WorkflowStep.id).order_by(None).subquery()
        )
    )

    page = query.order_by(WorkflowStep.created_at.asc(), WorkflowStep.id.asc())
    if limit is not None:
        page = page.offset(offset).limit(limit)
    rows = (await db.execute(page)).all()

    decisions: dict[UUID, list[DocumentRoutingDecision]] = {}
    if scope == "unassigned":
        decisions = await _routing_decisions(db, [doc.id for _, doc, _ in rows])

    steps = [
        serialize_step(
            step,
            document,
            owner,
            assignment_error=assignment_error_for(step, decisions.get(document.id, []))
            if scope == "unassigned"
            else None,
        )
        for step, document, owner in rows
    ]
    return steps, int(total or 0)
