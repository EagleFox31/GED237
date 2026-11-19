from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DuplicateMember(BaseModel):
    id: UUID
    title: str
    status: str
    org_unit_id: UUID
    org_unit_name: Optional[str] = None
    owner_name: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    logical_space_path: Optional[str] = None
    created_at: datetime


class DuplicateGroup(BaseModel):
    checksum: str
    count: int
    suggested_keep_id: UUID
    documents: list[DuplicateMember]


class DuplicateResolveRequest(BaseModel):
    """Keep one document of a group; the others go to the recycle bin."""

    model_config = ConfigDict(extra="forbid")

    keep_id: UUID
    trash_ids: list[UUID] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def _distinct(self) -> "DuplicateResolveRequest":
        if len(set(self.trash_ids)) != len(self.trash_ids):
            raise ValueError("trash_ids contient deux fois le même document.")
        if self.keep_id in self.trash_ids:
            raise ValueError("Le document gardé ne peut pas partir à la corbeille.")
        return self


class DuplicateResolution(BaseModel):
    kept_id: UUID
    trashed: list[UUID]
    already_trashed: list[UUID]
