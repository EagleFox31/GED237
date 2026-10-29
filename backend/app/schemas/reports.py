from datetime import date
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

ReportsGranularity = Literal["day", "week", "month"]
ReportsSeriesKey = Literal[
    "documents_created",
    "documents_auto_classified",
    "documents_needing_review",
]


class ReportsEvolutionFilters(BaseModel):
    tenant_id: UUID
    date_from: date
    date_to: date
    granularity: ReportsGranularity
    org_unit_id: Optional[UUID] = None
    recursive: bool = False
    domain_id: Optional[UUID] = None
    activity_id: Optional[UUID] = None
    document_category_id: Optional[UUID] = None


class ReportsTimeseriesPoint(BaseModel):
    bucket_start: date
    bucket_label: str
    value: int


class ReportsEvolutionSeries(BaseModel):
    documents_created: list[ReportsTimeseriesPoint] = Field(default_factory=list)
    documents_auto_classified: list[ReportsTimeseriesPoint] = Field(
        default_factory=list
    )
    documents_needing_review: list[ReportsTimeseriesPoint] = Field(default_factory=list)
    imports_completed: list[ReportsTimeseriesPoint] = Field(default_factory=list)
    workflow_steps_completed: list[ReportsTimeseriesPoint] = Field(default_factory=list)
    workflow_steps_rejected: list[ReportsTimeseriesPoint] = Field(default_factory=list)


class ReportsEvolutionTotals(BaseModel):
    documents_created: int = 0
    documents_auto_classified: int = 0
    documents_needing_review: int = 0
    imports_completed: int = 0
    workflow_steps_completed: int = 0
    workflow_steps_rejected: int = 0


class ReportsBreakdownItem(BaseModel):
    id: Optional[UUID] = None
    label: str
    value: int


class ReportsSeriesBreakdowns(BaseModel):
    documents_created: list[ReportsBreakdownItem] = Field(default_factory=list)
    documents_auto_classified: list[ReportsBreakdownItem] = Field(default_factory=list)
    documents_needing_review: list[ReportsBreakdownItem] = Field(default_factory=list)


class ReportsEvolutionBreakdowns(BaseModel):
    org_units: ReportsSeriesBreakdowns = Field(default_factory=ReportsSeriesBreakdowns)
    domains: list[ReportsBreakdownItem] = Field(default_factory=list)
    activities: list[ReportsBreakdownItem] = Field(default_factory=list)
    imports: list[ReportsBreakdownItem] = Field(default_factory=list)


class ReportsEvolutionResponse(BaseModel):
    filters: ReportsEvolutionFilters
    series: ReportsEvolutionSeries
    totals: ReportsEvolutionTotals
    breakdowns: ReportsEvolutionBreakdowns


class ReportsDocumentActivityBreakdownItem(BaseModel):
    key: str
    label: str
    value: int


class ReportsDocumentActivitySignals(BaseModel):
    unclassified_documents: int = 0
    documents_missing_information: int = 0
    documents_needing_review: int = 0
    imports_needing_review: int = 0
    # Compteurs anonymes du mode « Ranger sur mon poste » (rangement local).
    # Aucun fichier ni nom n'est stocké côté serveur, seulement les totaux
    # agrégés sur la période, alimentés par `local_organize_events`.
    local_organize_runs: int = 0
    local_organize_files: int = 0
    local_organize_files_unranged: int = 0


class ReportsDocumentActivityAvailability(BaseModel):
    by_file_type: bool = True
    by_org_unit: bool = True
    urgent_documents: bool = False
    confidential_documents: bool = False


class ReportsDocumentActivityResponse(BaseModel):
    total_active_documents: int = 0
    validated_documents: int = 0
    archived_documents: int = 0
    reviewed_documents: int = 0
    by_status: list[ReportsDocumentActivityBreakdownItem] = Field(default_factory=list)
    by_file_type: list[ReportsDocumentActivityBreakdownItem] = Field(
        default_factory=list
    )
    by_org_unit: list[ReportsDocumentActivityBreakdownItem] = Field(
        default_factory=list
    )
    signals: ReportsDocumentActivitySignals = Field(
        default_factory=ReportsDocumentActivitySignals
    )
    availability: ReportsDocumentActivityAvailability = Field(
        default_factory=ReportsDocumentActivityAvailability
    )


class ReportsWorkflowActivityBreakdownItem(BaseModel):
    key: str
    label: str
    value: int


class ReportsWorkflowDelayItem(BaseModel):
    key: str
    label: str
    average_days: float = 0.0
    steps_count: int = 0


class ReportsWorkflowActivityAvailability(BaseModel):
    by_step: bool = True
    pending_actions: bool = True
    delay_by_org_unit: bool = True


class ReportsWorkflowActivityResponse(BaseModel):
    active_steps: int = 0
    completed_steps: int = 0
    rejected_steps: int = 0
    open_workflows: int = 0
    completed_workflows: int = 0
    blocked_workflows_estimated: int = 0
    by_step: list[ReportsWorkflowActivityBreakdownItem] = Field(default_factory=list)
    pending_actions: list[ReportsWorkflowActivityBreakdownItem] = Field(
        default_factory=list
    )
    slowest_steps: list[ReportsWorkflowDelayItem] = Field(default_factory=list)
    delay_by_org_unit: list[ReportsWorkflowDelayItem] = Field(default_factory=list)
    availability: ReportsWorkflowActivityAvailability = Field(
        default_factory=ReportsWorkflowActivityAvailability
    )


class ReportsServiceActivityItem(BaseModel):
    id: UUID
    label: str
    documents_total: int = 0
    documents_in_progress: int = 0
    documents_needing_review: int = 0
    open_workflows: int = 0
    estimated_delays: int = 0
    average_workflow_days: float = 0.0
    active_users: int = 0
    inactive_users: int = 0


class ReportsServiceActivityResponse(BaseModel):
    services: list[ReportsServiceActivityItem] = Field(default_factory=list)
    total_services: int = 0
    overloaded_services: int = 0
    services_with_reviews: int = 0
    availability: dict[str, bool] = Field(default_factory=dict)
