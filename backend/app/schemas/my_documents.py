from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel


class MyDocument(BaseModel):
    """A line of « Mes favoris », « Récents » or « Partagés »."""

    id: UUID
    title: str
    status: str
    org_unit_id: Optional[UUID] = None
    document_category_id: Optional[UUID] = None
    category_name: Optional[str] = None
    owner_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_favorite: bool
    # When it was marked as favourite (favorites) or last opened (recent).
    marked_at: Optional[datetime] = None
    # Shared only: « assigned » (a current workflow step is mine) or « visible ».
    reason: Optional[Literal["assigned", "visible"]] = None
