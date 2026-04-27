# backend/app/services/gedrules_service.py
import logging
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.models.document import Document
from app.models.gedrules import (
    RoutingRule,
    WorkflowTemplate,
    WorkflowTemplateStep,
    AssignmentScope,
)
from app.models.routing_audit import DocumentRoutingDecision
from app.models.user import User
from app.models.org_unit import OrgUnit
from app.models.workflow import WorkflowStep
from app.models.workflow import ActionType

logger = logging.getLogger(__name__)


class AssignmentPolicy:
    """
    Politique de résolution des acteurs (Mapping Rôle -> Utilisateur).
    Implémente la logique de recherche organisationnelle.
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
        """
        Résout l'acteur :
        - Si target_unit_type_id est fourni → remonte les ancêtres jusqu'au premier
          OrgUnit ayant ce type (résolution ancrée sur le type, robuste à la profondeur).
        - Sinon, retombe sur le scope relatif legacy (same / parent / grandparent).
        """

        async def find_user_in_unit(unit_id: UUID) -> Optional[User]:
            stmt = select(User).where(
                User.tenant_id == tenant_id,
                User.role_id == role_id,
                User.org_unit_id == unit_id,
                User.is_active == True,
            )
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

        async def get_unit(unit_id: UUID) -> Optional[OrgUnit]:
            result = await db.execute(select(OrgUnit).where(OrgUnit.id == unit_id))
            return result.scalar_one_or_none()

        # ── Résolution type-ancrée (recommandée) ──
        if target_unit_type_id is not None:
            current_id = org_unit_id
            # On remonte jusqu'à 16 niveaux pour éviter toute boucle pathologique.
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

        # ── Fallback legacy : scope relatif ──
        if scope == AssignmentScope.same_org_unit:
            return await find_user_in_unit(org_unit_id)

        elif scope == AssignmentScope.parent_org_unit:
            unit = await get_unit(org_unit_id)
            if unit and unit.parent_id:
                return await find_user_in_unit(unit.parent_id)
            return None

        elif scope == AssignmentScope.grandparent_org_unit:
            unit = await get_unit(org_unit_id)
            if unit and unit.parent_id:
                parent = await get_unit(unit.parent_id)
                if parent and parent.parent_id:
                    return await find_user_in_unit(parent.parent_id)
            return None

        return None


class ApplyRoutingRulesToDocumentUseCase:
    """
    Use Case orchestrant l'application des règles de routage sur un document.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.policy = AssignmentPolicy()

    async def execute(self, document: Document) -> Tuple[bool, str]:
        """
        Applique les règles de routage.
        Retourne (True, message) si une règle a été appliquée, (False, message) sinon.
        """
        # 1. Recherche de la meilleure règle correspondante
        # Trié par priorité ASC (plus petit = plus fort)
        stmt = (
            select(RoutingRule)
            .options(
                selectinload(RoutingRule.document_categories),
                selectinload(RoutingRule.org_units),
            )
            .where(
                RoutingRule.tenant_id == document.tenant_id,
                RoutingRule.is_active == True,
            )
            .order_by(RoutingRule.priority.asc())
        )

        result = await self.db.execute(stmt)
        rules = result.scalars().all()

        matching_rule = None
        for rule in rules:
            cat_ids = [str(c.id) for c in rule.document_categories]
            if str(document.document_category_id) in cat_ids:
                if not rule.org_units:
                    matching_rule = rule
                    break
                else:
                    ou_ids = [str(o.id) for o in rule.org_units]
                    if str(document.org_unit_id) in ou_ids:
                        matching_rule = rule
                        break

        if not matching_rule:
            return False, "Aucune règle de routage trouvée pour ce document."

        # Charger le template explicitement car AsyncSession
        stmt = select(WorkflowTemplate).where(
            WorkflowTemplate.id == matching_rule.workflow_template_id
        )
        result = await self.db.execute(stmt)
        template = result.scalar_one_or_none()

        if not template or not template.is_active:
            return (
                False,
                f"La règle '{matching_rule.name}' cible un template manquant ou inactif.",
            )

        # Charger les étapes du template
        stmt = (
            select(WorkflowTemplateStep)
            .where(WorkflowTemplateStep.template_id == template.id)
            .order_by(WorkflowTemplateStep.step_order.asc())
        )
        result = await self.db.execute(stmt)
        template_steps = result.scalars().all()

        # 2. Instanciation des étapes
        steps_to_create = []
        resolved_summaries = []
        has_partial_failure = False

        for t_step in template_steps:
            assigned_user = await self.policy.resolve_actor(
                self.db,
                document.tenant_id,
                t_step.role_id,
                document.org_unit_id,
                t_step.assignment_scope,
                target_unit_type_id=t_step.target_unit_type_id,
            )

            step_status = "pending"
            if t_step.step_order == 1:
                step_status = "current"

            # Fallback Option 2: assignement null si non résolu
            assignment_error = None
            if not assigned_user:
                step_status = "pending_assignment"
                has_partial_failure = True
                assignment_error = f"Aucun utilisateur trouvé pour le rôle {t_step.role_id} dans le scope {t_step.assignment_scope}"

            new_step = WorkflowStep(
                document_id=document.id,
                step_order=t_step.step_order,
                label=t_step.label,
                status=step_status,
                expected_action_type=t_step.expected_action_type,
                assigned_to=assigned_user.id if assigned_user else None,
            )
            steps_to_create.append(new_step)

            resolved_summaries.append(
                {
                    "template_step_id": str(t_step.id),
                    "label": t_step.label,
                    "role_id": t_step.role_id,
                    "assigned_to": str(assigned_user.id) if assigned_user else None,
                    "error": assignment_error,
                }
            )

        # 3. Sauvegarde des étapes
        for s in steps_to_create:
            self.db.add(s)

        # 4. Audit de décision
        decision_status = "success" if not has_partial_failure else "partial_failure"
        explanation = f"Règle '{matching_rule.name}' appliquée avec succès."
        if has_partial_failure:
            explanation = f"Règle '{matching_rule.name}' appliquée mais certaines étapes n'ont pas d'assignation."

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
            },
            resolved_steps_summary=resolved_summaries,
            explanation=explanation,
        )
        self.db.add(decision)

        # 5. Mise à jour statut document
        document.status = "in_review"

        # Le commit est géré par l'appelant (service ou endpoint)
        return True, explanation


