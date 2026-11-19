"""Text extraction from uploaded files that are not read by OCR."""

from .formats import (
    DOCX_MIME_TYPE,
    OFFICE_MIME_TYPES,
    XLSX_MIME_TYPE,
    has_text_reader,
)

__all__ = ["DOCX_MIME_TYPE", "OFFICE_MIME_TYPES", "XLSX_MIME_TYPE", "has_text_reader"]
