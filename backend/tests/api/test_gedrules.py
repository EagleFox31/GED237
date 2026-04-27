# backend/tests/api/test_gedrules.py
import pytest
import uuid
import asyncio
from httpx import AsyncClient
from sqlalchemy import select
from app.models.document import Document
from app.models.workflow import WorkflowStep
from app.models.gedrules import (
    RoutingRule,
    WorkflowTemplate,
    WorkflowTemplateStep,
    AssignmentScope,
)
from app.models.routing_audit import DocumentRoutingDecision
from app.models.user import User


@pytest.mark.asyncio
async def test_automatic_routing_on_upload(
    auth_client: AsyncClient, db_session, db_seed
):
    """
    Vérifie qu'un upload avec la catégorie 'note_de_service' déclenche
    automatiquement la création des steps de workflow via GEDRules.
    """
    # 1. Préparation du fichier
    file_content = b"Contenu de test pour routage auto"
    files = {"file": ("note_service.txt", file_content, "text/plain")}
    data = {
        "title": "Note de Service 2024-001",
        "document_category_id": str(db_seed["category_id"]),
        "description": "Auto-routed document",
    }

    # 2. Upload
    response = await auth_client.post(
        "/api/v1/documents/upload", data=data, files=files
    )
    assert response.status_code == 201
    doc_id = response.json()["id"]

    # Le dispatcher est désormais bloquant (asyncio.gather) :
    # les WorkflowSteps sont créés avant le retour de l'endpoint.

    # 3. Vérification des WorkflowSteps créés
    stmt = (
        select(WorkflowStep)
        .where(WorkflowStep.document_id == doc_id)
        .order_by(WorkflowStep.step_order)
    )
    result = await db_session.execute(stmt)
    steps = result.scalars().all()

    assert len(steps) == 1
    assert steps[0].label == "Visa Direction"
    assert steps[0].status == "current"
    assert str(steps[0].assigned_to) == str(db_seed["user_id"])

    # 4. Vérification de l'audit de décision
    stmt = select(DocumentRoutingDecision).where(
        DocumentRoutingDecision.document_id == doc_id
    )
    result = await db_session.execute(stmt)
    decision = result.scalar_one_or_none()

    assert decision is not None
    assert decision.status == "success"
    assert decision.routing_rule_id == db_seed["rule_id"]
    assert decision.workflow_template_id == db_seed["template_id"]
    await asyncio.sleep(0.1)


@pytest.mark.asyncio
async def test_routing_fallback_to_pending_assignment(
    auth_client: AsyncClient, db_session, db_seed
):
    """
    Vérifie le fallback (Option 2) : si aucun utilisateur n'est trouvé pour le rôle,
    le step est créé avec assigned_to=null et status=pending_assignment.
    """
    # 1. Création d'une règle et d'un template avec un rôle existant mais sans user
    from app.models.role import Role

    new_role = Role(code="empty_role", label="Rôle sans utilisateur", hierarchy_level=9)
    db_session.add(new_role)
    await db_session.flush()
    UNUSED_ROLE_ID = new_role.id
    template = WorkflowTemplate(
        tenant_id=db_seed["tenant_id"],
        code="FALLBACK_TEMPLATE",
        name="Template avec Fallback",
        is_active=True,
    )
    db_session.add(template)
    await db_session.flush()

    t_step = WorkflowTemplateStep(
        template_id=template.id,
        step_order=1,
        label="Étape Impossible",
        expected_action_type="visa",
        role_id=UNUSED_ROLE_ID,
        assignment_scope=AssignmentScope.same_org_unit,
    )
    db_session.add(t_step)

    rule = RoutingRule(
        tenant_id=db_seed["tenant_id"],
        code="FALLBACK_RULE",
        name="Règle Fallback",
        priority=5,  # Plus forte que la règle de base (10) → sera sélectionnée
        document_category_id=db_seed[
            "category_id"
        ],  # Même catégorie → compétition sur la priorité
        workflow_template_id=template.id,
        is_active=True,
    )
    db_session.add(rule)
    await db_session.commit()

    # 2. Upload déclenchant cette règle (la FALLBACK_RULE gagne grâce à sa priorité 5 < 10)
    files = {"file": ("urgent.txt", b"urgent", "text/plain")}
    data = {"title": "Doc Urgent", "document_category_id": str(db_seed["category_id"])}

    response = await auth_client.post(
        "/api/v1/documents/upload", data=data, files=files
    )
    assert response.status_code == 201
    doc_id = response.json()["id"]

    # 3. Vérification du step "bloqué"
    stmt = select(WorkflowStep).where(WorkflowStep.document_id == doc_id)
    result = await db_session.execute(stmt)
    steps = result.scalars().all()

    assert len(steps) == 1
    assert steps[0].assigned_to is None
    assert steps[0].status == "pending_assignment"  # Le statut spécifique de blocage

    # 4. Vérification de l'audit
    stmt = select(DocumentRoutingDecision).where(
        DocumentRoutingDecision.document_id == doc_id
    )
    result = await db_session.execute(stmt)
    decision = result.scalar_one_or_none()

    assert decision.status == "partial_failure"
    assert "Étape Impossible" in str(decision.resolved_steps_summary)
    assert "certaines étapes n'ont pas d'assignation" in decision.explanation
    await asyncio.sleep(0.1)


