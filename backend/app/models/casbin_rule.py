# backend/app/models/casbin_rule.py
from sqlalchemy import Column, Integer, String, Index, UniqueConstraint

from app.core.database import Base


class CasbinRule(Base):
    """
    Casbin policy storage table compatible with casbin_sqlalchemy_adapter.
    """

    __tablename__ = "casbin_rule"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ptype = Column(String(255), nullable=False)
    v0 = Column(String(255))
    v1 = Column(String(255))
    v2 = Column(String(255))
    v3 = Column(String(255))
    v4 = Column(String(255))
    v5 = Column(String(255))

    __table_args__ = (
        Index("idx_casbin_rule_ptype", "ptype"),
        Index("idx_casbin_rule_v0_v1_v2", "v0", "v1", "v2"),
        UniqueConstraint(
            "ptype",
            "v0",
            "v1",
            "v2",
            "v3",
            "v4",
            "v5",
            name="uq_casbin_rule_all_fields",
        ),
    )
