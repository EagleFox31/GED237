from sqlalchemy import Column, String, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class Role(Base):
    """Role model with hierarchy"""

    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False)
    label = Column(String(100), nullable=False)
    hierarchy_level = Column(Integer, nullable=False, index=True)
    description = Column(Text)
    permissions = Column(JSONB, default=[])

    # Relationships
    users = relationship("User", back_populates="role")

    def __repr__(self):
        return f"<Role(code={self.code}, level={self.hierarchy_level})>"