@pytest.mark.asyncio
async def test_no_routing_if_category_unknown(
    auth_client: AsyncClient, db_session, db_seed
):
    """
    Vérifie qu'un document sans catégorie ou avec catégorie inconnue
    reste en draft sans workflow.
    """
    files = {"file": ("simple.txt", b"hello", "text/plain")}
    data = {"title": "Simple Doc"}  # No category = no match

    response = await auth_client.post(
        "/api/v1/documents/upload", data=data, files=files
    )
    assert response.status_code == 201
    doc_id = response.json()["id"]

    # Vérification : pas de steps
    stmt = select(WorkflowStep).where(WorkflowStep.document_id == doc_id)
    result = await db_session.execute(stmt)
    steps = result.scalars().all()
    assert len(steps) == 0

    # Statut reste draft (si aucune règle ne s'applique)
    stmt = select(Document).where(Document.id == doc_id)
    result = await db_session.execute(stmt)
    document = result.scalar_one()
    assert document.status == "draft"
    await asyncio.sleep(0.1)
    await asyncio.sleep(0.1)


@pytest.mark.asyncio
async def test_routing_priority_resolution(
    auth_client: AsyncClient, db_session, db_seed
):
    """
    Vérifie qu'entre plusieurs règles qui matchent, celle avec la priorité la plus forte
    (chiffre le plus bas) gagne.
    """
    # 1. db_seed fournit déjà une règle 'note_de_service' avec priorité 10.
    # Nous allons créer une Règle B avec priorité 5, plus forte.

    template_b = WorkflowTemplate(
        tenant_id=db_seed["tenant_id"],
        code="HIGH_PRIO_TEMPLATE",
        name="Template Haute Priorité",
        is_active=True,
    )
    db_session.add(template_b)
    await db_session.flush()

    rule_b = RoutingRule(
        tenant_id=db_seed["tenant_id"],
        code="HIGH_PRIO_RULE",
        name="Règle Haute Priorité",
        priority=5,  # Plus forte que 10
        document_category_id=db_seed["category_id"],  # Même catégorie que db_seed
        workflow_template_id=template_b.id,
        is_active=True,
    )
    db_session.add(rule_b)
    await db_session.commit()

    # 2. Upload
    files = {"file": ("conflict.txt", b"conflict", "text/plain")}
    data = {
        "title": "Doc Conflit Priorité",
        "document_category_id": str(db_seed["category_id"]),
    }

    response = await auth_client.post(
        "/api/v1/documents/upload", data=data, files=files
    )
    assert response.status_code == 201
    doc_id = response.json()["id"]

    # 3. Vérification de l'audit de décision
    stmt = select(DocumentRoutingDecision).where(
        DocumentRoutingDecision.document_id == doc_id
    )
    result = await db_session.execute(stmt)
    decision = result.scalar_one_or_none()

    assert decision is not None
    assert decision.status == "success"
    assert (
        decision.routing_rule_id == rule_b.id
    )  # La règle B (prio 5) doit gagner contre la règle seed (prio 10)
    assert decision.workflow_template_id == template_b.id

    await asyncio.sleep(0.1)
