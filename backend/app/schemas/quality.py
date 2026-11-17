from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

QualityIndicatorKey = Literal[
    "missing_metadata",
    "missing_category",
    "missing_domain",
    "missing_year",
    "needs_review",
    "no_text",
]


class QualityIndicator(BaseModel):
    key: QualityIndicatorKey
    label: str
    count: int
    # Share of the documents in scope, in percent; None when there is none.
    rate: Optional[float] = None


class QualitySummary(BaseModel):
    total_documents: int
    documents_to_fix: int
    # Share of documents with no indicator raised, in percent.
    quality_rate: Optional[float] = None
    indicators: list[QualityIndicator]


class QualityDocument(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    org_unit_id: Optional[UUID] = None
    status: str
    classification_status: str
    created_at: Optional[datetime] = None


QualityAlertMeasure = Literal["count", "rate"]


class QualityAlertScope(BaseModel):
    """Same filters as ``GET /analytics/quality``; checked again at each pass."""

    model_config = ConfigDict(extra="forbid")

    org_unit_id: Optional[UUID] = None
    recursive: bool = False
    domain_id: Optional[UUID] = None
    activity_id: Optional[UUID] = None
    document_category_id: Optional[UUID] = None


class QualityAlertCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    indicator: QualityIndicatorKey
    # count: number of documents; rate: percent of the documents in scope.
    measure: QualityAlertMeasure
    threshold: float = Field(ge=0)
    tenant_id: Optional[UUID] = None  # super admin only, like the report screens
    scope: QualityAlertScope = Field(default_factory=QualityAlertScope)

    @model_validator(mode="after")
    def _rate_is_a_percent(self):
        if self.measure == "rate" and self.threshold > 100:
            raise ValueError("Un seuil en taux est un pourcentage (0 à 100).")
        return self


class QualityAlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    indicator: QualityIndicatorKey
    measure: QualityAlertMeasure
    threshold: float
    scope: dict
    is_active: bool
    created_at: Optional[datetime] = None
    # Set while the threshold is reached (since the pass that saw it).
    alerting_since: Optional[datetime] = None
