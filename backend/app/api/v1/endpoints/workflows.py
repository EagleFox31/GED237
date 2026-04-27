# backend/app/api/v1/endpoints/workflows.py
from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.authz import authorize_or_403, can_perform, ctx_from_resource
from app.core.tenant_guard import assert_same_tenant, assert_org_unit_scope
from app.models.document import Document
from app.models.workflow import WorkflowStep, ActionType, OutcomeType, WorkflowAction
from app.models.user import User
from app.schemas.workflow import (
    WorkflowStepCreate,
    WorkflowStepRead,
    WorkflowStepWithDocument,
    DocumentSummary,
    WorkflowActionCreate,
    WorkflowActionRead,
    AssignStepAdminRequest,
)
from app.core.events.dispatcher import dispatcher
from app.services.workflow_service import (
    SubmitWorkflowActionUseCase,
    WorkflowActionPolicy,
)

router = APIRouter()

WORKFLOW_SOURCE_STATUSES = {"draft", "rejected"}

# Alias pour distinguer l'owner du document du current_user dans les jointures
OwnerUser = aliased(User, name="owner_user")


@router.get("/stats")
async def get_workflow_stats(
    tenant_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Compteur de workflow steps actifs (current + pending) pour un tenant.
    - super_admin : peut passer ?tenant_id= pour cibler un tenant.
    - autres roles : scope au tenant courant.
    """
    await authorize_or_403(current_user, "workflows", "read")
    is_super = await can_perform(current_user, "tenants", "manage")
    effective_tenant = tenant_id if (is_super and tenant_id) else current_user.tenant_id

    count_result = await db.execute(
        select(func.count(WorkflowStep.id))
        .join(Document, Document.id == WorkflowStep.document_id)
        .where(
            Document.tenant_id == effective_tenant,
            WorkflowStep.status.in_(["current", "pending"]),
        )
    )
    active_steps = count_result.scalar_one()

    completed_result = await db.execute(
        select(func.count(WorkflowStep.id))
        .join(Document, Document.id == WorkflowStep.document_id)
        .where(
            Document.tenant_id == effective_tenant,
            WorkflowStep.status == "completed",
        )
    )
    completed_steps = completed_result.scalar_one()

    return {
        "tenant_id": str(effective_tenant),
        "active_workflow_steps": active_steps,
        "completed_workflow_steps": completed_steps,
    }


async def _get_document_or_404(
    db: AsyncSession, tenant_id: UUID, document_id: UUID
) -> Document:
    result = await db.execute(
        select(Document).where(
            Document.id == document_id, Document.tenant_id == tenant_id
        )
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


async def _validate_assignees(
    db: AsyncSession,
    tenant_id: UUID,
    steps_in: List[WorkflowStepCreate],
) -> None:
    assignee_ids = sorted(
        {step.assigned_to for step in steps_in if step.assigned_to is not None}
    )
    if not assignee_ids:
        return

    result = await db.execute(
        select(User.id).where(
            User.tenant_id == tenant_id,
            User.id.in_(assignee_ids),
            User.is_active.is_(True),
        )
    )
    found_ids = {row[0] for row in result.all()}
    missing = [str(user_id) for user_id in assignee_ids if user_id not in found_ids]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f'Assigned users must exist in the same tenant: {", ".join(missing)}',
        )


def _validate_step_order(
    steps_in: List[WorkflowStepCreate], document_id: UUID
) -> List[WorkflowStepCreate]:
    if not steps_in:
        raise HTTPException(
            status_code=400, detail="At least one workflow step is required"
        )

    sorted_steps = sorted(steps_in, key=lambda step: step.step_order)
    expected = list(range(1, len(sorted_steps) + 1))
    actual = [step.step_order for step in sorted_steps]
    if actual != expected:
        raise HTTPException(
            status_code=400,
            detail="Workflow steps must use a contiguous step_order starting at 1",
        )

    for step in sorted_steps:
        if step.document_id != document_id:
            raise HTTPException(
                status_code=400,
                detail="Each workflow step document_id must match the route document_id",
            )
    return sorted_steps


async def _authorize_workflow_read(user: User, document: Document) -> None:
    ctx = ctx_from_resource(document)
    if await can_perform(user, "workflows", "read", ctx):
        # Managers/readers are tenant-scoped in Casbin, but must stay in their org-unit perimeter.
        assert_org_unit_scope(document.org_unit_id, user)
        return
    await authorize_or_403(user, "workflows", "read_own", ctx)


@router.post(
    "/document/{document_id}/steps",
    response_model=List[WorkflowStepRead],
    status_code=status.HTTP_201_CREATED,
)
async def create_workflow_steps(
    document_id: UUID,
    steps_in: List[WorkflowStepCreate],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Define a validation workflow for a document."""
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    # Propriétaire (update_own) ou admin (manage) peut soumettre
    is_owner = document.owner_id == current_user.id
    action = "update_own" if is_owner else "manage"
    await authorize_or_403(
        current_user, "workflows", action, ctx_from_resource(document)
    )
    if document.status not in WORKFLOW_SOURCE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail="Workflows can only be started from draft or rejected documents",
        )

    existing_steps = await db.execute(
        select(WorkflowStep).where(
            WorkflowStep.document_id == document_id,
            WorkflowStep.status.in_(["pending", "current"]),
        )
    )
    if existing_steps.scalars().first() is not None:
        raise HTTPException(
            status_code=409, detail="This document already has an active workflow"
        )

    sorted_steps = _validate_step_order(steps_in, document_id)
    await _validate_assignees(db, current_user.tenant_id, sorted_steps)

    created_steps: List[WorkflowStep] = []
    for index, step_in in enumerate(sorted_steps):
        created_step = WorkflowStep(
            document_id=document_id,
            step_order=step_in.step_order,
            label=step_in.label,
            expected_action_type=step_in.expected_action_type,
            assigned_to=step_in.assigned_to,
            status="current" if index == 0 else "pending",
        )
        db.add(created_step)
        created_steps.append(created_step)

    document.status = "in_review"
    db.add(document)
    await db.commit()

    for step in created_steps:
        await db.refresh(step)

    first_step = created_steps[0]
    await dispatcher.dispatch(
        "WORKFLOW_ASSIGNED",
        {
            "user_id": str(first_step.assigned_to) if first_step.assigned_to else None,
            "tenant_id": str(document.tenant_id),
            "document_title": document.title,
            "step_name": first_step.label,
        },
    )
    return created_steps


