import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import Document
from app.models.gedrules import (
    AssignmentScope,
    RoutingRule,
    WorkflowTemplate,
    WorkflowTemplateStep,
)
from app.models.org_unit import OrgUnit
from app.models.role import Role
from app.models.routing_audit import DocumentRoutingDecision
from app.models.user import User
from app.models.workflow import ActionType, WorkflowStep

logger = logging.getLogger(__name__)


class AssignmentPolicy:
    """
    Politique de resolution des acteurs (mapping role -> utilisateur).
    """

    @staticmethod
    async def resolve_actor(
        db: AsyncSession,
        tenant_id: UUID,
        role_id: int,
        org_unit_id: UUID,
        scope: AssignmentScope,
        target_unit_type_id: Optional[int] = None,
    ) -> Optional[User]:
        async def find_user_in_unit(unit_id: UUID) -> Optional[User]:
            stmt = select(User).where(
                User.tenant_id == tenant_id,
                User.role_id == role_id,
                User.org_unit_id == unit_id,
                User.is_active,
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

        async def get_unit(unit_id: UUID) -> Optional[OrgUnit]:
            result = await db.execute(select(OrgUnit).where(OrgUnit.id == unit_id))
            return result.scalar_one_or_none()

        if target_unit_type_id is not None:
            current_id = org_unit_id
            for _ in range(16):
                unit = await get_unit(current_id) if current_id else None
                if not unit:
                    return None
                if unit.type_id == target_unit_type_id:
                    return await find_user_in_unit(unit.id)
                if not unit.parent_id:
                    return None
                current_id = unit.parent_id
            return None

        if scope == AssignmentScope.same_org_unit:
            return await find_user_in_unit(org_unit_id)

        if scope == AssignmentScope.parent_org_unit:
            unit = await get_unit(org_unit_id)
            if unit and unit.parent_id:
                return await find_user_in_unit(unit.parent_id)
            return None

        if scope == AssignmentScope.grandparent_org_unit:
            unit = await get_unit(org_unit_id)
            if unit and unit.parent_id:
                parent = await get_unit(unit.parent_id)
                if parent and parent.parent_id:
                    return await find_user_in_unit(parent.parent_id)
            return None

        return None


class RoutingPlanBuilder:
    """Build one owner-aware routing plan shared by the simulator and runtime."""

    def __init__(self, db: AsyncSession, policy: AssignmentPolicy):
        self.db = db
        self.policy = policy
        self._role_cache: Dict[int, Optional[Role]] = {}
        self._org_unit_cache: Dict[UUID, Optional[OrgUnit]] = {}

    async def _get_role(self, role_id: int) -> Optional[Role]:
        if role_id not in self._role_cache:
            result = await self.db.execute(select(Role).where(Role.id == role_id))
            self._role_cache[role_id] = result.scalar_one_or_none()
        return self._role_cache[role_id]

    async def _get_org_unit_name(self, org_unit_id: Optional[UUID]) -> Optional[str]:
        if not org_unit_id:
            return None
        if org_unit_id not in self._org_unit_cache:
            result = await self.db.execute(
                select(OrgUnit).where(OrgUnit.id == org_unit_id)
            )
            self._org_unit_cache[org_unit_id] = result.scalar_one_or_none()
        unit = self._org_unit_cache[org_unit_id]
        return unit.name if unit else None

    async def _load_owner(
        self, tenant_id: UUID, owner_id: Optional[UUID]
    ) -> Optional[User]:
        if not owner_id:
            return None
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.role))
            .where(
                User.id == owner_id,
                User.tenant_id == tenant_id,
                User.is_active,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _owner_role_code(owner: Optional[User]) -> Optional[str]:
        if owner is None or getattr(owner, "role", None) is None:
            return None
        code = getattr(owner.role, "code", None)
        return code.lower() if isinstance(code, str) else None

    def _can_auto_complete_authoring_step(
        self,
        *,
        step: WorkflowTemplateStep,
        step_role_code: Optional[str],
        owner: Optional[User],
        source_org_unit_id: Optional[UUID],
    ) -> bool:
        return bool(
            owner
            and owner.org_unit_id == source_org_unit_id
            and step.step_order == 1
            and step.expected_action_type == ActionType.visa
            and step_role_code == "collaborator"
            and self._owner_role_code(owner) == "manager"
        )

    async def build(
        self,
        *,
        tenant_id: UUID,
        source_org_unit_id: Optional[UUID],
        template_steps: List[WorkflowTemplateStep],
        owner_id: Optional[UUID] = None,
    ) -> Tuple[List[Dict[str, Any]], Optional[User]]:
        owner = await self._load_owner(tenant_id, owner_id)
        plan_steps: List[Dict[str, Any]] = []

        for t_step in template_steps:
            assigned_user = await self.policy.resolve_actor(
                self.db,
                tenant_id,
                t_step.role_id,
                source_org_unit_id,
                t_step.assignment_scope,
                target_unit_type_id=t_step.target_unit_type_id,
            )

            role = await self._get_role(t_step.role_id)
            role_label = role.label if role else f"Role ({t_step.role_id})"
            role_code = role.code.lower() if role and role.code else None

            resolved_user_id = assigned_user.id if assigned_user else None
            resolved_user_name = assigned_user.full_name if assigned_user else None
            resolved_org_unit_name = await self._get_org_unit_name(
                assigned_user.org_unit_id if assigned_user else None
            )

            resolution_status = "resolved"
            resolution_note = None
            persistent_status = "pending"
            assigned_to = resolved_user_id
            assignment_error = None

            if self._can_auto_complete_authoring_step(
                step=t_step,
                step_role_code=role_code,
                owner=owner,
                source_org_unit_id=source_org_unit_id,
            ):
                resolution_status = "auto_completed_by_owner"
                resolution_note = "Le document est considere comme deja redige par l'initiateur selectionne."
                persistent_status = "completed"
                assigned_to = owner.id
                resolved_user_id = owner.id
                resolved_user_name = owner.full_name
                resolved_org_unit_name = await self._get_org_unit_name(
                    owner.org_unit_id
                )
            elif owner and assigned_user and assigned_user.id == owner.id:
                resolution_status = "self_approval_prevented"
                resolution_note = "L'initiateur ne peut pas valider son propre document. Le moteur cherchera l'etape suivante."
                persistent_status = "completed"
            elif not assigned_user:
                resolution_status = "pending_assignment"
                persistent_status = "pending_assignment"
                assignment_error = (
                    f"Aucun utilisateur trouve pour le role {t_step.role_id} "
                    f"dans le scope {t_step.assignment_scope}"
                )
                resolution_note = (
                    "Aucun agent n'a ete trouve automatiquement pour cette etape."
                )

            plan_steps.append(
                {
                    "template_step_id": str(t_step.id),
                    "step_order": t_step.step_order,
                    "label": t_step.label,
                    "expected_action_type": t_step.expected_action_type,
                    "assignment_scope": t_step.assignment_scope,
                    "role_id": t_step.role_id,
                    "role_label": role_label,
                    "assigned_to": assigned_to,
                    "resolved_user_id": resolved_user_id,
                    "resolved_user_name": resolved_user_name,
                    "resolved_org_unit_name": resolved_org_unit_name,
                    "persistent_status": persistent_status,
                    "resolution_status": resolution_status,
                    "resolution_note": resolution_note,
                    "assignment_error": assignment_error,
                }
            )

        first_actionable = next(
            (
                step
                for step in plan_steps
                if step["persistent_status"] in {"pending", "pending_assignment"}
            ),
            None,
        )

        if first_actionable and first_actionable["persistent_status"] == "pending":
            first_actionable["persistent_status"] = "current"
            if first_actionable["resolution_status"] == "resolved":
                first_actionable["resolution_status"] = "current"
        elif not first_actionable:
            blocked_self_approval = next(
                (
                    step
                    for step in plan_steps
                    if step["resolution_status"] == "self_approval_prevented"
                ),
                None,
            )
            if blocked_self_approval:
                blocked_self_approval["persistent_status"] = "pending_assignment"
                blocked_self_approval["resolution_status"] = (
                    "manual_assignment_required"
                )
                blocked_self_approval["assignment_error"] = (
                    "Auto-validation interdite sans valideur distinct disponible."
                )
                blocked_self_approval["resolution_note"] = (
                    "Aucun valideur distinct n'a ete trouve apres prevention de l'auto-validation. "
                    "Une affectation manuelle est requise."
                )
                blocked_self_approval["assigned_to"] = None
                blocked_self_approval["resolved_user_id"] = None
                blocked_self_approval["resolved_user_name"] = None
                blocked_self_approval["resolved_org_unit_name"] = None

        return plan_steps, owner


class ApplyRoutingRulesToDocumentUseCase:
    """Use case orchestrating routing rule application to a document."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.policy = AssignmentPolicy()
        self.plan_builder = RoutingPlanBuilder(db, self.policy)

    async def execute(self, document: Document) -> Tuple[bool, str]:
        stmt = (
            select(RoutingRule)
            .options(
                selectinload(RoutingRule.document_categories),
                selectinload(RoutingRule.org_units),
            )
            .where(
                RoutingRule.tenant_id == document.tenant_id,
                RoutingRule.is_active,
            )
            .order_by(RoutingRule.priority.asc())
        )

        result = await self.db.execute(stmt)
        rules = result.scalars().all()

        matching_rule = None
        for rule in rules:
            cat_ids = [str(c.id) for c in rule.document_categories]
            if str(document.document_category_id) not in cat_ids:
                continue
            if not rule.org_units:
                matching_rule = rule
                break
            ou_ids = [str(o.id) for o in rule.org_units]
            if str(document.org_unit_id) in ou_ids:
                matching_rule = rule
                break

        if not matching_rule:
            return False, "Aucune regle de routage trouvee pour ce document."

        stmt = select(WorkflowTemplate).where(
            WorkflowTemplate.id == matching_rule.workflow_template_id
        )
        result = await self.db.execute(stmt)
        template = result.scalar_one_or_none()

        if not template or not template.is_active:
            return (
                False,
                f"La regle '{matching_rule.name}' cible un template manquant ou inactif.",
            )

        stmt = (
            select(WorkflowTemplateStep)
            .where(WorkflowTemplateStep.template_id == template.id)
            .order_by(WorkflowTemplateStep.step_order.asc())
        )
        result = await self.db.execute(stmt)
        template_steps = result.scalars().all()

        plan_steps, owner = await self.plan_builder.build(
            tenant_id=document.tenant_id,
            source_org_unit_id=document.org_unit_id,
            template_steps=template_steps,
            owner_id=document.owner_id,
        )

        steps_to_create: List[WorkflowStep] = []
        resolved_summaries: List[Dict[str, Any]] = []
        has_partial_failure = False

        for plan_step in plan_steps:
            if plan_step["persistent_status"] == "pending_assignment":
                has_partial_failure = True

            steps_to_create.append(
                WorkflowStep(
                    document_id=document.id,
                    step_order=plan_step["step_order"],
                    label=plan_step["label"],
                    status=plan_step["persistent_status"],
                    expected_action_type=plan_step["expected_action_type"],
                    assigned_to=plan_step["assigned_to"],
                    comment=plan_step["resolution_note"],
                )
            )

            resolved_summaries.append(
                {
                    "template_step_id": plan_step["template_step_id"],
                    "label": plan_step["label"],
                    "role_id": plan_step["role_id"],
                    "assigned_to": str(plan_step["assigned_to"])
                    if plan_step["assigned_to"]
                    else None,
                    "error": plan_step["assignment_error"],
                    "resolution_status": plan_step["resolution_status"],
                    "note": plan_step["resolution_note"],
                    "owner_id": str(owner.id) if owner else None,
                }
            )

        for step in steps_to_create:
            self.db.add(step)

        decision_status = "success" if not has_partial_failure else "partial_failure"
        explanation = f"Regle '{matching_rule.name}' appliquee avec succes."
        if has_partial_failure:
            explanation = (
                f"Regle '{matching_rule.name}' appliquee mais certaines etapes "
                "requierent une affectation manuelle."
            )
        elif any(
            step["resolution_status"]
            in {"auto_completed_by_owner", "self_approval_prevented"}
            for step in plan_steps
        ):
            explanation = (
                f"Regle '{matching_rule.name}' appliquee avec prise en compte de l'initiateur "
                "et prevention de l'auto-validation."
            )

        decision = DocumentRoutingDecision(
            document_id=document.id,
            routing_rule_id=matching_rule.id,
            workflow_template_id=template.id,
            status=decision_status,
            matched_conditions_summary={
                "document_category_id": str(document.document_category_id)
                if document.document_category_id
                else None,
                "org_unit_id": str(document.org_unit_id)
                if document.org_unit_id
                else None,
                "owner_id": str(document.owner_id) if document.owner_id else None,
            },
            resolved_steps_summary=resolved_summaries,
            explanation=explanation,
        )
        self.db.add(decision)

        has_open_step = any(
            step["persistent_status"] in {"current", "pending", "pending_assignment"}
            for step in plan_steps
        )
        document.status = "in_review" if has_open_step else "validated"

        return True, explanation


class SimulateRoutingUseCase:
    """Simulate routing for a category, source unit and optional owner."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.policy = AssignmentPolicy()
        self.plan_builder = RoutingPlanBuilder(db, self.policy)

    async def execute(
        self,
        tenant_id: UUID,
        document_category_id: UUID,
        org_unit_id: Optional[UUID],
        owner_id: Optional[UUID] = None,
    ) -> dict:
        owner = await self.plan_builder._load_owner(tenant_id, owner_id)

        stmt = (
            select(RoutingRule)
            .options(
                selectinload(RoutingRule.document_categories),
                selectinload(RoutingRule.org_units),
            )
            .where(RoutingRule.tenant_id == tenant_id, RoutingRule.is_active)
            .order_by(RoutingRule.priority.asc())
        )

        result = await self.db.execute(stmt)
        rules = result.scalars().all()

        matching_rule = None
        for rule in rules:
            cat_ids = [str(c.id) for c in rule.document_categories]
            if str(document_category_id) not in cat_ids:
                continue
            if not rule.org_units:
                matching_rule = rule
                break
            ou_ids = [str(o.id) for o in rule.org_units]
            if str(org_unit_id) in ou_ids:
                matching_rule = rule
                break

        if not matching_rule:
            return {
                "matched_rule_id": None,
                "matched_rule_name": None,
                "template_id": None,
                "template_name": None,
                "selected_owner_id": owner.id if owner else owner_id,
                "selected_owner_name": owner.full_name if owner else None,
                "selected_owner_role": getattr(owner.role, "label", None)
                if owner
                else None,
                "resolved_steps": [],
                "explanation": "Aucune regle ne correspond a cette combinaison (categorie / unite).",
            }

        stmt = select(WorkflowTemplate).where(
            WorkflowTemplate.id == matching_rule.workflow_template_id
        )
        result = await self.db.execute(stmt)
        template = result.scalar_one_or_none()

        if not template or not template.is_active:
            return {
                "matched_rule_id": matching_rule.id,
                "matched_rule_name": matching_rule.name,
                "template_id": matching_rule.workflow_template_id,
                "template_name": "Introuvable ou inactif",
                "selected_owner_id": owner.id if owner else owner_id,
                "selected_owner_name": owner.full_name if owner else None,
                "selected_owner_role": getattr(owner.role, "label", None)
                if owner
                else None,
                "resolved_steps": [],
                "explanation": "La regle cible un template inactif ou supprime.",
            }

        stmt = (
            select(WorkflowTemplateStep)
            .where(WorkflowTemplateStep.template_id == template.id)
            .order_by(WorkflowTemplateStep.step_order.asc())
        )
        result = await self.db.execute(stmt)
        template_steps = result.scalars().all()

        plan_steps, owner = await self.plan_builder.build(
            tenant_id=tenant_id,
            source_org_unit_id=org_unit_id,
            template_steps=template_steps,
            owner_id=owner_id,
        )

        resolved_steps = [
            {
                "step_order": step["step_order"],
                "label": step["label"],
                "expected_action_type": step["expected_action_type"],
                "assignment_scope": step["assignment_scope"],
                "resolution_status": step["resolution_status"],
                "resolution_note": step["resolution_note"],
                "resolved_user_id": step["resolved_user_id"],
                "resolved_user_name": step["resolved_user_name"],
                "resolved_role_label": step["role_label"],
                "resolved_org_unit_name": step["resolved_org_unit_name"],
            }
            for step in plan_steps
        ]

        return {
            "matched_rule_id": matching_rule.id,
            "matched_rule_name": matching_rule.name,
            "template_id": template.id,
            "template_name": template.name,
            "selected_owner_id": owner.id if owner else None,
            "selected_owner_name": owner.full_name if owner else None,
            "selected_owner_role": getattr(owner.role, "label", None)
            if owner
            else None,
            "resolved_steps": resolved_steps,
            "explanation": "Simulation reussie. Voici le circuit theorique qui serait applique.",
        }