class SimulateRoutingUseCase:
    """
    Simule l'application des règles de routage pour une catégorie et une org_unit.
    Ne modifie pas la base de données. Renvoie les noms complets et les rôles.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.policy = AssignmentPolicy()

    async def execute(
        self, tenant_id: UUID, document_category_id: UUID, org_unit_id: Optional[UUID]
    ) -> dict:
        stmt = (
            select(RoutingRule)
            .options(
                selectinload(RoutingRule.document_categories),
                selectinload(RoutingRule.org_units),
            )
            .where(RoutingRule.tenant_id == tenant_id, RoutingRule.is_active == True)
            .order_by(RoutingRule.priority.asc())
        )

        result = await self.db.execute(stmt)
        rules = result.scalars().all()

        matching_rule = None
        for rule in rules:
            cat_ids = [str(c.id) for c in rule.document_categories]
            if str(document_category_id) in cat_ids:
                if not rule.org_units:
                    matching_rule = rule
                    break
                else:
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
                "resolved_steps": [],
                "explanation": "Aucune règle ne correspond à cette combinaison (Catégorie / Unité).",
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
                "template_name": "Introuvable ou Inactif",
                "resolved_steps": [],
                "explanation": f"La règle cible un template inactif ou supprimé.",
            }

        stmt = (
            select(WorkflowTemplateStep)
            .where(WorkflowTemplateStep.template_id == template.id)
            .order_by(WorkflowTemplateStep.step_order.asc())
        )
        result = await self.db.execute(stmt)
        template_steps = result.scalars().all()

        resolved_steps = []
        from app.models.role import Role

        for t_step in template_steps:
            assigned_user = await self.policy.resolve_actor(
                self.db,
                tenant_id,
                t_step.role_id,
                org_unit_id,
                t_step.assignment_scope,
                target_unit_type_id=t_step.target_unit_type_id,
            )

            # Fetch Role label
            role_result = await self.db.execute(
                select(Role).where(Role.id == t_step.role_id)
            )
            role = role_result.scalar_one_or_none()
            role_label = role.label if role else f"Role ({t_step.role_id})"

            # Fetch user org_unit name if assigned
            org_unit_name = None
            if assigned_user and assigned_user.org_unit_id:
                ou_result = await self.db.execute(
                    select(OrgUnit).where(OrgUnit.id == assigned_user.org_unit_id)
                )
                ou = ou_result.scalar_one_or_none()
                org_unit_name = ou.name if ou else None

            resolved_steps.append(
                {
                    "step_order": t_step.step_order,
                    "label": t_step.label,
                    "expected_action_type": t_step.expected_action_type,
                    "assignment_scope": t_step.assignment_scope,
                    "resolved_user_id": assigned_user.id if assigned_user else None,
                    "resolved_user_name": f"{assigned_user.first_name} {assigned_user.last_name}"
                    if assigned_user
                    else None,
                    "resolved_role_label": role_label,
                    "resolved_org_unit_name": org_unit_name,
                }
            )

        return {
            "matched_rule_id": matching_rule.id,
            "matched_rule_name": matching_rule.name,
            "template_id": template.id,
            "template_name": template.name,
            "resolved_steps": resolved_steps,
            "explanation": "Simulation réussie. Voici le circuit théorique qui serait appliqué.",
        }
