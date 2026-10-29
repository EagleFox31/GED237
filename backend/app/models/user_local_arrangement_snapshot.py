"""Dernier rangement local sauvegardé pour un utilisateur.

Contrairement aux lignes `local_organize_events` (compteurs anonymes pour
/reports), cette table conserve le manifeste détaillé du **dernier** rangement
« sur poste » : noms de fichiers finaux, chemins relatifs proposés, destination
choisie. Cela permet à l'utilisateur de retrouver où il a rangé ses fichiers
depuis un autre navigateur ou poste, tout en ne conservant qu'une seule
revision active par compte.

Les administrateurs système avec accès DB peuvent voir ces métadonnées ; le
choix produit assume cet échange volontaire contre la synchronisation du
catalogue « bibliothécaire ».
"""

from sqlalchemy import Column, ForeignKey, Index, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.core.database import Base


class UserLocalArrangementSnapshot(Base):
    """Une ligne par utilisateur : upsert à chaque nouveau rangement local."""

    __tablename__ = "user_local_arrangement_snapshots"

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tenant_id = Column(UUID(as_uuid=True), nullable=False)

    payload = Column(JSONB, nullable=False)
    updated_at = Column(
        TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Same index as migration d4e5f6a7b8c9 (alembic check must stay clean).
    __table_args__ = (
        Index("idx_ul_snapshots_tenant_updated", "tenant_id", "updated_at"),
    )

    def __repr__(self) -> str:
        return f"<UserLocalArrangementSnapshot(user={self.user_id})>"
