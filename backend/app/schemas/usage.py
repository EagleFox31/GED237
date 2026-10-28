"""Pydantic schemas for the lightweight usage telemetry endpoints."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

LocalOrganizeStrategy = Literal[
    "by_type",
    "by_year",
    "by_type_year",
    "by_business_rules",
]
LocalOrganizeMode = Literal["fsa", "zip"]


class LocalOrganizeEventCreate(BaseModel):
    """Payload accepté par POST /api/v1/usage/local-organize.

    On n'accepte QUE des compteurs et l'énumération de la stratégie /
    du mode utilisé. Aucune liste de fichiers, aucun nom, aucune taille
    individuelle. La promesse du mode local (« rien ne sort du poste »)
    n'est pas affaiblie : l'admin tenant ne voit que des agrégats.
    """

    file_count: int = Field(..., ge=0, le=1_000_000)
    folders_created: int = Field(..., ge=0, le=10_000)
    files_unranged: int = Field(..., ge=0, le=1_000_000)
    strategy: LocalOrganizeStrategy
    mode: LocalOrganizeMode


class LocalOrganizeEventOut(BaseModel):
    id: UUID
    tenant_id: UUID | None
    user_id: UUID | None
    file_count: int
    folders_created: int
    files_unranged: int
    strategy: str
    mode: str
    created_at: datetime

    class Config:
        from_attributes = True


class LocalArrangementSnapshotFile(BaseModel):
    name: str = Field(..., max_length=512)
    folder_path: str = Field(..., max_length=2048)
    size: int = Field(..., ge=0, le=10**14)
    last_modified: int = Field(..., ge=0, le=10**15)


class LocalArrangementSnapshotUpsert(BaseModel):
    """Manifeste du dernier rangement local — une ligne JSONB par utilisateur."""

    id: str = Field(..., max_length=120)
    created_at: int = Field(..., ge=0)
    destination: str = Field(..., max_length=512)
    wrapper: str | None = Field(None, max_length=260)
    strategy: str = Field(..., max_length=40)
    mode: LocalOrganizeMode
    files: list[LocalArrangementSnapshotFile] = Field(..., max_length=50000)
    total_files: int = Field(..., ge=0)
    total_folders: int = Field(..., ge=0)
    files_unranged: int = Field(..., ge=0)


class LocalArrangementSnapshotEnvelope(BaseModel):
    """Réponse GET : snapshot ou null si jamais synchronisé."""

    snapshot: LocalArrangementSnapshotUpsert | None = None
