from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.document import ClassificationScope, DocumentRead
from app.schemas.imports import ImportJobItemRead, ProcessingMode

ClassificationReviewStatus = Literal["open", "resolved", "cancelled"]
ClassificationReviewSource = Literal["document", "import_job_item"]


class ClassificationReviewRead(BaseModel):
    id: UUID
    tenant_id: UUID
    document_id: Optional[UUID] = None
    import_job_item_id: Optional[UUID] = None
    review_source: ClassificationReviewSource
    review_status: ClassificationReviewStatus
    processing_mode: Optional[ProcessingMode] = None
    arbitration_reason: Optional[str] = None
    suggested_domain_id: Optional[UUID] = None
    suggested_activity_id: Optional[UUID] = None
    suggested_year: Optional[int] = None
    suggested_scope: Optional[ClassificationScope] = None
    suggested_target_org_unit_id: Optional[UUID] = None
    suggested_target_user_id: Optional[UUID] = None
    resolved_by_id: Optional[UUID] = None
    resolved_at: Optional[datetime] = None
    resolution_comment: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    document: Optional[DocumentRead] = None
    import_job_item: Optional[ImportJobItemRead] = None

    class Config:
        from_attributes = True


class ClassificationReviewResolvePayload(BaseModel):
    classification_domain_id: UUID
    classification_activity_id: UUID
    classification_year: int = Field(..., ge=1900, le=2100)
    classification_scope: ClassificationScope
    classification_target_org_unit_id: Optional[UUID] = None
    classification_target_user_id: Optional[UUID] = None
    document_category_id: Optional[UUID] = None
    new_filename: Optional[str] = Field(
        None, description="Renomme le fichier local et en base de donnees"
    )
    comment: Optional[str] = None
    relaunch_workflow: bool = True


class ClassificationReviewResolveResponse(BaseModel):
    success: bool
    review_id: UUID
    document_id: UUID
    review_status: ClassificationReviewStatus
    document_classification_status: str
    logical_space_path: Optional[str] = None
    workflow_relaunched: bool = False
    document: DocumentRead
