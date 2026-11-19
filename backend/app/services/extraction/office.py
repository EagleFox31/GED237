"""Text of Word and Excel files (.docx, .xlsx), read straight from the file (no OCR).

Contract with the OCR task: returns non-empty text, or raises ``OfficeExtractionError``
whose ``reason`` uses the same codes as the task's failure states (``no_text``,
``unsupported_format``, ``engine_error``). Never returns "".

Files come from users, so every read is bounded:
- archive: file size, declared uncompressed size and entry count are checked before any
  parsing (zip bomb). zipfile never inflates an entry past its declared size;
- XML: python-docx parses with ``resolve_entities=False``; openpyxl switches to defusedxml
  when it is installed (pinned in requirements.txt);
- work: a cell budget for spreadsheets and a time budget, checked between paragraphs and
  rows (a single parse is bounded by the archive caps);
- result: a character cap, well under PostgreSQL's 1 MB tsvector limit.
"""

from __future__ import annotations

import datetime as dt
import os
import time
import zipfile
from collections.abc import Iterator
from contextlib import closing

from .formats import DOCX_MIME_TYPE, XLSX_MIME_TYPE

# Caps sized for administrative files: a 50 MB .docx is already image-heavy, and the text
# of a 500-page report is about 1.5 M characters, so 500 k characters keeps the searchable
# part of anything realistic while staying far from the tsvector limit.
MAX_FILE_BYTES = 50 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024
MAX_ENTRIES = 5_000
MAX_CELLS = 500_000
MAX_CHARS = 500_000
TIME_BUDGET_SECONDS = 60.0

NO_TEXT = "no_text"
UNSUPPORTED_FORMAT = "unsupported_format"
ENGINE_ERROR = "engine_error"


class OfficeExtractionError(Exception):
    def __init__(self, reason: str, detail: str):
        super().__init__(f"{reason}: {detail}")
        self.reason = reason


def extract_office_text(
    path: str, mime_type: str, *, time_budget: float = TIME_BUDGET_SECONDS
) -> str:
    readers = {DOCX_MIME_TYPE: _docx_lines, XLSX_MIME_TYPE: _xlsx_lines}
    reader = readers.get(mime_type)
    if reader is None:
        raise OfficeExtractionError(UNSUPPORTED_FORMAT, f"no reader for {mime_type}")
    _check_archive(path)

    deadline = time.monotonic() + time_budget
    parts: list[str] = []
    size = 0
    try:
        with closing(reader(path)) as lines:
            for line in lines:
                if time.monotonic() > deadline:
                    raise OfficeExtractionError(
                        ENGINE_ERROR, f"reading took more than {time_budget:g} s"
                    )
                line = line.strip()
                if not line:
                    continue
                parts.append(line)
                size += len(line) + 1
                if size >= MAX_CHARS:
                    break
    except OfficeExtractionError:
        raise
    except Exception as exc:  # any parser error: damaged file or unexpected content
        raise OfficeExtractionError(
            ENGINE_ERROR, f"unreadable file ({exc.__class__.__name__}: {exc})"
        ) from exc

    text = "\n".join(parts)[:MAX_CHARS]
    if not text:
        raise OfficeExtractionError(NO_TEXT, "the file contains no text")
    return text


def _check_archive(path: str) -> None:
    if os.path.getsize(path) > MAX_FILE_BYTES:
        raise OfficeExtractionError(
            ENGINE_ERROR, f"file larger than {MAX_FILE_BYTES // 2**20} MB"
        )
    try:
        with zipfile.ZipFile(path) as archive:
            entries = archive.infolist()
    except (zipfile.BadZipFile, OSError) as exc:
        raise OfficeExtractionError(
            ENGINE_ERROR, "not a valid Office file (damaged, or renamed)"
        ) from exc
    if len(entries) > MAX_ENTRIES:
        raise OfficeExtractionError(ENGINE_ERROR, f"more than {MAX_ENTRIES} parts")
    if sum(entry.file_size for entry in entries) > MAX_UNCOMPRESSED_BYTES:
        raise OfficeExtractionError(
            ENGINE_ERROR,
            f"more than {MAX_UNCOMPRESSED_BYTES // 2**20} MB once uncompressed",
        )


def _docx_lines(path: str) -> Iterator[str]:
    """Paragraphs and table rows, in document order."""
    from docx import Document as open_docx
    from docx.table import Table

    for block in open_docx(path).iter_inner_content():
        if isinstance(block, Table):
            yield from _table_lines(block)
        else:
            yield block.text


def _table_lines(table) -> Iterator[str]:
    for row in table.rows:
        seen: list = []  # a merged cell is returned once per grid column it spans
        texts: list[str] = []
        for cell in row.cells:
            if any(cell._tc is tc for tc in seen):
                continue
            seen.append(cell._tc)
            if cell.text.strip():
                texts.append(cell.text.strip())
        yield " | ".join(texts)


def _xlsx_lines(path: str) -> Iterator[str]:
    """Sheet names and rows of cached cell values (a formula gives its last result)."""
    from openpyxl import load_workbook

    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        cells = 0
        for sheet in workbook.worksheets:
            titled = (
                False  # a sheet name alone is not content: an empty sheet gives nothing
            )
            for row in sheet.iter_rows(values_only=True):
                cells += len(row)
                if cells > MAX_CELLS:
                    return
                line = " ".join(
                    text for text in map(_cell_text, row) if text and text.strip()
                )
                if line and not titled:
                    yield sheet.title
                    titled = True
                yield line
    finally:
        workbook.close()


def _cell_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, dt.datetime) and value.time() == dt.time():
        return value.date().isoformat()
    return str(value)
