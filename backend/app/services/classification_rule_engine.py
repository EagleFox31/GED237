import re
import unicodedata
from dataclasses import dataclass
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
        matching_rules = [
            rule
            for rule in rules
            if self._matches_rule(
                rule=rule,
                document_category_id=document_category_id,
                source_scope=source_scope,
                source_org_unit_id=source_org_unit_id,
                source_user_id=source_user_id,
                filename=filename,
                mime_type=mime_type,
            )
        ]

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

    def _matches_rule(
        self,
        *,
        rule: ClassificationRule,
        document_category_id: Optional[UUID],
        source_scope: str,
        source_org_unit_id: Optional[UUID],
        source_user_id: Optional[UUID],
        filename: str,
        mime_type: Optional[str],
    ) -> bool:
        if rule.source_scope != source_scope:
            return False
        if (
            rule.document_category_id
            and rule.document_category_id != document_category_id
        ):
            return False
        if rule.source_org_unit_id and rule.source_org_unit_id != source_org_unit_id:
            return False
        if rule.source_user_id and rule.source_user_id != source_user_id:
            return False
        if rule.filename_pattern and not self._matches_filename_pattern(
            filename, rule.filename_pattern
        ):
            return False
        if rule.mime_type_pattern and not self._matches_mime_type(
            mime_type, rule.mime_type_pattern
        ):
            return False
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

    @staticmethod
    def _matches_mime_type(mime_type: Optional[str], pattern: str) -> bool:
        if not mime_type:
            return False
        return pattern.lower() in mime_type.lower()

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
            # Option A stricte : si pas "person", on privilégie l'ID explicite de la règle.
            # On fallback sur source_org_unit_id uniquement si le scope de la règle est "service".
            if rule.target_org_unit_id:
                target_org_unit_id = rule.target_org_unit_id
            elif rule.target_scope == "service":
                target_org_unit_id = source_org_unit_id
            else:
                target_org_unit_id = None
            
            if target_org_unit_id:
                target_org_unit = await self._load_org_unit(target_org_unit_id, tenant_id)

        return target_org_unit, target_user


    async def _load_org_unit(self, org_unit_id: UUID, tenant_id: UUID) -> Optional[OrgUnit]:
        result = await self.db.execute(
            select(OrgUnit).where(
                OrgUnit.id == org_unit_id,
                OrgUnit.tenant_id == tenant_id,
            )
        )
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
