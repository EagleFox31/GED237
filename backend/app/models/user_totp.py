"""Authenticator app (TOTP) of a user: post-rc1 lot 4.

One row per user. The secret is encrypted with a key derived from SECRET_KEY
(services/totp.py); it is never returned after enrolment. ``last_used_step`` is
the last 30-second step accepted: a code of that step or an earlier one is a
replay and is refused.
"""

from sqlalchemy import BigInteger, Column, ForeignKey, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class UserTotp(Base):
    __tablename__ = "user_totp"

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    secret_encrypted = Column(Text, nullable=False)
    # Null until the user typed a first valid code: the app is not used before.
    confirmed_at = Column(TIMESTAMP(timezone=True))
    last_used_step = Column(BigInteger)
    created_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
