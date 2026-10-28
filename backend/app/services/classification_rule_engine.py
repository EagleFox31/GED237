import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.classification_activity import ClassificationActivity
from app.models.classification_domain import ClassificationDomain
from app.models.classification_rule import ClassificationRule
from app.models.document import Document
from app.models.org_unit import OrgUnit
from app.models.org_unit import OrgUnitClosure
from app.models.user import User
from app.services.space_path_builder import SpacePathBuilder


class ClassificationStatus(str, Enum):
    classified = "classified"
    needs_review = "needs_review"
    no_rule = "no_rule"
    rejected = "rejected"
    pending = "pending"

@dataclass
class ClassificationResolution:
    status: ClassificationStatus
    message: str
    rule: Optional[ClassificationRule] = None
    target_scope: Optional[str] = None
    target_org_unit: Optional[OrgUnit] = None
    target_user: Optional[User] = None
    domain: Optional[ClassificationDomain] = None
    activity: Optional[ClassificationActivity] = None
    classification_year: Optional[int] = None
    logical_space_path: Optional[str] = None
    diagnostics: list["RuleDiagnostic"] = field(default_factory=list)
    stages: list["SimulationStage"] = field(default_factory=list)


@dataclass
class RuleCheck:
    key: str
    label: str
    passed: bool
    detail: str


@dataclass
class RuleDiagnostic:
    rule: ClassificationRule
    matched: bool
    checks: list[RuleCheck]


@dataclass
class SimulationStageRule:
    rule: ClassificationRule
    detail: str


@dataclass
class SimulationStage:
    key: str
    label: str
    summary: str
    remaining_rules: list[SimulationStageRule] = field(default_factory=list)
    removed_rules: list[SimulationStageRule] = field(default_factory=list)


