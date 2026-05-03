from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, TIMESTAMP, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class User(Base, UUIDMixin, TimestampMixin):
    """User model"""

    __tablename__ = "users"

    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_unit_id = Column(
        UUID(as_uuid=True), ForeignKey("org_units.id", ondelete="SET NULL"), index=True
    )
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False, index=True)
    reports_to_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Identity
    matricule = Column(String(50), nullable=False, index=True)
    email = Column(String(255), unique=True, index=True)
    first_name = Column(String(100))
    last_name = Column(String(100))

    # Authentication
    password_hash = Column(String(255), nullable=False)
    mfa_secret = Column(String(100))

    # Profile
    avatar_url = Column(String(500))
    phone = Column(String(20))
    profile_data = Column(JSONB, default={})

    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    must_change_password = Column(
        Boolean, default=False, nullable=False, server_default="false"
    )
    last_login = Column(TIMESTAMP)

    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    org_unit = relationship("OrgUnit", back_populates="users")
    role = relationship("Role", back_populates="users")
    documents = relationship(
        "Document", back_populates="owner", foreign_keys="Document.owner_id"
    )
    workflow_steps = relationship("WorkflowStep", back_populates="assigned_user")
    reports_to = relationship(
        "User",
        remote_side="User.id",
        foreign_keys=[reports_to_user_id],
        backref="direct_reports",
    )

    __table_args__ = (
        Index("idx_users_tenant_matricule", "tenant_id", "matricule", unique=True),
        Index(
            "idx_users_email",
            "email",
            unique=True,
            postgresql_where=(email.isnot(None)),
        ),
    )

    @property
    def full_name(self):
        """Get full name"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.matricule

    def __repr__(self):
        return f"<User(matricule={self.matricule}, role={self.role_id})>"
