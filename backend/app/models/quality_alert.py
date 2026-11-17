"""Alerts on the documentary quality indicators.

A ``quality_alert_rules`` row watches one indicator (count or rate) in one scope.
``quality_alert_events`` keeps one line per breach: it opens when the threshold is
reached and closes when the indicator falls back below it. The partial unique
index (one open event per rule) makes a second pass, or a second worker, a no-op:
the creator is notified once per breach, not at every pass.
"""

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    Column,
    Float,
    ForeignKey,
    Index,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.base import UUIDMixin


class QualityAlertRule(Base, UUIDMixin):
    """Notify the creator when an indicator reaches a threshold."""

    __tablename__ = "quality_alert_rules"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Evaluated in this user's scope (checked at each pass); they are notified.
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(120), nullable=False)
    indicator = Column(String(32), nullable=False)  # app.services.document_quality
    measure = Column(String(8), nullable=False)  # count | rate
    threshold = Column(Float, nullable=False)
    # org_unit_id, recursive, domain_id, activity_id, document_category_id.
    scope = Column(JSONB, nullable=False, default=dict)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (Index("ix_quality_alert_rules_tenant", "tenant_id"),)


class QualityAlertEvent(Base, UUIDMixin):
    """One breach of a rule, from the pass that saw it to the one that cleared it."""

    __tablename__ = "quality_alert_events"

    rule_id = Column(
        UUID(as_uuid=True),
        ForeignKey("quality_alert_rules.id", ondelete="CASCADE"),
        nullable=False,
    )
    value = Column(Float, nullable=False)  # indicator value when the breach opened
    opened_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    cleared_at = Column(TIMESTAMP)

    __table_args__ = (
        Index(
            "uq_quality_alert_events_open",
            "rule_id",
            unique=True,
            postgresql_where=text("cleared_at IS NULL"),
        ),
    )
