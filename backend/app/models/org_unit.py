from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    ForeignKey,
    CheckConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class OrgUnitType(Base):
    """Organization unit types (Ministry, Direction, Service, etc.)"""

    __tablename__ = "org_unit_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False)
    label = Column(String(100), nullable=False)
    level = Column(Integer, nullable=False)
    description = Column(String(500))

    # Relationships
    org_units = relationship("OrgUnit", back_populates="type")

    __table_args__ = (
        Index("idx_org_unit_type_level_code", "level", "code", unique=True),
    )

    def __repr__(self):
        return f"<OrgUnitType(code={self.code}, level={self.level})>"


class OrgUnit(Base, UUIDMixin, TimestampMixin):
    """Organization unit with flexible hierarchy"""

    __tablename__ = "org_units"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_id = Column(
        UUID(as_uuid=True), ForeignKey("org_units.id", ondelete="CASCADE"), index=True
    )

    # Identity
    code = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    short_name = Column(String(100))

    # Type and Level
    type_id = Column(Integer, ForeignKey("org_unit_types.id"))
    level = Column(Integer, nullable=False)

    # Materialized path for fast queries
    path = Column(String(1000))

    # Extra data
    extra_data = Column(JSONB, default={})
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="org_units")
    type = relationship("OrgUnitType", back_populates="org_units")
    parent = relationship("OrgUnit", remote_side="OrgUnit.id", backref="children")
    users = relationship("User", back_populates="org_unit")
    documents = relationship(
        "Document",
        back_populates="org_unit",
        foreign_keys="Document.org_unit_id",
    )

    __table_args__ = (
        Index("idx_org_units_tenant_code", "tenant_id", "code", unique=True),
        Index("idx_org_units_parent", "parent_id"),
        Index("idx_org_units_level", "tenant_id", "level"),
        CheckConstraint("level > 0", name="check_level_positive"),
        CheckConstraint(
            "(parent_id IS NULL AND level = 1) OR (parent_id IS NOT NULL AND level > 1)",
            name="check_parent_level_consistency",
        ),
    )

    def __repr__(self):
        return f"<OrgUnit(code={self.code}, name={self.name}, level={self.level})>"


class OrgUnitClosure(Base):
    """Closure table for fast hierarchical queries"""

    __tablename__ = "org_unit_closure"

    ancestor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("org_units.id", ondelete="CASCADE"),
        primary_key=True,
    )
    descendant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("org_units.id", ondelete="CASCADE"),
        primary_key=True,
    )
    depth = Column(Integer, nullable=False)

    __table_args__ = (
        Index("idx_closure_ancestor", "ancestor_id", "depth"),
        Index("idx_closure_descendant", "descendant_id"),
    )

    def __repr__(self):
        return f"<OrgUnitClosure(ancestor={self.ancestor_id}, descendant={self.descendant_id}, depth={self.depth})>"