class ClassificationRuleEngine:
    """Resolve one best classification rule and compute the logical destination."""

    def __init__(self, db: AsyncSession, current_year: Optional[int] = None):
        self.db = db
        self.current_year = current_year or datetime.now().year
        self.path_builder = SpacePathBuilder(db)

    async def simulate(
        self,
        *,
        tenant_id: UUID,
        document_category_id: Optional[UUID],
        source_scope: str,
        source_org_unit_id: Optional[UUID],
        source_user_id: Optional[UUID],
        filename: str,
        mime_type: Optional[str],
    ) -> ClassificationResolution:
        rules = await self._load_rules(tenant_id)
        matching_rules = []
        diagnostics: list[RuleDiagnostic] = []
        for rule in rules:
            diagnostic = await self._evaluate_rule(
                rule=rule,
                document_category_id=document_category_id,
                source_scope=source_scope,
                source_org_unit_id=source_org_unit_id,
                source_user_id=source_user_id,
                filename=filename,
                mime_type=mime_type,
            )
            diagnostics.append(diagnostic)
            if diagnostic.matched:
                matching_rules.append(rule)
        stages = self._build_simulation_stages(
            rules=rules,
            diagnostics=diagnostics,
            matching_rules=matching_rules,
        )

        if not matching_rules:
            current_year = self._resolve_year(filename=filename, strategy="current")
            pending_path = await self.path_builder.build_pending_full_path(
                tenant_id=tenant_id,
                target_org_unit_id=source_org_unit_id,
                target_user_id=source_user_id if source_scope == "person" else None,
                classification_year=current_year,
            )
            return ClassificationResolution(
                status=ClassificationStatus.no_rule,
                message="Aucune regle de classement n'a correspondu.",
                classification_year=current_year,
                logical_space_path=pending_path,
                diagnostics=diagnostics,
                stages=stages,
            )

        first = matching_rules[0]
        if len(matching_rules) > 1 and matching_rules[1].priority == first.priority:
            review_year = self._resolve_year(
                filename=filename,
                strategy=first.year_strategy,
                fixed_year=first.fixed_year,
            )
            review_path = await self.path_builder.build_pending_full_path(
                tenant_id=tenant_id,
                target_org_unit_id=source_org_unit_id,
                target_user_id=source_user_id if source_scope == "person" else None,
                classification_year=review_year,
                pending_label="A revoir",
            )
            return ClassificationResolution(
                status=ClassificationStatus.needs_review,
                message="Plusieurs regles de meme priorite correspondent. Revue manuelle requise.",
                classification_year=review_year,
                logical_space_path=review_path,
                diagnostics=diagnostics,
                stages=stages,
            )

        target_org_unit, target_user = await self._resolve_target(
            tenant_id=tenant_id,
            rule=first,
            source_org_unit_id=source_org_unit_id,
            source_user_id=source_user_id,
        )
        classification_year = self._resolve_year(
            filename=filename,
            strategy=first.year_strategy,
            fixed_year=first.fixed_year,
        )
        logical_space_path = await self.path_builder.build_full_path(
            tenant_id=tenant_id,
            target_org_unit_id=target_org_unit.id if target_org_unit else None,
            target_user_id=target_user.id if target_user else None,
            domain_name=first.domain.name if first.domain else None,
            activity_name=first.activity.name if first.activity else None,
            classification_year=classification_year,
        )

        if not logical_space_path:
            return ClassificationResolution(
                status=ClassificationStatus.rejected,
                message="La regle correspondante ne permet pas de construire un espace logique valide.",
                rule=first,
                diagnostics=diagnostics,
                stages=stages,
            )

        return ClassificationResolution(
            status=ClassificationStatus.classified,
            message=f"Regle '{first.name}' appliquee avec succes.",
            rule=first,
            target_scope=first.target_scope,
            target_org_unit=target_org_unit,
            target_user=target_user,
            domain=first.domain,
            activity=first.activity,
            classification_year=classification_year,
            logical_space_path=logical_space_path,
            diagnostics=diagnostics,
            stages=stages,
        )

    async def classify_document(
        self,
        *,
        document: Document,
        source_scope: str,
        source_user_id: Optional[UUID],
        filename: str,
        mime_type: Optional[str],
    ) -> ClassificationResolution:
        resolution = await self.simulate(
            tenant_id=document.tenant_id,
            document_category_id=document.document_category_id,
            source_scope=source_scope,
            source_org_unit_id=document.org_unit_id,
            source_user_id=source_user_id,
            filename=filename,
            mime_type=mime_type,
        )

        self._reset_document_classification(document)

        if resolution.status == ClassificationStatus.classified:
            document.classification_domain_id = (
                resolution.domain.id if resolution.domain else None
            )
            document.classification_activity_id = (
                resolution.activity.id if resolution.activity else None
            )
            document.classification_year = resolution.classification_year
            document.classification_scope = resolution.target_scope or "service"
            document.classification_target_org_unit_id = (
                resolution.target_org_unit.id if resolution.target_org_unit else None
            )
            document.classification_target_user_id = (
                resolution.target_user.id if resolution.target_user else None
            )
            document.classification_status = ClassificationStatus.classified.value
            document.logical_space_path = resolution.logical_space_path
        elif resolution.status == ClassificationStatus.needs_review:
            document.classification_status = ClassificationStatus.needs_review.value
            document.classification_year = resolution.classification_year
            document.logical_space_path = resolution.logical_space_path
        elif resolution.status == ClassificationStatus.no_rule:
            document.classification_status = ClassificationStatus.pending.value
            document.classification_year = resolution.classification_year
            document.logical_space_path = resolution.logical_space_path
        else:
            document.classification_status = ClassificationStatus.rejected.value
            document.logical_space_path = resolution.logical_space_path

        return resolution

    async def _load_rules(self, tenant_id: UUID) -> list[ClassificationRule]:
        result = await self.db.execute(
            select(ClassificationRule)
            .options(
                selectinload(ClassificationRule.domain),
                selectinload(ClassificationRule.activity),
            )
            .where(
                ClassificationRule.tenant_id == tenant_id,
                ClassificationRule.is_active,
            )
            .order_by(
                ClassificationRule.priority.asc(), ClassificationRule.created_at.asc()
            )
        )
        return list(result.scalars().all())

    async def _evaluate_rule(
        self,
        *,
        rule: ClassificationRule,
        document_category_id: Optional[UUID],
        source_scope: str,
        source_org_unit_id: Optional[UUID],
        source_user_id: Optional[UUID],
        filename: str,
        mime_type: Optional[str],
    ) -> RuleDiagnostic:
        checks: list[RuleCheck] = []

        category_ok = self._matches_id_constraint(
            document_category_id,
            rule.document_category_ids,
            rule.document_category_id,
        )
        checks.append(
            RuleCheck(
                key="document_category",
                label="Type de document",
                passed=category_ok,
                detail="Le type correspond." if category_ok else "Le type du document ne correspond pas a la regle.",
            )
        )

        origin_ok, origin_detail = await self._evaluate_org_unit_constraint(
            source_scope=source_scope,
            source_org_unit_id=source_org_unit_id,
            source_org_unit_ids=rule.source_org_unit_ids,
            source_org_unit_excluded_ids=getattr(
                rule, "source_org_unit_excluded_ids", None
            ),
            single_source_org_unit_id=rule.source_org_unit_id,
            rule_source_scope=rule.source_scope,
        )
        checks.append(
            RuleCheck(
                key="source_origin",
                label="Origine concernee",
                passed=origin_ok,
                detail=origin_detail,
            )
        )

        source_user_ok = self._matches_id_constraint(
            source_user_id,
            rule.source_user_ids,
            rule.source_user_id,
        )
        checks.append(
            RuleCheck(
                key="source_user",
                label="Agent emetteur",
                passed=source_user_ok,
                detail="L'agent emetteur correspond."
                if source_user_ok
                else "L'agent emetteur ne correspond pas a la regle.",
            )
        )

        filename_ok = True
        if rule.filename_pattern:
            filename_ok = self._matches_filename_pattern(filename, rule.filename_pattern)
        checks.append(
            RuleCheck(
                key="filename_pattern",
                label="Mots-cles du nom",
                passed=filename_ok,
                detail="Au moins un mot-cle a ete trouve dans le nom du fichier."
                if filename_ok
                else "Aucun des mots-cles de la regle n'a ete trouve dans le nom du fichier.",
            )
        )

        mime_ok = True
        if rule.mime_type_pattern:
            mime_ok = self._matches_mime_type(mime_type, rule.mime_type_pattern)
        checks.append(
            RuleCheck(
                key="mime_type",
                label="Format du fichier",
                passed=mime_ok,
                detail="Le format du fichier correspond."
                if mime_ok
                else "Le format du fichier ne fait pas partie des formats acceptes par la regle.",
            )
        )

        return RuleDiagnostic(
            rule=rule,
            matched=all(check.passed for check in checks),
            checks=checks,
        )

    def _build_simulation_stages(
        self,
        *,
        rules: list[ClassificationRule],
        diagnostics: list[RuleDiagnostic],
        matching_rules: list[ClassificationRule],
    ) -> list[SimulationStage]:
        diagnostics_by_rule_id = {str(diagnostic.rule.id): diagnostic for diagnostic in diagnostics}
        ordered_checks = [
            ("document_category", "Filtre sur le type de document"),
            ("source_origin", "Filtre sur l'origine concernee"),
            ("source_user", "Filtre sur l'agent emetteur"),
            ("filename_pattern", "Filtre sur les mots-cles du nom"),
            ("mime_type", "Filtre sur le format du fichier"),
        ]

        stages: list[SimulationStage] = [
            SimulationStage(
                key="rules_loaded",
                label="Règles actives chargées",
                summary=f"{len(rules)} règle(s) active(s) examinée(s) au départ.",
                remaining_rules=[
                    SimulationStageRule(
                        rule=rule,
                        detail=f"Priorité {rule.priority}.",
                    )
                    for rule in rules
                ],
            )
        ]

        remaining_ids = {str(rule.id) for rule in rules}
        for check_key, check_label in ordered_checks:
            next_remaining_ids: set[str] = set()
            remaining_rules: list[SimulationStageRule] = []
            removed_rules: list[SimulationStageRule] = []

            for rule in rules:
                rule_id = str(rule.id)
                if rule_id not in remaining_ids:
                    continue
                diagnostic = diagnostics_by_rule_id.get(rule_id)
                if not diagnostic:
                    continue
                rule_check = next(
                    (check for check in diagnostic.checks if check.key == check_key), None
                )
                if rule_check and rule_check.passed:
                    next_remaining_ids.add(rule_id)
                    remaining_rules.append(
                        SimulationStageRule(rule=rule, detail=rule_check.detail)
                    )
                elif rule_check:
                    removed_rules.append(
                        SimulationStageRule(rule=rule, detail=rule_check.detail)
                    )

            stages.append(
                SimulationStage(
                    key=check_key,
                    label=check_label,
                    summary=(
                        f"{len(next_remaining_ids)} règle(s) restent, "
                        f"{len(removed_rules)} écartée(s) à cette étape."
                    ),
                    remaining_rules=remaining_rules,
                    removed_rules=removed_rules,
                )
            )
            remaining_ids = next_remaining_ids

        if not matching_rules:
            stages.append(
                SimulationStage(
                    key="final_resolution",
                    label="Résultat final",
                    summary="Aucune règle n'a survécu à tous les filtres.",
                )
            )
            return stages

        kept_rules = [rule for rule in rules if str(rule.id) in {str(item.id) for item in matching_rules}]
        first = matching_rules[0]
        tie_rules = [
            rule for rule in matching_rules if rule.priority == first.priority
        ]

        if len(tie_rules) > 1:
            stages.append(
                SimulationStage(
                    key="final_resolution",
                    label="Arbitrage final",
                    summary="Plusieurs règles de même priorité restent en concurrence.",
                    remaining_rules=[
                        SimulationStageRule(
                            rule=rule,
                            detail="Cette règle arrive en tête avec la même priorité qu'une autre.",
                        )
                        for rule in tie_rules
                    ],
                    removed_rules=[
                        SimulationStageRule(
                            rule=rule,
                            detail="Cette règle a passé les filtres mais n'est pas en tête de priorité.",
                        )
                        for rule in kept_rules
                        if rule not in tie_rules
                    ],
                )
            )
            return stages

        stages.append(
            SimulationStage(
                key="final_resolution",
                label="Règle retenue",
                summary=f"La règle « {first.name} » est retenue après comparaison des priorités.",
                remaining_rules=[
                    SimulationStageRule(
                        rule=first,
                        detail="Règle gagnante retenue pour calculer la destination finale.",
                    )
                ],
                removed_rules=[
                    SimulationStageRule(
                        rule=rule,
                        detail="Cette règle a passé les filtres mais a été dépassée par une priorité plus forte.",
                    )
                    for rule in kept_rules
                    if str(rule.id) != str(first.id)
                ],
            )
        )
        return stages

    @staticmethod
    def _matches_id_constraint(
        target_id: Optional[UUID],
        multi_ids: Optional[list],
        single_id: Optional[UUID],
    ) -> bool:
        # Sémantique OU : la liste multi prime sur le single FK legacy.
        # Liste non vide → match si target ∈ liste (autres orphelins ignorés).
        # Sinon fallback sur le single FK historique.
        # Ni l'un ni l'autre → contrainte absente, match.
        if multi_ids:
            allowed = {str(item) for item in multi_ids if item}
            if not allowed:
                return True
            return target_id is not None and str(target_id) in allowed
        if single_id is not None:
            return target_id is not None and str(target_id) == str(single_id)
        return True

    @staticmethod
    def _normalize(text: str) -> str:
        # NFD + strip Mn = drop combining diacritics → "marché" → "marche"
        return "".join(
            c
            for c in unicodedata.normalize("NFD", text.lower())
            if unicodedata.category(c) != "Mn"
        )

    @staticmethod
    def _matches_filename_pattern(filename: str, pattern: str) -> bool:
        # Sémantique OU : la règle matche si AU MOINS UN mot-clé est trouvé.
        # Comparaison insensible à la casse ET aux accents (cf. méthode _normalize).
        normalized_name = ClassificationRuleEngine._normalize(filename)
        raw_tokens = re.split(r"[;,|]+", pattern)
        tokens = [
            ClassificationRuleEngine._normalize(token.strip())
            for token in raw_tokens
            if token.strip()
        ]
        if not tokens:
            return True
        return any(token in normalized_name for token in tokens)

    async def _evaluate_org_unit_constraint(
        self,
        *,
        source_scope: str,
        source_org_unit_id: Optional[UUID],
        source_org_unit_ids: Optional[list],
        source_org_unit_excluded_ids: Optional[list],
        single_source_org_unit_id: Optional[UUID],
        rule_source_scope: str,
    ) -> tuple[bool, str]:
        include_ids = [str(item) for item in (source_org_unit_ids or []) if item]
        exclude_ids = [
            str(item) for item in (source_org_unit_excluded_ids or []) if item
        ]

        if include_ids:
            if source_org_unit_id is None:
                return False, "Aucune unite d'origine n'a ete fournie alors que la regle cible un perimetre precis."
            ancestor_ids = await self._ancestor_ids_for_org_unit(source_org_unit_id)
            matched_include_ids = ancestor_ids.intersection(include_ids)
            blocked_exclude_ids = ancestor_ids.intersection(exclude_ids)
            source_org_unit = await self._load_org_unit(source_org_unit_id, None)
            source_name = source_org_unit.name if source_org_unit else str(source_org_unit_id)
            include_names = await self._org_unit_names(include_ids)
            exclude_names = await self._org_unit_names(exclude_ids)

            if not matched_include_ids:
                return (
                    False,
                    f"L'unite testee « {source_name} » n'appartient pas aux origines concernees: {', '.join(include_names) or 'aucune'}."
                )
            if blocked_exclude_ids:
                return (
                    False,
                    f"L'unite testee « {source_name} » entre dans une exception de la regle: {', '.join(exclude_names) or 'exception non resolue'}."
                )
            matched_names = await self._org_unit_names(list(matched_include_ids))
            return (
                True,
                f"L'unite testee « {source_name} » appartient bien au perimetre couvre par: {', '.join(matched_names) or 'la regle'}."
            )

        if rule_source_scope != source_scope:
            return (
                False,
                f"Le niveau d'origine teste est « {source_scope} », alors que la regle attend « {rule_source_scope} »."
            )

        if self._matches_id_constraint(
            source_org_unit_id,
            None,
            single_source_org_unit_id,
        ):
            return True, "Le niveau d'origine et l'unite source legacy correspondent."

        if single_source_org_unit_id is not None:
            source_org_unit = (
                await self._load_org_unit(source_org_unit_id, None)
                if source_org_unit_id
                else None
            )
            expected_org_unit = await self._load_org_unit(single_source_org_unit_id, None)
            return (
                False,
                f"L'unite testee « {source_org_unit.name if source_org_unit else source_org_unit_id} » ne correspond pas a l'unite attendue « {expected_org_unit.name if expected_org_unit else single_source_org_unit_id} »."
            )
        return True, "Aucune contrainte d'unite source supplementaire sur cette regle."

    async def _ancestor_ids_for_org_unit(self, org_unit_id: UUID) -> set[str]:
        result = await self.db.execute(
            select(OrgUnitClosure.ancestor_id).where(
                OrgUnitClosure.descendant_id == org_unit_id
            )
        )
        ancestor_ids = {str(row[0]) for row in result.all() if row[0]}
        ancestor_ids.add(str(org_unit_id))
        return ancestor_ids

    async def _org_unit_names(self, org_unit_ids: list[str]) -> list[str]:
        if not org_unit_ids:
            return []
        result = await self.db.execute(
            select(OrgUnit.id, OrgUnit.name).where(OrgUnit.id.in_(org_unit_ids))
        )
        names_by_id = {str(row[0]): row[1] for row in result.all()}
        return [names_by_id.get(org_unit_id, org_unit_id) for org_unit_id in org_unit_ids]

    @staticmethod
    def _matches_mime_type(mime_type: Optional[str], pattern: str) -> bool:
        if not mime_type:
            return False
        tokens = [token.strip().lower() for token in re.split(r"[;,|]+", pattern) if token.strip()]
        if not tokens:
            return True

        aliases = {
            "pdf": ["application/pdf"],
            "doc": ["application/msword"],
            "docx": [
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ],
            "xls": ["application/vnd.ms-excel"],
            "xlsx": [
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ],
            "ppt": ["application/vnd.ms-powerpoint"],
            "pptx": [
                "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            ],
            "odt": ["application/vnd.oasis.opendocument.text"],
            "ods": ["application/vnd.oasis.opendocument.spreadsheet"],
            "odp": ["application/vnd.oasis.opendocument.presentation"],
            "txt": ["text/plain"],
            "csv": ["text/csv"],
            "rtf": ["application/rtf", "text/rtf"],
            "png": ["image/png"],
            "jpg": ["image/jpeg"],
            "jpeg": ["image/jpeg"],
            "tiff": ["image/tiff"],
            "tif": ["image/tiff"],
            "bmp": ["image/bmp"],
            "gif": ["image/gif"],
            "webp": ["image/webp"],
        }

        mime_value = mime_type.lower()
        for token in tokens:
            candidates = aliases.get(token, [token])
            if any(candidate in mime_value for candidate in candidates):
                return True
        return False

    def _reset_document_classification(self, document: Document) -> None:
        document.classification_domain_id = None
        document.classification_activity_id = None
        document.classification_year = None
        document.classification_scope = "service"
        document.classification_target_org_unit_id = None
        document.classification_target_user_id = None
        document.logical_space_path = None

    async def _resolve_target(
        self,
        *,
        tenant_id: UUID,
        rule: ClassificationRule,
        source_org_unit_id: Optional[UUID],
        source_user_id: Optional[UUID],
    ) -> tuple[Optional[OrgUnit], Optional[User]]:
        target_org_unit: Optional[OrgUnit] = None
        target_user: Optional[User] = None

        if rule.target_scope == "person":
            target_user_id = rule.target_user_id or source_user_id
            if target_user_id:
                target_user = await self._load_user(target_user_id, tenant_id)
                # Important: resolve the user's org unit to preserve hierarchical paths
                if target_user and target_user.org_unit_id:
                    target_org_unit = await self._load_org_unit(target_user.org_unit_id, tenant_id)
        else:
            if rule.target_org_unit_id:
                target_org_unit = await self._load_org_unit(
                    rule.target_org_unit_id, tenant_id
                )
            elif rule.target_scope == "service":
                if source_org_unit_id:
                    target_org_unit = await self._load_org_unit(
                        source_org_unit_id, tenant_id
                    )
            elif rule.target_scope in {"subdirectorate", "directorate"}:
                target_org_unit = await self._load_ancestor_for_scope(
                    source_org_unit_id=source_org_unit_id,
                    tenant_id=tenant_id,
                    target_scope=rule.target_scope,
                )

        return target_org_unit, target_user

    async def _load_ancestor_for_scope(
        self,
        *,
        source_org_unit_id: Optional[UUID],
        tenant_id: UUID,
        target_scope: str,
    ) -> Optional[OrgUnit]:
        if source_org_unit_id is None:
            return None

        target_level = self._target_level_for_scope(target_scope)
        if target_level is None:
            return None

        result = await self.db.execute(
            select(OrgUnit)
            .join(OrgUnitClosure, OrgUnitClosure.ancestor_id == OrgUnit.id)
            .where(
                OrgUnitClosure.descendant_id == source_org_unit_id,
                OrgUnit.tenant_id == tenant_id,
                OrgUnit.level == target_level,
            )
            .order_by(OrgUnitClosure.depth.asc())
        )
        return result.scalars().first()

    @staticmethod
    def _target_level_for_scope(target_scope: str) -> Optional[int]:
        if target_scope == "directorate":
            return 2
        if target_scope == "subdirectorate":
            return 3
        if target_scope == "service":
            return 4
        return None


    async def _load_org_unit(
        self, org_unit_id: UUID, tenant_id: Optional[UUID]
    ) -> Optional[OrgUnit]:
        stmt = select(OrgUnit).where(OrgUnit.id == org_unit_id)
        if tenant_id is not None:
            stmt = stmt.where(OrgUnit.tenant_id == tenant_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _load_user(self, user_id: UUID, tenant_id: UUID) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(
                User.id == user_id,
                User.tenant_id == tenant_id,
            )
        )
        return result.scalar_one_or_none()

    def _resolve_year(
        self,
        *,
        filename: str,
        strategy: str,
        fixed_year: Optional[int] = None,
    ) -> int:
        if strategy == "fixed" and fixed_year:
            return fixed_year
        if strategy == "from_filename":
            match = re.search(r"\b(19|20)\d{2}\b", filename)
            if match:
                parsed_year = int(match.group(0))
                # Filtrer les années aberrantes
                if 1900 <= parsed_year <= self.current_year + 1:
                    return parsed_year
        return self.current_year
