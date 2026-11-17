"""Register of official reports.

Each generated official report gets an order number per institution and year
(``N° 0001/2026/<short name>``). ``report_counters`` holds the last number given;
``report_issues`` keeps one line per copy issued, with the SHA-256 of the file
delivered, so a copy can be checked against the register later.
"""

from sqlalchemy import (
    TIMESTAMP,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.base import UUIDMixin


class ReportCounter(Base):
    """Last order number given, per institution and year."""

    __tablename__ = "report_counters"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        primary_key=True,
    )
    year = Column(Integer, primary_key=True)
    last_value = Column(Integer, nullable=False, default=0)


class ReportIssue(Base, UUIDMixin):
    """One official report copy issued."""

    __tablename__ = "report_issues"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    year = Column(Integer, nullable=False)
    sequence = Column(Integer, nullable=False)
    number = Column(String(80), nullable=False)
    kind = Column(String(32), nullable=False)
    format = Column(String(8), nullable=False)
    # Effective scope and filters, as applied (ids as strings).
    filters = Column(JSONB, nullable=False, default=dict)
    # Header printed on the copy (institution, unit, period, author, date), kept
    # so an identical copy can be produced again byte for byte.
    header = Column(JSONB, nullable=False, default=dict)
    # SHA-256 of the report data alone, and of the file delivered.
    content_sha256 = Column(String(64), nullable=False)
    file_sha256 = Column(String(64), nullable=False)
    issued_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    issued_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "year", "sequence", name="uq_report_issues_tenant_year_seq"
        ),
        Index("ix_report_issues_tenant_issued_at", "tenant_id", "issued_at"),
    )
