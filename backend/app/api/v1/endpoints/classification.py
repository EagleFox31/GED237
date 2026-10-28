import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.authz import authorize_or_403
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.classification_activity import ClassificationActivity
from app.models.classification_domain import ClassificationDomain
from app.models.classification_rule import ClassificationRule
from app.models.document_category import DocumentCategory
from app.models.gedrules import WorkflowTemplate
from app.models.org_unit import OrgUnit
from app.models.user import User
from app.schemas.classification_admin import (
    ClassificationActivityCreate,
    ClassificationActivityRead,
    ClassificationActivityUpdate,
    ClassificationDomainCreate,
    ClassificationDomainRead,
    ClassificationDomainUpdate,
    ClassificationRuleCreate,
    ClassificationRuleRead,
    ClassificationRuleUpdate,
)
from app.schemas.classification import (
    ClassificationSimulationRequest,
    ClassificationSimulationResponse,
)
from app.services.classification_rule_engine import ClassificationRuleEngine

router = APIRouter()


def _normalize_code(value: str) -> str:
    normalized = value.strip().lower()
    return re.sub(r"[^a-z0-9_]", "_", normalized)


async def _get_domain_or_404(
    db: AsyncSession, *, tenant_id: UUID, domain_id: UUID
) -> ClassificationDomain:
    result = await db.execute(
        select(ClassificationDomain).where(
            ClassificationDomain.id == domain_id,
            ClassificationDomain.tenant_id == tenant_id,
        )
    )
    domain = result.scalar_one_or_none()
    if not domain:
        raise HTTPException(
            status_code=404, detail="Domaine de classement introuvable."
        )
    return domain


async def _get_activity_or_404(
    db: AsyncSession, *, tenant_id: UUID, activity_id: UUID
) -> ClassificationActivity:
    result = await db.execute(
        select(ClassificationActivity)
        .options(selectinload(ClassificationActivity.domain))
        .where(
            ClassificationActivity.id == activity_id,
            ClassificationActivity.tenant_id == tenant_id,
        )
    )
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(
            status_code=404, detail="Activite de classement introuvable."
        )
    return activity


