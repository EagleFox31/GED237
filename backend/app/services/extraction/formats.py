"""Which uploaded files get their text read in the background (OCR worker).

Kept free of heavy imports: the API calls it on every upload, import and review.
"""

DOCX_MIME_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)
XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
OFFICE_MIME_TYPES = frozenset({DOCX_MIME_TYPE, XLSX_MIME_TYPE})


def has_text_reader(mime_type: str | None) -> bool:
    """True when the worker can read text from this type: images and PDF through OCR,
    Word and Excel (.docx, .xlsx) directly from the file."""
    if not mime_type:
        return False
    return (
        mime_type.startswith("image/")
        or mime_type == "application/pdf"
        or mime_type in OFFICE_MIME_TYPES
    )
