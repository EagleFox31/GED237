from sqlalchemy import BigInteger, CheckConstraint, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AuthzPolicyVersion(Base):
    """
    Singleton table to version authz policy mutations.
    Used for lazy enforcer invalidation without restart.
    """

    __tablename__ = "authz_policy_version"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    version: Mapped[int] = mapped_column(BigInteger, nullable=False, default=1)

    __table_args__ = (
        CheckConstraint("id = 1", name="ck_authz_policy_version_singleton_id"),
    )
