# backend/app/schemas/ingestion_source.py
import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

from app.schemas.document import DirectoryIngestResponse, ProcessingMode

SourceType = Literal["local", "smb", "agent"]
RunStatus = Literal["success", "partial", "failed"]


class IngestionSourceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    path: Optional[str] = Field(None, max_length=1024)
    # Name of the server-side secret that mounts an SMB share; never the secret.
    credentials_ref: Optional[str] = Field(
        None, max_length=128, pattern=r"^[A-Za-z0-9_.\-/]+$"
    )
    org_unit_id: Optional[uuid.UUID] = None
    owner_id: Optional[uuid.UUID] = None
    document_category_id: Optional[uuid.UUID] = None
    recursive: bool = True
    processing_mode: ProcessingMode = "process"
    enabled: bool = True


class IngestionSourceCreate(IngestionSourceBase):
    """org_unit_id and owner_id default to the caller's unit and the caller."""

    source_type: SourceType

    @model_validator(mode="after")
    def _path_matches_type(self):
        if self.source_type == "agent":
            if self.path or self.credentials_ref:
                raise ValueError("an agent source has no server path nor credentials")
        elif not (self.path and self.path.strip()):
            raise ValueError("a local or smb source needs a server path")
        if self.source_type == "local" and self.credentials_ref:
            raise ValueError("credentials_ref is for smb sources only")
        return self


class IngestionSourceUpdate(BaseModel):
    """The type is fixed at creation: delete and recreate to change it."""

    name: Optional[str] = Field(None, min_length=1, max_length=150)
    path: Optional[str] = Field(None, min_length=1, max_length=1024)
    credentials_ref: Optional[str] = Field(
        None, max_length=128, pattern=r"^[A-Za-z0-9_.\-/]+$"
    )
    org_unit_id: Optional[uuid.UUID] = None
    owner_id: Optional[uuid.UUID] = None
    document_category_id: Optional[uuid.UUID] = None
    recursive: Optional[bool] = None
    processing_mode: Optional[ProcessingMode] = None
    enabled: Optional[bool] = None


class IngestionSourceResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    source_type: SourceType
    path: Optional[str] = None
    credentials_ref: Optional[str] = None
    # First characters of an agent's key, to tell keys apart; the key is shown once.
    agent_key_prefix: Optional[str] = None
    org_unit_id: uuid.UUID
    owner_id: uuid.UUID
    document_category_id: Optional[uuid.UUID] = None
    recursive: bool
    processing_mode: ProcessingMode
    enabled: bool
    last_run_at: Optional[datetime] = None
    last_run_status: Optional[RunStatus] = None
    last_run_report: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IngestionSourceWithKey(IngestionSourceResponse):
    """Creation or rotation of an agent source: the only time its key is readable."""

    agent_key: Optional[str] = None


class IngestionSourceRunResponse(DirectoryIngestResponse):
    source_id: uuid.UUID
    status: RunStatus
    ran_at: datetime
