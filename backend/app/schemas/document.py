# backend/app/schemas/document.py
from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

DocumentStatus = Literal[
    "draft", "in_review", "validated", "signed", "archived", "rejected", "returned"
]
ProcessingMode = Literal["archive", "process"]
ClassificationScope = Literal["person", "service", "subdirectorate", "directorate"]
ClassificationStatus = Literal["pending", "classified", "needs_review", "rejected"]


class DocumentBase(BaseModel):
    title: str
    document_category_id: Optional[UUID] = None
    tags: Optional[List[str]] = []
    description: Optional[str] = None


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    document_category_id: Optional[UUID] = None
    tags: Optional[List[str]] = None
    status: Optional[DocumentStatus] = None


class DocumentRead(DocumentBase):
    id: UUID
    category_code: Optional[str] = None
    category_name: Optional[str] = None
    tenant_id: UUID
    org_unit_id: Optional[UUID] = None
    owner_id: UUID
    file_path: str
    file_type: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    status: DocumentStatus
    processing_mode: ProcessingMode = "process"
    classification_domain_id: Optional[UUID] = None
    classification_domain_name: Optional[str] = None
    classification_activity_id: Optional[UUID] = None
    classification_activity_name: Optional[str] = None
    classification_year: Optional[int] = None
    classification_scope: ClassificationScope = "service"
    classification_target_org_unit_id: Optional[UUID] = None
    classification_target_user_id: Optional[UUID] = None
    classification_status: ClassificationStatus = "pending"
    logical_space_path: Optional[str] = None
    source_relative_path: Optional[str] = None
    import_job_id: Optional[UUID] = None
    current_version_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    owner_name: Optional[str] = None
    current_version_number: Optional[str] = None

    class Config:
        from_attributes = True


class DocumentOCRContent(BaseModel):
    """OCR content with metadata"""

    document_id: UUID
    ocr_content: Optional[str] = None
    ocr_confidence: Optional[float] = None
    ocr_status: str = "not_processed"

    class Config:
        from_attributes = True


class DirectoryIngestRequest(BaseModel):
    """Request to ingest all documents from a directory"""

    directory_path: str
    recursive: bool = True
    document_category_id: Optional[UUID] = None
    processing_mode: ProcessingMode = "process"


class IngestFileDetail(BaseModel):
    document_id: str
    filename: str
    title: str
    mime_type: str
    file_size: int
    rules_matched: List[str] = []
    ocr_queued: bool = False


class IngestError(BaseModel):
    file: str
    error: str


class DirectoryIngestResponse(BaseModel):
    total_found: int
    imported: int
    skipped: int
    error_count: int
    errors: List[IngestError] = []
    details: List[IngestFileDetail] = []


class NeedsReviewDocument(DocumentRead):
    arbitration_reason: Optional[str] = None


class RuleSuggestion(BaseModel):
    enabled: bool
    name: str
    operator: Literal["AND", "OR"]
    priority: int
    trigger_type: str
    condition_type: Literal["ocr_contains", "ocr_n_of_m"]
    keywords: List[str]
    min_matches: Optional[int] = None


class ResolveReviewPayload(BaseModel):
    """Payload de la résolution d'un document en revue manuelle"""

    target_folder_id: Optional[str] = None
    document_category_id: Optional[UUID] = None
    comment: Optional[str] = None
    resolution_reason: Optional[str] = None
    new_filename: Optional[str] = Field(
        None, description="Renomme le fichier local et en base de données"
    )
    mark_as_resolved: bool
    create_rule_suggestion: Optional[bool] = False
    rule_suggestion: Optional[RuleSuggestion] = None
