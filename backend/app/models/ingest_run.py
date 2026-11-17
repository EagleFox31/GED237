"""Progress of a directory import, so that an interrupted import can resume.

``ingest_runs`` keeps the parameters and the state of one ``POST
/documents/ingest-directory``. ``ingest_run_files`` keeps one line per source file,
written in the same transaction as its document: a file is either recorded and in
the GED, or neither. A new request with the same parameters resumes the last run
that did not finish and skips the files already recorded.
"""

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.base import UUIDMixin


class IngestRun(Base, UUIDMixin):
    """One directory import, possibly over several requests."""

    __tablename__ = "ingest_runs"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    owner_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    org_unit_id = Column(UUID(as_uuid=True), nullable=False)
    source_dir = Column(Text, nullable=False)  # resolved real path
    recursive = Column(Boolean, nullable=False)
    processing_mode = Column(String(16), nullable=False)
    document_category_id = Column(UUID(as_uuid=True))
    status = Column(String(16), nullable=False)  # running | partial | completed
    total_found = Column(Integer, nullable=False, default=0)
    attempts = Column(Integer, nullable=False, default=1)
    started_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    finished_at = Column(TIMESTAMP)
    # Bumped with each file: a "running" run without a recent beat was cut.
    heartbeat_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (Index("ix_ingest_runs_tenant_status", "tenant_id", "status"),)


class IngestRunFile(Base, UUIDMixin):
    """Outcome of one source file within a run."""

    __tablename__ = "ingest_run_files"

    run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ingest_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_path = Column(Text, nullable=False)
    status = Column(String(16), nullable=False)  # imported | duplicate | error
    document_id = Column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL")
    )
    error = Column(String(500))
    updated_at = Column(
        TIMESTAMP, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("run_id", "source_path", name="uq_ingest_run_files_path"),
    )
