# backend/app/api/v1/endpoints/gedrules.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.gedrules import WorkflowTemplate, WorkflowTemplateStep, RoutingRule
from app.models.document_category import DocumentCategory
from app.schemas.gedrules import (
    WorkflowTemplateCreate,
    WorkflowTemplateRead,
    WorkflowTemplateUpdate,
    RoutingRuleCreate,
    RoutingRuleRead,
    RoutingRuleUpdate,
    SimulateRequest,
    SimulateResponse,
)
from app.services.gedrules_service import SimulateRoutingUseCase
from app.core.authz import authorize_or_403


async def _get_categories_for_tenant(
    db: AsyncSession, category_ids: list[UUID], tenant_id: UUID
) -> list[DocumentCategory]:
    if not category_ids:
        raise HTTPException(
            status_code=400, detail="Au moins un type de document est requis."
        )
    result = await db.execute(
        select(DocumentCategory).where(
            DocumentCategory.id.in_(category_ids),
            DocumentCategory.tenant_id == tenant_id,
        )
    )
    cats = result.scalars().all()
    if len(cats) != len(category_ids):
        raise HTTPException(
            status_code=400, detail="Catégories invalides ou inactives."
        )
    return list(cats)


async def _get_org_units_for_tenant(
    db: AsyncSession, org_unit_ids: list[UUID], tenant_id: UUID
):
    if not org_unit_ids:
        return []
    from app.models.org_unit import OrgUnit

    result = await db.execute(
        select(OrgUnit).where(
            OrgUnit.id.in_(org_unit_ids), OrgUnit.tenant_id == tenant_id
        )
    )
    units = result.scalars().all()
    if len(units) != len(org_unit_ids):
        raise HTTPException(
            status_code=400, detail="Unités organisationnelles invalides."
        )
    return list(units)


router = APIRouter()

# ==========================================
# WORKFLOW TEMPLATES
# ==========================================


