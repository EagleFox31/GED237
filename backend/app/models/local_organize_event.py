"""Local organize event model.

Trace anonyme de chaque rangement local (mode « Ranger sur mon poste »
de l'assistant d'import). On n'enregistre QUE des compteurs : aucun
nom de fichier, aucun contenu, aucune arborescence détaillée. Cela
respecte la promesse du mode local (« rien ne sort de votre poste »)
tout en permettant à l'admin tenant de mesurer l'usage de la
fonctionnalité dans /reports.
"""
from sqlalchemy import Column, ForeignKey, Index, Integer, String, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.base import UUIDMixin


class LocalOrganizeEvent(Base, UUIDMixin):
    """Compteur anonyme d'un rangement local côté navigateur."""

    __tablename__ = "local_organize_events"

    tenant_id = Column(UUID(as_uuid=True), index=True)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    # Compteurs purs — pas de PII, pas de noms de fichiers.
    file_count = Column(Integer, nullable=False, default=0)
    folders_created = Column(Integer, nullable=False, default=0)
    files_unranged = Column(Integer, nullable=False, default=0)

    # Métadonnées contextuelles courtes (énumérations connues).
    strategy = Column(String(32), nullable=False)  # by_type | by_year | by_type_year
    mode = Column(String(8), nullable=False)  # fsa | zip

    created_at = Column(TIMESTAMP, default=func.now(), nullable=False)

    __table_args__ = (
        Index(
            "idx_local_org_tenant_created",
            "tenant_id",
            "created_at",
            postgresql_ops={"created_at": "DESC"},
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<LocalOrganizeEvent(tenant={self.tenant_id}, files={self.file_count}, "
            f"folders={self.folders_created}, unranged={self.files_unranged})>"
        )
