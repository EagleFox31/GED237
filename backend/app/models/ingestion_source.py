# backend/app/models/ingestion_source.py
from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    Column,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin

# local: a folder of the GED server; smb: a network share mounted on the server
# (the mount and its credentials are the server's business, not the database's);
# agent: a workstation agent that pushes its files with its own key.
SOURCE_TYPES = ("local", "smb", "agent")


class IngestionSource(Base, UUIDMixin, TimestampMixin):
    """A place the GED collects documents from, configured per tenant (F-NEXT-01).

    No secret is stored in clear: an SMB source names the server-side secret that
    mounts it (``credentials_ref``), an agent source keeps only the SHA-256 of its
    key and a short prefix to recognise it.
    """

    __tablename__ = "ingestion_sources"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_ingestion_source_tenant_name"),
        UniqueConstraint("agent_key_hash", name="uq_ingestion_source_agent_key_hash"),
    )

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(150), nullable=False)
    source_type = Column(String(16), nullable=False)
    # Server-side path for local and smb sources; must sit under INGEST_ALLOWED_ROOTS.
    path = Column(String(1024), nullable=True)
    credentials_ref = Column(String(128), nullable=True)
    agent_key_hash = Column(String(64), nullable=True)
    agent_key_prefix = Column(String(12), nullable=True)

    # Where and how the collected files land.
    org_unit_id = Column(UUID(as_uuid=True), ForeignKey("org_units.id"), nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    document_category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("document_categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    recursive = Column(Boolean, default=True, nullable=False)
    processing_mode = Column(String(16), default="process", nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)

    # Last run: counts only, never file contents.
    last_run_at = Column(TIMESTAMP, nullable=True)
    last_run_status = Column(String(16), nullable=True)
    last_run_report = Column(JSONB, nullable=True)
