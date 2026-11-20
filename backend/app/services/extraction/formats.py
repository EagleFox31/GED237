"""Which uploaded files get their text read in the background (OCR worker).

Kept free of heavy imports: the API calls it on every upload, import and review.
"""

import mimetypes
import os

DOCX_MIME_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)
XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
OFFICE_MIME_TYPES = frozenset({DOCX_MIME_TYPE, XLSX_MIME_TYPE})

# Python's built-in table has no .docx/.xlsx: it relies on the system's mime.types,
# which slim images (python:*-slim) do not ship.
_OFFICE_EXTENSIONS = {".docx": DOCX_MIME_TYPE, ".xlsx": XLSX_MIME_TYPE}


def guess_mime_type(path: str) -> str:
    """MIME type from the file name, the same on every host; octet-stream if unknown."""
    extension = os.path.splitext(path)[1].lower()
    if extension in _OFFICE_EXTENSIONS:
        return _OFFICE_EXTENSIONS[extension]
    return mimetypes.guess_type(path)[0] or "application/octet-stream"


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
