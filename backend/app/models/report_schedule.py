"""Scheduled official reports.

A ``report_schedules`` row asks for one official report per closed period (week or
month). ``report_runs`` keeps one line per schedule and period: the unique key
(schedule_id, period_key) makes a second pass over the same period a no-op.
"""

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    Column,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.base import UUIDMixin


class ReportSchedule(Base, UUIDMixin):
    """One official report to issue every closed week or month."""

    __tablename__ = "report_schedules"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    # The report is issued in this user's name and scope, and they are notified.
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(120), nullable=False)
    frequency = Column(String(16), nullable=False)  # weekly | monthly
    # OfficialReportRequest without dates: the period fills them for "evolution".
    request = Column(JSONB, nullable=False, default=dict)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (Index("ix_report_schedules_tenant", "tenant_id"),)


class ReportRun(Base, UUIDMixin):
    """One pass of a schedule over one closed period."""

    __tablename__ = "report_runs"

    schedule_id = Column(
        UUID(as_uuid=True),
        ForeignKey("report_schedules.id", ondelete="CASCADE"),
        nullable=False,
    )
    period_key = Column(String(16), nullable=False)  # 2026-W46 | 2026-10
    status = Column(String(16), nullable=False)  # issued | failed
    report_issue_id = Column(
        UUID(as_uuid=True), ForeignKey("report_issues.id", ondelete="SET NULL")
    )
    error = Column(String(300))
    ran_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint(
            "schedule_id", "period_key", name="uq_report_runs_schedule_period"
        ),
    )
