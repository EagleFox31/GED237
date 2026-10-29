from sqlalchemy import Column, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps"""

    created_at = Column(TIMESTAMP, default=func.now(), nullable=False)
    updated_at = Column(
        TIMESTAMP, default=func.now(), onupdate=func.now(), nullable=False
    )


class UUIDMixin:
    """Mixin for UUID primary key"""

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class TenantMixin:
    """Mixin for tenant_id foreign key"""

    # Note: Foreign key will be added in specific models
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
