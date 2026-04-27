from sqlalchemy import Column, String, BigInteger, ForeignKey, TIMESTAMP, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import UUIDMixin


class DocumentVersion(Base, UUIDMixin):
    """Document Version model representing a single binary artifact in the version history."""

    __tablename__ = "document_versions"

    # Foreign key to the parent Aggregate Root (Document)
    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Versioning info
    version_number = Column(String(20), nullable=False)  # e.g., "1.0", "1.1"

    # File info specific to this version
    file_path = Column(String(1000), nullable=False)
    file_size = Column(BigInteger)
    mime_type = Column(String(100))
    checksum_sha256 = Column(
        String(64), nullable=True, index=True
    )  # SHA-256 fingerprint for duplicate detection

    # Audit trail
    uploaded_by_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    uploaded_at = Column(TIMESTAMP(timezone=True), nullable=False)
    change_note = Column(Text, nullable=True)

    # Relationships
    document = relationship(
        "Document", back_populates="versions", foreign_keys=[document_id]
    )
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])

    def __repr__(self):
        return f"<DocumentVersion(document_id={self.document_id}, v={self.version_number})>"
