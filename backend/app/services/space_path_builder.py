from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.org_unit import OrgUnit, OrgUnitClosure
from app.models.user import User


class SpacePathBuilder:
    """
    Construit un chemin logique métier pour l'affichage ou le classement GED.

    Modèle cible :
      Organisation / Direction / Sous-direction / Service [/ Employé] / Domaine / Activité / Année

    Important :
    - Ce chemin est basé sur des libellés métier.
    - Si les noms d'organisation, de domaine ou d'activité changent, le chemin affiché peut changer.
    - Pour un stockage physique ou un audit historique, préférer un snapshot ou des identifiants stables.
    """

    PENDING_LABEL = "A classer"

    def __init__(self, db: AsyncSession):
        self.db = db
        self._org_chain_cache: dict[UUID, list[str]] = {}
        self._user_name_cache: dict[UUID, Optional[str]] = {}

    async def build_full_path(
        self,
        *,
        tenant_id: UUID,
        target_org_unit_id: Optional[UUID],
        target_user_id: Optional[UUID],
        domain_name: Optional[str],
        activity_name: Optional[str],
        classification_year: Optional[int],
    ) -> Optional[str]:
        segments: list[str] = []

        if target_org_unit_id:
            segments.extend(await self._org_chain(target_org_unit_id, tenant_id))

        if target_user_id:
            user_name = await self._user_name(target_user_id, tenant_id)
            self._append_if_present(segments, user_name)

        self._append_if_present(segments, domain_name)
        self._append_if_present(segments, activity_name)

        if classification_year is not None:
            segments.append(str(classification_year))

        return self._join_segments(segments)

    async def build_pending_full_path(
        self,
        *,
        tenant_id: UUID,
        target_org_unit_id: Optional[UUID],
        target_user_id: Optional[UUID],
        classification_year: Optional[int],
        pending_label: str = PENDING_LABEL,
    ) -> Optional[str]:
        segments: list[str] = []

        if target_org_unit_id:
            segments.extend(await self._org_chain(target_org_unit_id, tenant_id))

        if target_user_id:
            user_name = await self._user_name(target_user_id, tenant_id)
            self._append_if_present(segments, user_name)

        segments.append(pending_label)

        if classification_year is not None:
            segments.append(str(classification_year))

        return self._join_segments(segments)

    async def _org_chain(self, org_unit_id: UUID, tenant_id: UUID) -> list[str]:
        """
        Retourne la chaîne organisationnelle de la racine vers le nœud cible.

        La closure table est utilisée en priorité pour les hiérarchies déjà
        matérialisées. Certaines unités historiques ou créées sans alimentation
        de cette table peuvent toutefois ne pas y avoir de ligne. Dans ce cas,
        on reconstruit la chaîne via ``parent_id`` afin de ne jamais perdre la
        cible du chemin logique.
        """
        if org_unit_id in self._org_chain_cache:
            return self._org_chain_cache[org_unit_id]

        result = await self.db.execute(
            select(OrgUnit.id, OrgUnit.name)
            .join(
                OrgUnitClosure,
                OrgUnit.id == OrgUnitClosure.ancestor_id,
            )
            .where(
                OrgUnitClosure.descendant_id == org_unit_id,
                OrgUnit.tenant_id == tenant_id,
            )
            .order_by(OrgUnitClosure.depth.desc())
        )

        rows = result.all()
        closure_ids = [row.id for row in rows]
        chain = [
            cleaned
            for row in rows
            if (cleaned := self._clean_segment(row.name))
        ]

        # A valid closure chain must contain the target itself (depth = 0).
        # If it does not, rebuild from parent pointers. This covers legacy/test
        # data and, more importantly, units created while closure maintenance is
        # temporarily incomplete.
        if org_unit_id not in closure_ids:
            chain = await self._org_chain_from_parents(org_unit_id, tenant_id)

        self._org_chain_cache[org_unit_id] = chain
        return chain

    async def _org_chain_from_parents(
        self, org_unit_id: UUID, tenant_id: UUID
    ) -> list[str]:
        result = await self.db.execute(
            select(OrgUnit.id, OrgUnit.parent_id, OrgUnit.name).where(
                OrgUnit.tenant_id == tenant_id
            )
        )
        units = {
            row.id: (row.parent_id, row.name)
            for row in result.all()
        }

        chain: list[str] = []
        seen: set[UUID] = set()
        current_id: Optional[UUID] = org_unit_id

        while current_id is not None and current_id not in seen:
            current = units.get(current_id)
            if current is None:
                break

            seen.add(current_id)
            parent_id, name = current
            cleaned = self._clean_segment(name)
            if cleaned:
                chain.append(cleaned)
            current_id = parent_id

        chain.reverse()
        return chain

    async def _user_name(self, user_id: UUID, tenant_id: UUID) -> Optional[str]:
        if user_id in self._user_name_cache:
            return self._user_name_cache[user_id]

        result = await self.db.execute(
            select(User.full_name).where(
                User.id == user_id,
                User.tenant_id == tenant_id,
            )
        )

        user_name = self._clean_segment(result.scalar_one_or_none())
        self._user_name_cache[user_id] = user_name
        return user_name

    @classmethod
    def _append_if_present(cls, segments: list[str], value: Optional[str]) -> None:
        cleaned = cls._clean_segment(value)
        if cleaned:
            segments.append(cleaned)

    @staticmethod
    def _clean_segment(value: Optional[str]) -> Optional[str]:
        """
        Nettoie un segment de chemin :
        - supprime les espaces inutiles ;
        - compacte les espaces multiples ;
        - évite que '/' soit interprété comme un séparateur métier.
        """
        if not value:
            return None

        cleaned = " ".join(value.strip().split())
        cleaned = cleaned.replace("/", "-")

        return cleaned or None

    @staticmethod
    def _join_segments(segments: list[str]) -> Optional[str]:
        parts = [segment for segment in segments if segment]
        return " / ".join(parts) if parts else None

    @classmethod
    def build_from_label(
        cls,
        *,
        target_label: Optional[str],
        domain_name: Optional[str],
        activity_name: Optional[str],
        classification_year: Optional[int],
    ) -> Optional[str]:
        segments: list[str] = []

        cls._append_if_present(segments, target_label)
        cls._append_if_present(segments, domain_name)
        cls._append_if_present(segments, activity_name)

        if classification_year is not None:
            segments.append(str(classification_year))

        return cls._join_segments(segments)

    @classmethod
    def build_pending_from_label(
        cls,
        *,
        target_label: Optional[str],
        classification_year: Optional[int],
    ) -> Optional[str]:
        segments: list[str] = []

        cls._append_if_present(segments, target_label)
        segments.append(cls.PENDING_LABEL)

        if classification_year is not None:
            segments.append(str(classification_year))

        return cls._join_segments(segments)
