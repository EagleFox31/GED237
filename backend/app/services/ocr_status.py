"""OCR state of a document, derived from what is stored (no column, no migration).

Values (the contract read by the front end):
- ``completed``     : the text was read (ocr_content is not empty).
- ``failed``        : the OCR gave up (``extra_data["ocr_failed"]`` is set by the worker).
- ``processing``    : an image or a PDF still without text: the reading is waiting or running.
- ``not_processed`` : other file types, which are never read.
"""

from typing import Any, Optional

OCR_COMPLETED = "completed"
OCR_FAILED = "failed"
OCR_PROCESSING = "processing"
OCR_NOT_PROCESSED = "not_processed"

FAILED_KEY = "ocr_failed"


def compute_ocr_status(document: Any) -> str:
    if getattr(document, "ocr_content", None):
        return OCR_COMPLETED
    extra = getattr(document, "extra_data", None) or {}
    if extra.get(FAILED_KEY):
        return OCR_FAILED
    source_type: Optional[str] = getattr(document, "mime_type", None) or getattr(
        document, "file_type", None
    )
    if source_type and (
        source_type.startswith("image/") or source_type == "application/pdf"
    ):
        return OCR_PROCESSING
    return OCR_NOT_PROCESSED
