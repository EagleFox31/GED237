"""Per-user document lists: favourites and recently opened documents.

Both tables hold one row per (user, document). They only point at documents:
what a user may see is decided again at read time, so a document the user can
no longer read, or one in the trash, simply drops out of the lists.
"""

from sqlalchemy import TIMESTAMP, Column, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class DocumentFavorite(Base):
    """A document the user marked as favourite."""

    __tablename__ = "document_favorites"

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_document_favorites_user_created", "user_id", "created_at"),
        Index("ix_document_favorites_document_id", "document_id"),
    )


class DocumentRecentAccess(Base):
    """Last time the user opened a document (kept only when tracking is on)."""

    __tablename__ = "document_recent_access"

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    accessed_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
    access_count = Column(Integer, nullable=False, server_default="1")

    __table_args__ = (
        Index("ix_document_recent_access_user_accessed", "user_id", "accessed_at"),
        Index("ix_document_recent_access_document_id", "document_id"),
    )
