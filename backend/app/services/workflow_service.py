# backend/app/services/workflow_service.py
from typing import Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.models.workflow import WorkflowStep, WorkflowAction, ActionType, OutcomeType
from app.models.document import Document
from app.models.user import User
from app.schemas.workflow import WorkflowActionCreate
from app.core.events.dispatcher import dispatcher
from app.core.authz import can_perform, ctx_from_resource


class WorkflowActionPolicy:
    """
    Politique métier vérifiant si l'action soumise est permise sur l'étape cible.
    """

    async def check_can_perform_action(
        self,
        step: WorkflowStep,
        document: Document,
        action: WorkflowActionCreate,
        actor: User,
    ):
        # 1. Vérification de l'état du step
        if step.status != "current":
            raise HTTPException(
                status_code=400, detail="This step is not currently pending validation"
            )

        # 2. Vérification des droits (Assigné ou utilisateur avec capacité manage via Casbin)
        if step.assigned_to != actor.id and not await can_perform(
            actor, "workflows", "manage", ctx_from_resource(document)
        ):
            raise HTTPException(
                status_code=403, detail="You are not assigned to this step"
            )

        # 3. Vérification de la Version (Doit agir sur la dernière version connue du document)
        if action.document_version_id != document.current_version_id:
            raise HTTPException(
                status_code=400,
                detail="Action must be performed on the current document version",
            )

        # 4. Vérification du Type d'Action
        if action.action_type != step.expected_action_type:
            raise HTTPException(
                status_code=400,
                detail=f"Expected action type: {step.expected_action_type}",
            )


class SubmitWorkflowActionUseCase:
    """
    Application Service orchestrant la soumission d'une action dans le parafeur.
    Comprend le Pessimistic Locking, la politique de sécurité, la trace de l'acte et l'avancement du cycle de vie.
    """

    def __init__(self, policy: WorkflowActionPolicy, event_dispatcher=dispatcher):
        self.policy = policy
        self.dispatcher = event_dispatcher

    async def execute(
        self,
        *,
        step_id: UUID,
        action: WorkflowActionCreate,
        actor: User,
        db: AsyncSession,
    ) -> WorkflowAction:
        # Pessimistic Locking : Empêche la race condition sur la validation
        result = await db.execute(
            select(WorkflowStep).where(WorkflowStep.id == step_id).with_for_update()
        )
        step = result.scalar_one_or_none()

        if step is None:
            raise HTTPException(status_code=404, detail="Workflow step not found")

        # Récupération du Document root aggregate
        doc_result = await db.execute(
            select(Document).where(Document.id == step.document_id)
        )
        document = doc_result.scalar_one_or_none()
        if document is None or document.tenant_id != actor.tenant_id:
            raise HTTPException(status_code=404, detail="Document not found")

        # Execution de la Policy
        await self.policy.check_can_perform_action(step, document, action, actor)

        # Tracabilité explicite de l'acte (avec l'action.document_version_id explicite de la requête)
        action_trace = WorkflowAction(
            workflow_step_id=step.id,
            action_type=action.action_type,
            outcome=action.outcome,
            document_version_id=action.document_version_id,
            performed_by=actor.id,
            comment=action.comment,
        )
        db.add(action_trace)

        # Clôture du step en cours
        step.completed_at = datetime.utcnow()
        if action.comment:
            step.comment = action.comment

        # Traitement de l'Outcome et de la suite du Workflow
        next_step = None

        if action.outcome in [OutcomeType.accepted, OutcomeType.acknowledged]:
            step.status = "completed"
            # Trouver l'étape suivante
            next_result = await db.execute(
                select(WorkflowStep)
                .where(
                    WorkflowStep.document_id == step.document_id,
                    WorkflowStep.step_order > step.step_order,
                    WorkflowStep.status.in_(["pending", "pending_assignment"]),
                )
                .order_by(WorkflowStep.step_order)
                .limit(1)
            )
            next_step = next_result.scalar_one_or_none()
            if next_step is not None:
                next_step.status = "current"
                db.add(next_step)
            else:
                document.status = "validated"

        elif action.outcome == OutcomeType.returned:
            # Option A: Document revient en returned (brouillon corrigible), les étapes suivantes s'annulent
            step.status = "returned"
            document.status = "returned"
            await self._cancel_pending_steps(db, step.document_id)

        elif action.outcome == OutcomeType.rejected:
            # Rejet sec et arrêt brutal du worfklow
            step.status = "rejected"
            document.status = "rejected"
            await self._cancel_pending_steps(db, step.document_id, status="rejected")

        db.add(step)
        db.add(document)
        await db.commit()
        await db.refresh(action_trace)

        # Dispatch d'événements de domaine
        if (
            action.outcome in [OutcomeType.accepted, OutcomeType.acknowledged]
            and next_step is not None
        ):
            await self.dispatcher.dispatch(
                "WORKFLOW_ASSIGNED",
                {
                    "user_id": str(next_step.assigned_to)
                    if next_step.assigned_to
                    else None,
                    "tenant_id": str(document.tenant_id),
                    "document_title": document.title,
                    "step_name": next_step.label,
                },
            )
        else:
            await self.dispatcher.dispatch(
                "WORKFLOW_COMPLETED_OR_RETURNED",
                {
                    "tenant_id": str(document.tenant_id),
                    "document_id": str(document.id),
                    "status": document.status,
                },
            )

        return action_trace

    async def _cancel_pending_steps(
        self, db: AsyncSession, document_id: UUID, status: str = "cancelled"
    ):
        """Annule ou rejette les prochaines étapes si le processus s'interrompt."""
        pending_result = await db.execute(
            select(WorkflowStep).where(
                WorkflowStep.document_id == document_id,
                WorkflowStep.status == "pending",
            )
        )
        for pending_step in pending_result.scalars().all():
            pending_step.status = status
            db.add(pending_step)
