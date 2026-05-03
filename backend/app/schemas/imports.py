from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel

ProcessingMode = Literal["archive", "process"]
ImportSourceScope = Literal["person", "service", "subdirectorate"]
ImportJobStatus = Literal[
    "draft",
    "analyzed",
    "running",
    "completed",
    "completed_with_errors",
    "cancelled",
]
ImportJobItemStatus = Literal[
    "pending",
    "classified",
    "needs_review",
    "duplicate",
    "ignored",
    "imported",
    "failed",
]


class ImportJobItemRead(BaseModel):
    id: UUID
    import_job_id: UUID
    original_filename: str
    source_relative_path: str
    mime_type: Optional[str] = None
    file_size: int
    checksum_sha256: Optional[str] = None
    detected_document_category_id: Optional[UUID] = None
    resolved_domain_id: Optional[UUID] = None
    resolved_activity_id: Optional[UUID] = None
    resolved_year: Optional[int] = None
    resolved_scope: Optional[str] = None
    resolved_target_org_unit_id: Optional[UUID] = None
    resolved_target_user_id: Optional[UUID] = None
    workflow_template_id: Optional[UUID] = None
    logical_space_path: Optional[str] = None
    status: ImportJobItemStatus
    error_message: Optional[str] = None
    document_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ImportJobRead(BaseModel):
    id: UUID
    tenant_id: UUID
    created_by_id: UUID
    source_scope: ImportSourceScope
    target_org_unit_id: Optional[UUID] = None
    target_user_id: Optional[UUID] = None
    default_document_category_id: Optional[UUID] = None
    forced_year: Optional[int] = None
    processing_mode: ProcessingMode
    status: ImportJobStatus
    total_files: int
    supported_files: int
    ignored_files: int
    duplicate_files: int
    error_files: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ImportJobWithItemsRead(ImportJobRead):
    items: list[ImportJobItemRead]


class ImportCommitResponse(BaseModel):
    job: ImportJobWithItemsRead
    imported_documents: int
    pending_review_items: int
    failed_items: int
