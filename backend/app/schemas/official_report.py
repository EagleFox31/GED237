from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.reports import ReportsGranularity

OfficialReportKind = Literal[
    "evolution", "document-activity", "workflow-activity", "service-activity"
]
OfficialReportFormat = Literal["csv", "html", "pdf"]


class OfficialReportRequest(BaseModel):
    """Same filters as the ``/reports/*`` screens; dates apply to ``evolution`` only."""

    model_config = ConfigDict(extra="forbid")

    kind: OfficialReportKind
    format: OfficialReportFormat = "csv"
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    granularity: ReportsGranularity = "day"
    org_unit_id: Optional[UUID] = None
    recursive: bool = False
    domain_id: Optional[UUID] = None
    activity_id: Optional[UUID] = None
    document_category_id: Optional[UUID] = None
    tenant_id: Optional[UUID] = None


class OfficialReportIssueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    number: str
    year: int
    sequence: int
    kind: str
    format: str
    filters: dict
    file_sha256: str
    issued_by: Optional[UUID] = None
    issued_at: datetime


ReportFrequency = Literal["weekly", "monthly"]


class ReportScheduleCreate(BaseModel):
    """One official report per closed week or month; ``evolution`` covers that period."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    frequency: ReportFrequency
    report: OfficialReportRequest


class ReportScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    frequency: str
    request: dict
    is_active: bool
    created_at: datetime
