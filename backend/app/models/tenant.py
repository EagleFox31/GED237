# backend/app/models/tenant.py
from sqlalchemy import Column, String, Boolean, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class Tenant(Base, UUIDMixin, TimestampMixin):
    """Tenant model (Ministères / Organisations)"""

    __tablename__ = "tenants"

    name = Column(String(255), nullable=False)
    short_name = Column(String(50))
    logo_url = Column(String(500))
    domain = Column(String(100), unique=True)
    settings = Column(JSONB, default={})
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    org_units = relationship(
        "OrgUnit", back_populates="tenant", cascade="all, delete-orphan"
    )
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    documents = relationship(
        "Document", back_populates="tenant", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Tenant(id={self.id}, name={self.name})>"
