from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

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