async def _validate_optional_refs(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    payload: ClassificationRuleCreate | ClassificationRuleUpdate,
) -> None:
    if payload.document_category_id:
        result = await db.execute(
            select(DocumentCategory.id).where(
                DocumentCategory.id == payload.document_category_id,
                DocumentCategory.tenant_id == tenant_id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=400, detail="Categorie documentaire invalide."
            )
    if payload.source_org_unit_id:
        result = await db.execute(
            select(OrgUnit.id).where(
                OrgUnit.id == payload.source_org_unit_id,
                OrgUnit.tenant_id == tenant_id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Unite source invalide.")
    if payload.target_org_unit_id:
        result = await db.execute(
            select(OrgUnit.id).where(
                OrgUnit.id == payload.target_org_unit_id,
                OrgUnit.tenant_id == tenant_id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Unite cible invalide.")
    if payload.source_user_id:
        result = await db.execute(
            select(User.id).where(
                User.id == payload.source_user_id, User.tenant_id == tenant_id
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Utilisateur source invalide.")
    if payload.target_user_id:
        result = await db.execute(
            select(User.id).where(
                User.id == payload.target_user_id, User.tenant_id == tenant_id
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Utilisateur cible invalide.")
    if payload.domain_id:
        await _get_domain_or_404(db, tenant_id=tenant_id, domain_id=payload.domain_id)
    if payload.activity_id:
        await _get_activity_or_404(
            db, tenant_id=tenant_id, activity_id=payload.activity_id
        )
    if payload.workflow_template_id:
        result = await db.execute(
            select(WorkflowTemplate.id).where(
                WorkflowTemplate.id == payload.workflow_template_id,
                WorkflowTemplate.tenant_id == tenant_id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Template workflow invalide.")

    # Multi-sélection : valider que tous les IDs appartiennent au tenant.
    # On filtre les invalides plutôt que de tout rejeter ? Non — au create/update
    # on est strict (l'admin doit voir l'erreur). Au matching runtime, par
    # contre, les IDs orphelins sont silencieusement ignorés (cf. moteur).
    if payload.document_category_ids:
        result = await db.execute(
            select(DocumentCategory.id).where(
                DocumentCategory.id.in_(payload.document_category_ids),
                DocumentCategory.tenant_id == tenant_id,
            )
        )
        found = {row[0] for row in result.all()}
        missing = set(payload.document_category_ids) - found
        if missing:
            raise HTTPException(
                status_code=400,
                detail="Categorie(s) documentaire(s) invalide(s).",
            )
    if payload.source_org_unit_ids:
        result = await db.execute(
            select(OrgUnit.id).where(
                OrgUnit.id.in_(payload.source_org_unit_ids),
                OrgUnit.tenant_id == tenant_id,
            )
        )
        found = {row[0] for row in result.all()}
        missing = set(payload.source_org_unit_ids) - found
        if missing:
            raise HTTPException(
                status_code=400, detail="Service(s) source(s) invalide(s)."
            )
    if payload.source_org_unit_excluded_ids:
        result = await db.execute(
            select(OrgUnit.id).where(
                OrgUnit.id.in_(payload.source_org_unit_excluded_ids),
                OrgUnit.tenant_id == tenant_id,
            )
        )
        found = {row[0] for row in result.all()}
        missing = set(payload.source_org_unit_excluded_ids) - found
        if missing:
            raise HTTPException(
                status_code=400, detail="Exception(s) d'origine invalide(s)."
            )
    if payload.source_user_ids:
        result = await db.execute(
            select(User.id).where(
                User.id.in_(payload.source_user_ids),
                User.tenant_id == tenant_id,
            )
        )
        found = {row[0] for row in result.all()}
        missing = set(payload.source_user_ids) - found
        if missing:
            raise HTTPException(
                status_code=400, detail="Agent(s) source(s) invalide(s)."
            )


async def _ensure_domain_code_unique(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    code: str,
    exclude_domain_id: UUID | None = None,
) -> None:
    stmt = select(ClassificationDomain.id).where(
        ClassificationDomain.tenant_id == tenant_id,
        ClassificationDomain.code == code,
    )
    if exclude_domain_id:
        stmt = stmt.where(ClassificationDomain.id != exclude_domain_id)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Code de domaine deja utilise.")


async def _ensure_activity_code_unique(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    domain_id: UUID,
    code: str,
    exclude_activity_id: UUID | None = None,
) -> None:
    stmt = select(ClassificationActivity.id).where(
        ClassificationActivity.tenant_id == tenant_id,
        ClassificationActivity.domain_id == domain_id,
        ClassificationActivity.code == code,
    )
    if exclude_activity_id:
        stmt = stmt.where(ClassificationActivity.id != exclude_activity_id)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400, detail="Code d'activite deja utilise dans ce domaine."
        )


async def _ensure_rule_code_unique(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    code: str,
    exclude_rule_id: UUID | None = None,
) -> None:
    stmt = select(ClassificationRule.id).where(
        ClassificationRule.tenant_id == tenant_id,
        ClassificationRule.code == code,
    )
    if exclude_rule_id:
        stmt = stmt.where(ClassificationRule.id != exclude_rule_id)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Code de regle deja utilise.")


async def _validate_rule_payload(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    payload: ClassificationRuleCreate | ClassificationRuleUpdate,
    current_rule: ClassificationRule | None = None,
) -> None:
    await _validate_optional_refs(db, tenant_id=tenant_id, payload=payload)

    payload_data = (
        payload.model_dump()
        if current_rule is None
        else payload.model_dump(exclude_unset=True)
    )

    def effective(field: str):
        if field in payload_data:
            return payload_data[field]
        if current_rule is not None:
            return getattr(current_rule, field)
        return None

    domain_id = effective("domain_id")
    activity_id = effective("activity_id")
    target_scope = effective("target_scope")
    target_user_id = effective("target_user_id")
    year_strategy = effective("year_strategy")
    fixed_year = effective("fixed_year")
    source_org_unit_ids = effective("source_org_unit_ids") or []
    source_org_unit_excluded_ids = effective("source_org_unit_excluded_ids") or []

    if activity_id and not domain_id:
        raise HTTPException(
            status_code=400,
            detail="Une activite de classement requiert un domaine de classement.",
        )

    if activity_id and domain_id:
        activity = await _get_activity_or_404(
            db, tenant_id=tenant_id, activity_id=activity_id
        )
        if activity.domain_id != domain_id:
            raise HTTPException(
                status_code=400,
                detail="L'activite choisie n'appartient pas au domaine selectionne.",
            )

    if target_scope != "person" and target_user_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Un utilisateur cible n'est autorise que pour un scope de type personne.",
        )

    if year_strategy == "fixed":
        if fixed_year is None:
            raise HTTPException(
                status_code=400,
                detail="L'annee fixe est obligatoire lorsque la strategie d'annee est 'fixed'.",
            )
        if fixed_year < 1900 or fixed_year > 2100:
            raise HTTPException(
                status_code=400,
                detail="L'annee fixe doit etre comprise entre 1900 et 2100.",
            )
    elif fixed_year is not None:
        raise HTTPException(
            status_code=400,
            detail="fixed_year ne peut etre renseigne que si year_strategy vaut 'fixed'.",
        )

    if source_org_unit_excluded_ids and not source_org_unit_ids:
        raise HTTPException(
            status_code=400,
            detail="Des exceptions d'origine nécessitent au moins une origine concernée.",
        )


# JSONB columns holding UUID lists: they need str values, unlike UUID FKs.
_RULE_JSONB_ID_LISTS = (
    "document_category_ids",
    "source_org_unit_ids",
    "source_org_unit_excluded_ids",
    "source_user_ids",
)


def _rule_column_values(payload, **dump_kwargs) -> dict:
    """Dump a rule payload into ORM column values.

    Only the JSONB lists are serialized to strings: scalar FKs must stay UUIDs,
    otherwise relationships (domain, activity...) cannot be resolved on the
    instance after commit and names such as domain_name come back empty.
    """
    values = payload.model_dump(**dump_kwargs)
    for field in _RULE_JSONB_ID_LISTS:
        if values.get(field) is not None:
            values[field] = [str(item) for item in values[field]]
    return values


def _classification_rule_query():
    return select(ClassificationRule).options(
        selectinload(ClassificationRule.document_category),
        selectinload(ClassificationRule.source_org_unit),
        selectinload(ClassificationRule.source_user),
        selectinload(ClassificationRule.target_org_unit),
        selectinload(ClassificationRule.target_user),
        selectinload(ClassificationRule.domain),
        selectinload(ClassificationRule.activity),
        selectinload(ClassificationRule.workflow_template),
    )


async def _validate_simulation_context(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    payload: ClassificationSimulationRequest,
) -> None:
    if payload.document_category_id:
        result = await db.execute(
            select(DocumentCategory.id).where(
                DocumentCategory.id == payload.document_category_id,
                DocumentCategory.tenant_id == tenant_id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=400, detail="Categorie documentaire invalide."
            )

    if payload.source_org_unit_id:
        result = await db.execute(
            select(OrgUnit.id).where(
                OrgUnit.id == payload.source_org_unit_id,
                OrgUnit.tenant_id == tenant_id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Unite source invalide.")

    if payload.source_user_id:
        result = await db.execute(
            select(User.id).where(
                User.id == payload.source_user_id,
                User.tenant_id == tenant_id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Utilisateur source invalide.")


@router.get("/domains", response_model=list[ClassificationDomainRead])
async def list_classification_domains(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_rules", "read")
    stmt = select(ClassificationDomain).where(
        ClassificationDomain.tenant_id == current_user.tenant_id
    )
    if not include_inactive:
        stmt = stmt.where(ClassificationDomain.is_active.is_(True))
    stmt = stmt.order_by(ClassificationDomain.name.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "/domains",
    response_model=ClassificationDomainRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_classification_domain(
    payload: ClassificationDomainCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_rules", "create")
    code = _normalize_code(payload.code)
    await _ensure_domain_code_unique(
        db, tenant_id=current_user.tenant_id, code=code
    )
    domain = ClassificationDomain(
        tenant_id=current_user.tenant_id,
        code=code,
        name=payload.name,
        description=payload.description,
        is_active=payload.is_active,
    )
    db.add(domain)
    await db.commit()
    await db.refresh(domain)
    return domain


@router.patch("/domains/{domain_id}", response_model=ClassificationDomainRead)
async def update_classification_domain(
    domain_id: UUID,
    payload: ClassificationDomainUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_rules", "update")
    domain = await _get_domain_or_404(
        db, tenant_id=current_user.tenant_id, domain_id=domain_id
    )
    update_data = payload.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"]:
        update_data["code"] = _normalize_code(update_data["code"])
        await _ensure_domain_code_unique(
            db,
            tenant_id=current_user.tenant_id,
            code=update_data["code"],
            exclude_domain_id=domain.id,
        )
    for field, value in update_data.items():
        setattr(domain, field, value)
    await db.commit()
    await db.refresh(domain)
    return domain


@router.delete("/domains/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_classification_domain(
    domain_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_rules", "delete")
    domain = await _get_domain_or_404(
        db, tenant_id=current_user.tenant_id, domain_id=domain_id
    )
    domain.is_active = False
    await db.commit()
    return None


@router.get("/activities", response_model=list[ClassificationActivityRead])
async def list_classification_activities(
    domain_id: UUID | None = None,
    include_inactive: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_rules", "read")
    stmt = (
        select(ClassificationActivity)
        .options(selectinload(ClassificationActivity.domain))
        .where(ClassificationActivity.tenant_id == current_user.tenant_id)
    )
    if domain_id:
        stmt = stmt.where(ClassificationActivity.domain_id == domain_id)
    if not include_inactive:
        stmt = stmt.where(ClassificationActivity.is_active.is_(True))
    stmt = stmt.order_by(ClassificationActivity.name.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "/activities",
    response_model=ClassificationActivityRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_classification_activity(
    payload: ClassificationActivityCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_rules", "create")
    await _get_domain_or_404(
        db, tenant_id=current_user.tenant_id, domain_id=payload.domain_id
    )
    code = _normalize_code(payload.code)
    await _ensure_activity_code_unique(
        db,
        tenant_id=current_user.tenant_id,
        domain_id=payload.domain_id,
        code=code,
    )
    activity = ClassificationActivity(
        tenant_id=current_user.tenant_id,
        domain_id=payload.domain_id,
        code=code,
        name=payload.name,
        description=payload.description,
        is_active=payload.is_active,
    )
    db.add(activity)
    await db.commit()
    result = await db.execute(
        select(ClassificationActivity)
        .options(selectinload(ClassificationActivity.domain))
        .where(ClassificationActivity.id == activity.id)
    )
    return result.scalar_one()


@router.patch("/activities/{activity_id}", response_model=ClassificationActivityRead)
async def update_classification_activity(
    activity_id: UUID,
    payload: ClassificationActivityUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_rules", "update")
    activity = await _get_activity_or_404(
        db, tenant_id=current_user.tenant_id, activity_id=activity_id
    )
    update_data = payload.model_dump(exclude_unset=True)
    if "domain_id" in update_data and update_data["domain_id"]:
        await _get_domain_or_404(
            db, tenant_id=current_user.tenant_id, domain_id=update_data["domain_id"]
        )
    if "code" in update_data and update_data["code"]:
        update_data["code"] = _normalize_code(update_data["code"])
    if "domain_id" in update_data or "code" in update_data:
        await _ensure_activity_code_unique(
            db,
            tenant_id=current_user.tenant_id,
            domain_id=update_data.get("domain_id", activity.domain_id),
            code=update_data.get("code", activity.code),
            exclude_activity_id=activity.id,
        )
    for field, value in update_data.items():
        setattr(activity, field, value)
    await db.commit()
    result = await db.execute(
        select(ClassificationActivity)
        .options(selectinload(ClassificationActivity.domain))
        .where(ClassificationActivity.id == activity.id)
    )
    return result.scalar_one()


@router.delete("/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_classification_activity(
    activity_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_rules", "delete")
    activity = await _get_activity_or_404(
        db, tenant_id=current_user.tenant_id, activity_id=activity_id
    )
    activity.is_active = False
    await db.commit()
    return None


@router.get("/rules", response_model=list[ClassificationRuleRead])
async def list_classification_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_rules", "read")
    result = await db.execute(
        _classification_rule_query()
        .where(ClassificationRule.tenant_id == current_user.tenant_id)
        .order_by(
            ClassificationRule.priority.asc(), ClassificationRule.created_at.asc()
        )
    )
    return result.scalars().all()


@router.get("/rules/{rule_id}", response_model=ClassificationRuleRead)
async def get_classification_rule(
    rule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_rules", "read")
    result = await db.execute(
        _classification_rule_query().where(
            ClassificationRule.id == rule_id,
            ClassificationRule.tenant_id == current_user.tenant_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Regle de classement introuvable.")
    return rule


@router.post(
    "/rules",
    response_model=ClassificationRuleRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_classification_rule(
    payload: ClassificationRuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_rules", "create")
    code = _normalize_code(payload.code)
    await _ensure_rule_code_unique(db, tenant_id=current_user.tenant_id, code=code)
    await _validate_rule_payload(
        db,
        tenant_id=current_user.tenant_id,
        payload=payload,
    )
    rule = ClassificationRule(
        tenant_id=current_user.tenant_id,
        code=code,
        **_rule_column_values(payload, exclude={"code"}),
    )
    db.add(rule)
    await db.commit()
    result = await db.execute(
        _classification_rule_query().where(ClassificationRule.id == rule.id)
    )
    return result.scalar_one()


@router.patch("/rules/{rule_id}", response_model=ClassificationRuleRead)
async def update_classification_rule(
    rule_id: UUID,
    payload: ClassificationRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_rules", "update")
    result = await db.execute(
        _classification_rule_query().where(
            ClassificationRule.id == rule_id,
            ClassificationRule.tenant_id == current_user.tenant_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Regle de classement introuvable.")
    update_data = _rule_column_values(payload, exclude_unset=True)
    if "code" in update_data and update_data["code"]:
        update_data["code"] = _normalize_code(update_data["code"])
        await _ensure_rule_code_unique(
            db,
            tenant_id=current_user.tenant_id,
            code=update_data["code"],
            exclude_rule_id=rule.id,
        )
    await _validate_rule_payload(
        db,
        tenant_id=current_user.tenant_id,
        payload=payload,
        current_rule=rule,
    )
    for field, value in update_data.items():
        setattr(rule, field, value)
    await db.commit()
    result = await db.execute(
        _classification_rule_query().where(ClassificationRule.id == rule.id)
    )
    return result.scalar_one()


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_classification_rule(
    rule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_rules", "delete")
    result = await db.execute(
        select(ClassificationRule).where(
            ClassificationRule.id == rule_id,
            ClassificationRule.tenant_id == current_user.tenant_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Regle de classement introuvable.")
    await db.delete(rule)
    await db.commit()
    return None


@router.post("/simulate", response_model=ClassificationSimulationResponse)
async def simulate_classification(
    payload: ClassificationSimulationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await authorize_or_403(current_user, "classification_rules", "read")
    await _validate_simulation_context(
        db, tenant_id=current_user.tenant_id, payload=payload
    )

    engine = ClassificationRuleEngine(db)
    resolution = await engine.simulate(
        tenant_id=current_user.tenant_id,
        document_category_id=payload.document_category_id,
        source_scope=payload.source_scope,
        source_org_unit_id=payload.source_org_unit_id,
        source_user_id=payload.source_user_id,
        filename=payload.filename,
        mime_type=payload.mime_type,
    )

    return ClassificationSimulationResponse(
        # Pydantic v2 ne déballe pas automatiquement un Enum (même str-subclass)
        # vers sa valeur quand le champ est déclaré en Literal[...] → on passe
        # explicitement .value pour éviter une 422 sur la sérialisation.
        status=resolution.status.value,
        rule_id=resolution.rule.id if resolution.rule else None,
        rule_code=resolution.rule.code if resolution.rule else None,
        rule_name=resolution.rule.name if resolution.rule else None,
        rule_priority=resolution.rule.priority if resolution.rule else None,
        message=resolution.message,
        logical_space_path=resolution.logical_space_path,
        classification_scope=resolution.target_scope,
        classification_target_org_unit_id=(
            resolution.target_org_unit.id if resolution.target_org_unit else None
        ),
        classification_target_org_unit_name=(
            resolution.target_org_unit.name if resolution.target_org_unit else None
        ),
        classification_target_user_id=(
            resolution.target_user.id if resolution.target_user else None
        ),
        classification_target_user_name=(
            resolution.target_user.full_name if resolution.target_user else None
        ),
        classification_domain_id=resolution.domain.id if resolution.domain else None,
        classification_domain_name=(
            resolution.domain.name if resolution.domain else None
        ),
        classification_activity_id=(
            resolution.activity.id if resolution.activity else None
        ),
        classification_activity_name=(
            resolution.activity.name if resolution.activity else None
        ),
        classification_year=resolution.classification_year,
        diagnostics=[
            {
                "rule_id": diagnostic.rule.id,
                "rule_code": diagnostic.rule.code,
                "rule_name": diagnostic.rule.name,
                "rule_priority": diagnostic.rule.priority,
                "matched": diagnostic.matched,
                "checks": [
                    {
                        "key": check.key,
                        "label": check.label,
                        "passed": check.passed,
                        "detail": check.detail,
                    }
                    for check in diagnostic.checks
                ],
            }
            for diagnostic in resolution.diagnostics
        ],
        stages=[
            {
                "key": stage.key,
                "label": stage.label,
                "summary": stage.summary,
                "remaining_rules": [
                    {
                        "rule_id": item.rule.id,
                        "rule_code": item.rule.code,
                        "rule_name": item.rule.name,
                        "rule_priority": item.rule.priority,
                        "detail": item.detail,
                    }
                    for item in stage.remaining_rules
                ],
                "removed_rules": [
                    {
                        "rule_id": item.rule.id,
                        "rule_code": item.rule.code,
                        "rule_name": item.rule.name,
                        "rule_priority": item.rule.priority,
                        "detail": item.detail,
                    }
                    for item in stage.removed_rules
                ],
            }
            for stage in resolution.stages
        ],
    )