@router.get("/templates", response_model=List[WorkflowTemplateRead])
async def read_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
):
    await authorize_or_403(current_user, "gedrules.templates", "read")
    stmt = (
        select(WorkflowTemplate)
        .options(selectinload(WorkflowTemplate.steps))
        .filter(WorkflowTemplate.tenant_id == current_user.tenant_id)
        .order_by(WorkflowTemplate.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "/templates",
    response_model=WorkflowTemplateRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_template(
    template_in: WorkflowTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await authorize_or_403(current_user, "gedrules.templates", "create")
    if not template_in.steps:
        raise HTTPException(
            status_code=400, detail="Un template doit avoir au moins une étape."
        )

    template = WorkflowTemplate(
        tenant_id=current_user.tenant_id,
        code=template_in.code,
        name=template_in.name,
        description=template_in.description,
        is_active=template_in.is_active,
    )
    db.add(template)
    await db.flush()

    for s in template_in.steps:
        step = WorkflowTemplateStep(
            template_id=template.id,
            step_order=s.step_order,
            label=s.label,
            expected_action_type=s.expected_action_type,
            role_id=s.role_id,
            assignment_scope=s.assignment_scope,
            target_unit_type_id=s.target_unit_type_id,
        )
        db.add(step)

    await db.commit()
    result = await db.execute(
        select(WorkflowTemplate)
        .options(selectinload(WorkflowTemplate.steps))
        .filter_by(id=template.id)
    )
    return result.scalar_one()


@router.get("/templates/{id}", response_model=WorkflowTemplateRead)
async def read_template(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await authorize_or_403(current_user, "gedrules.templates", "read")
    stmt = (
        select(WorkflowTemplate)
        .options(selectinload(WorkflowTemplate.steps))
        .filter(
            WorkflowTemplate.id == id,
            WorkflowTemplate.tenant_id == current_user.tenant_id,
        )
    )
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.put("/templates/{id}", response_model=WorkflowTemplateRead)
async def update_template(
    id: UUID,
    template_in: WorkflowTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await authorize_or_403(current_user, "gedrules.templates", "update")
    stmt = (
        select(WorkflowTemplate)
        .options(selectinload(WorkflowTemplate.steps))
        .filter(
            WorkflowTemplate.id == id,
            WorkflowTemplate.tenant_id == current_user.tenant_id,
        )
    )
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data = template_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field != "steps":
            setattr(template, field, value)

    if "steps" in update_data:
        # Garde-fou métier: refuser la modif des étapes si le template est utilisé
        # par une règle de routage active, pour éviter des incohérences en vol.
        used_result = await db.execute(
            select(RoutingRule).filter(
                RoutingRule.workflow_template_id == id, RoutingRule.is_active
            )
        )
        if used_result.scalars().first():
            raise HTTPException(
                status_code=400,
                detail="Impossible de modifier les étapes d'un template assigné à une règle de routage active.",
            )

        if not template_in.steps:
            raise HTTPException(
                status_code=400, detail="Un template doit avoir au moins une étape."
            )
        # Clear existing steps and add new ones
        await db.execute(
            WorkflowTemplateStep.__table__.delete().where(
                WorkflowTemplateStep.template_id == template.id
            )
        )

        for s in template_in.steps:
            step = WorkflowTemplateStep(
                template_id=template.id,
                step_order=s.step_order,
                label=s.label,
                expected_action_type=s.expected_action_type,
                role_id=s.role_id,
                assignment_scope=s.assignment_scope,
                target_unit_type_id=s.target_unit_type_id,
            )
            db.add(step)

    await db.commit()
    result = await db.execute(
        select(WorkflowTemplate)
        .execution_options(populate_existing=True)
        .options(selectinload(WorkflowTemplate.steps))
        .filter_by(id=template.id)
    )
    return result.scalar_one()


@router.delete("/templates/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await authorize_or_403(current_user, "gedrules.templates", "delete")
    stmt = select(WorkflowTemplate).filter(
        WorkflowTemplate.id == id, WorkflowTemplate.tenant_id == current_user.tenant_id
    )
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    used_result = await db.execute(
        select(RoutingRule).filter(RoutingRule.workflow_template_id == id)
    )
    used = used_result.scalars().first()
    if used:
        raise HTTPException(
            status_code=400,
            detail="Impossible de supprimer un template utilisé par une règle de routage.",
        )

    await db.delete(template)
    await db.commit()
    return None


# ==========================================
# ROUTING RULES
# ==========================================


@router.get("/rules", response_model=List[RoutingRuleRead])
async def read_rules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
):
    await authorize_or_403(current_user, "gedrules.rules", "read")
    stmt = (
        select(RoutingRule)
        .options(
            selectinload(RoutingRule.document_categories),
            selectinload(RoutingRule.org_units),
        )
        .filter(RoutingRule.tenant_id == current_user.tenant_id)
        .order_by(RoutingRule.priority.asc(), RoutingRule.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "/rules", response_model=RoutingRuleRead, status_code=status.HTTP_201_CREATED
)
async def create_rule(
    rule_in: RoutingRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await authorize_or_403(current_user, "gedrules.rules", "create")
    stmt = (
        select(WorkflowTemplate)
        .options(selectinload(WorkflowTemplate.steps))
        .filter(
            WorkflowTemplate.id == rule_in.workflow_template_id,
            WorkflowTemplate.tenant_id == current_user.tenant_id,
        )
    )
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(
            status_code=404, detail="Le template de destination est introuvable."
        )
    if not template.steps:
        raise HTTPException(
            status_code=400,
            detail="Une règle ne peut cibler un template qui n'a aucune étape.",
        )
    if not template.is_active and rule_in.is_active:
        raise HTTPException(
            status_code=400,
            detail="Impossible d'activer une règle qui cible un template inactif.",
        )

    categories = await _get_categories_for_tenant(
        db, rule_in.document_category_ids, current_user.tenant_id
    )
    org_units = await _get_org_units_for_tenant(
        db, rule_in.org_unit_ids or [], current_user.tenant_id
    )

    rule = RoutingRule(
        tenant_id=current_user.tenant_id,
        code=rule_in.code,
        name=rule_in.name,
        description=rule_in.description,
        priority=rule_in.priority,
        is_active=rule_in.is_active,
        workflow_template_id=rule_in.workflow_template_id,
    )
    rule.document_categories = categories
    rule.org_units = org_units

    db.add(rule)
    await db.commit()
    # Reload with relationships
    stmt = (
        select(RoutingRule)
        .options(
            selectinload(RoutingRule.document_categories),
            selectinload(RoutingRule.org_units),
        )
        .filter(RoutingRule.id == rule.id)
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.put("/rules/{id}", response_model=RoutingRuleRead)
async def update_rule(
    id: UUID,
    rule_in: RoutingRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await authorize_or_403(current_user, "gedrules.rules", "update")
    stmt = (
        select(RoutingRule)
        .options(
            selectinload(RoutingRule.document_categories),
            selectinload(RoutingRule.org_units),
        )
        .filter(RoutingRule.id == id, RoutingRule.tenant_id == current_user.tenant_id)
    )
    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    if rule_in.workflow_template_id is not None:
        template_stmt = select(WorkflowTemplate).filter(
            WorkflowTemplate.id == rule_in.workflow_template_id,
            WorkflowTemplate.tenant_id == current_user.tenant_id,
        )
        t_res = await db.execute(template_stmt)
        template = t_res.scalar_one_or_none()
        if not template:
            raise HTTPException(
                status_code=404, detail="Le template de destination est introuvable."
            )
        if not template.steps:
            raise HTTPException(
                status_code=400,
                detail="Une règle ne peut cibler un template qui n'a aucune étape.",
            )
        if not template.is_active and (rule_in.is_active or rule.is_active):
            raise HTTPException(
                status_code=400,
                detail="Impossible d'activer une règle qui cible un template inactif.",
            )

    update_data = rule_in.model_dump(exclude_unset=True)
    if (
        "document_category_ids" in update_data
        and update_data["document_category_ids"] is not None
    ):
        categories = await _get_categories_for_tenant(
            db, update_data["document_category_ids"], current_user.tenant_id
        )
        rule.document_categories = categories

    if "org_unit_ids" in update_data and update_data["org_unit_ids"] is not None:
        org_units = await _get_org_units_for_tenant(
            db, update_data["org_unit_ids"], current_user.tenant_id
        )
        rule.org_units = org_units

    for field, value in update_data.items():
        if field not in ["document_category_ids", "org_unit_ids"]:
            setattr(rule, field, value)

    await db.commit()
    # Reload
    result = await db.execute(stmt)
    return result.scalar_one()


@router.delete("/rules/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await authorize_or_403(current_user, "gedrules.rules", "delete")
    stmt = select(RoutingRule).filter(
        RoutingRule.id == id, RoutingRule.tenant_id == current_user.tenant_id
    )
    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    await db.delete(rule)
    await db.commit()
    return None


# ==========================================
# SIMULATION
# ==========================================


@router.post("/simulate", response_model=SimulateResponse)
async def simulate_routing(
    request: SimulateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Simule ce qui se passerait pour une catégorie et une org_unit donnée.
    Renvoie les acteurs résolus et les détails de la règle sans persister d'audit en BDD.
    """
    await authorize_or_403(current_user, "gedrules.rules", "simulate")
    use_case = SimulateRoutingUseCase(db)
    result = await use_case.execute(
        tenant_id=current_user.tenant_id,
        document_category_id=request.document_category_id,
        org_unit_id=request.org_unit_id,
        owner_id=request.owner_id,
    )
    return SimulateResponse(**result)