@router.get("/document/{document_id}/steps", response_model=List[WorkflowStepRead])
async def get_workflow_steps(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all workflow steps for a document in the current tenant."""
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    await _authorize_workflow_read(current_user, document)
    result = await db.execute(
        select(WorkflowStep)
        .where(WorkflowStep.document_id == document_id)
        .order_by(WorkflowStep.step_order)
    )
    return result.scalars().all()


@router.get("/pending", response_model=List[WorkflowStepWithDocument])
async def get_pending_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get workflow steps assigned to the current user that require action.

    Returns each step enriched with a 'document' field so the manager
    can display title, status and category without a second API call.
    """
    if not await can_perform(current_user, "workflows", "read"):
        await authorize_or_403(current_user, "workflows", "read_own")

    result = await db.execute(
        select(WorkflowStep, Document, OwnerUser)
        .join(Document, Document.id == WorkflowStep.document_id)
        .join(OwnerUser, OwnerUser.id == Document.owner_id, isouter=True)
        .where(
            WorkflowStep.assigned_to == current_user.id,
            WorkflowStep.status == "current",
            Document.tenant_id == current_user.tenant_id,
        )
    )
    rows = result.all()

    enriched: List[WorkflowStepWithDocument] = []
    for step, doc, owner in rows:
        if owner and (owner.first_name or owner.last_name):
            owner_name = f"{owner.first_name or ''} {owner.last_name or ''}".strip()
        elif owner:
            owner_name = owner.matricule
        else:
            owner_name = None

        doc_summary = DocumentSummary(
            id=doc.id,
            title=doc.title,
            status=doc.status,
            document_category_id=doc.document_category_id,
            file_type=doc.file_type,
            owner_name=owner_name,
            created_at=doc.created_at,
        )
        step_data = WorkflowStepWithDocument.model_validate(step)
        step_data.document = doc_summary
        enriched.append(step_data)

    return enriched


@router.post("/step/{step_id}/actions", response_model=WorkflowActionRead)
async def submit_workflow_action(
    step_id: UUID,
    action_req: WorkflowActionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soumettre une véritable action métier sur l'étape de workflow (Parafeur)."""
    await authorize_or_403(current_user, "workflows", "resolve_review")

    policy = WorkflowActionPolicy()
    use_case = SubmitWorkflowActionUseCase(policy=policy)

    action_trace = await use_case.execute(
        step_id=step_id, action=action_req, actor=current_user, db=db
    )

    # Enrichir la réponse avec le nom de l'acteur
    actor_name = (
        f"{current_user.first_name or ''} {current_user.last_name or ''}".strip()
        or current_user.matricule
    )
    response = WorkflowActionRead.model_validate(action_trace)
    response.actor_name = actor_name
    return response


@router.get("/document/{document_id}/actions", response_model=List[WorkflowActionRead])
async def get_document_action_history(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Récupérer l'historique complet des actions métier posées sur un document."""
    # Vérifier que le document appartient au tenant
    document = await _get_document_or_404(db, current_user.tenant_id, document_id)
    await _authorize_workflow_read(current_user, document)

    # Récupérer toutes les actions via les steps du document
    result = await db.execute(
        select(WorkflowAction, User)
        .join(WorkflowStep, WorkflowAction.workflow_step_id == WorkflowStep.id)
        .join(User, WorkflowAction.performed_by == User.id)
        .where(WorkflowStep.document_id == document_id)
        .order_by(WorkflowStep.step_order, WorkflowAction.performed_at)
    )
    rows = result.all()

    actions = []
    for action, actor in rows:
        actor_name = (
            f"{actor.first_name or ''} {actor.last_name or ''}".strip()
            or actor.matricule
        )
        action_read = WorkflowActionRead.model_validate(action)
        action_read.actor_name = actor_name
        actions.append(action_read)

    return actions


@router.get("/pending-assignments", response_model=List[WorkflowStepWithDocument])
async def get_pending_assignments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get workflow steps with status 'pending_assignment'.
    Seulement pour les administrateurs du tenant.
    """
    await authorize_or_403(current_user, "workflows", "manage")

    from app.models.routing_audit import DocumentRoutingDecision

    result = await db.execute(
        select(WorkflowStep, Document, OwnerUser, DocumentRoutingDecision)
        .join(Document, Document.id == WorkflowStep.document_id)
        .join(OwnerUser, OwnerUser.id == Document.owner_id, isouter=True)
        .join(
            DocumentRoutingDecision,
            DocumentRoutingDecision.document_id == Document.id,
            isouter=True,
        )
        .where(
            WorkflowStep.status == "pending_assignment",
            Document.tenant_id == current_user.tenant_id,
        )
    )
    rows = result.all()

    enriched: List[WorkflowStepWithDocument] = []
    for step, doc, owner, decision in rows:
        if owner and (owner.first_name or owner.last_name):
            owner_name = f"{owner.first_name or ''} {owner.last_name or ''}".strip()
        elif owner:
            owner_name = owner.matricule
        else:
            owner_name = None

        doc_summary = DocumentSummary(
            id=doc.id,
            title=doc.title,
            status=doc.status,
            document_category_id=doc.document_category_id,
            file_type=doc.file_type,
            owner_name=owner_name,
            created_at=doc.created_at,
        )

        assignment_error = None
        if decision and getattr(decision, "resolved_steps_summary", None):
            for s_summary in decision.resolved_steps_summary:
                if s_summary.get("label") == step.label and s_summary.get("error"):
                    assignment_error = s_summary.get("error")
                    break
            if not assignment_error and decision.explanation:
                assignment_error = decision.explanation

        step_data = WorkflowStepWithDocument.model_validate(step)
        step_data.document = doc_summary
        step_data.assignment_error = assignment_error
        enriched.append(step_data)

    return enriched


@router.post("/steps/{step_id}/assign", response_model=WorkflowStepRead)
async def assign_step_admin(
    step_id: UUID,
    request: AssignStepAdminRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Permet à un admin de résoudre un step bloqué en 'pending_assignment'
    et de le passer en 'current'.
    """
    await authorize_or_403(current_user, "workflows", "assign")

    result = await db.execute(select(WorkflowStep).where(WorkflowStep.id == step_id))
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Etape introuvable.")

    if step.status != "pending_assignment":
        raise HTTPException(
            status_code=400, detail="Cette étape n'est pas en attente d'assignation."
        )

    document_result = await db.execute(
        select(Document).where(Document.id == step.document_id)
    )
    document = document_result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    assert_same_tenant(document.tenant_id, current_user)

    # Validate assignee exists
    user_result = await db.execute(
        select(User).where(
            User.id == request.assigned_to,
            User.tenant_id == current_user.tenant_id,
            User.is_active == True,
        )
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=400,
            detail="L'utilisateur ciblé est introuvable, inactif ou hors tenant.",
        )

    # Appliquer l'assignation
    step.assigned_to = request.assigned_to

    # Vérifier l'état des étapes précédentes pour déterminer si elle devient 'current' ou 'pending'
    prev_steps_result = await db.execute(
        select(WorkflowStep).where(
            WorkflowStep.document_id == step.document_id,
            WorkflowStep.step_order < step.step_order,
        )
    )
    prev_steps = prev_steps_result.scalars().all()
    all_prev_completed = all(s.status == "completed" for s in prev_steps)

    if all_prev_completed:
        step.status = "current"
    else:
        step.status = "pending"

    await db.commit()
    await db.refresh(step)

    # Dispatch event pour notification
    await dispatcher.dispatch(
        "WORKFLOW_ASSIGNED",
        {
            "user_id": str(step.assigned_to),
            "tenant_id": str(document.tenant_id),
            "document_title": document.title,
            "step_name": step.label,
        },
    )

    return step
