"""One scheduled backup per local day (post-rc1 lot 13)."""

import uuid

from sqlalchemy import TIMESTAMP, BigInteger, Column, Date, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class BackupRun(Base):
    """A scheduled backup. ``slot`` (local date) is unique: a second run the same
    day finds the slot taken and does nothing, unless the first one failed."""

    __tablename__ = "backup_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slot = Column(Date, nullable=False, unique=True)
    status = Column(String(20), nullable=False)  # running | succeeded | failed
    attempts = Column(Integer, nullable=False, default=1)
    started_at = Column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    finished_at = Column(TIMESTAMP(timezone=True))
    # Directory name under SCHEDULED_BACKUP_DIR, set once the backup is complete.
    path = Column(String(255))
    size_bytes = Column(BigInteger)
    error = Column(String(500))
    # Set when retention deleted the directory: the row stays as history.
    pruned_at = Column(TIMESTAMP(timezone=True))
