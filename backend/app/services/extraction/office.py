"""Text of Word and Excel files (.docx, .xlsx), read straight from the file (no OCR).

Contract with the OCR task: returns non-empty text, or raises ``OfficeExtractionError``
whose ``reason`` uses the same codes as the task's failure states (``no_text``,
``unsupported_format``, ``engine_error``). Never returns "".

Files come from users, so every read is bounded:
- archive: file size, declared uncompressed size, entry count, and the size and
  compression ratio of each XML part are checked before any parsing (zip bomb, memory of
  the worker). zipfile never inflates an entry past its declared size;
- XML: python-docx parses with ``resolve_entities=False``; openpyxl switches to defusedxml
  when it is installed (pinned in requirements.txt);
- work: a cell budget for spreadsheets and a time budget, checked between paragraphs and
  rows (a single parse is bounded by the archive caps);
- result: a character cap, well under PostgreSQL's 1 MB tsvector limit.
"""

from __future__ import annotations

import datetime as dt
import logging
import os
import time
import zipfile
from collections.abc import Iterator
from contextlib import closing

from .formats import DOCX_MIME_TYPE, XLSX_MIME_TYPE

logger = logging.getLogger(__name__)

# Caps sized for administrative files: a 50 MB .docx is already image-heavy, and the text
# of a 500-page report is about 1.5 M characters, so 500 k characters keeps the searchable
# part of anything realistic while staying far from the tsvector limit.
MAX_FILE_BYTES = 50 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024
# XML parts are parsed into a tree (python-docx) or style and string tables (openpyxl):
# dense XML takes about 11 times its size in memory. The worker runs one child that also
# holds the OCR models (~1.3 GB) under a 2 GB limit. Measured worst case at these caps
# (dense, varied XML, every part just under its cap): see the PR of this change.
MAX_XML_PART_BYTES = 10 * 1024 * 1024
MAX_XML_TOTAL_BYTES = 30 * 1024 * 1024
# Real Office XML compresses about 5 to 30 times; far beyond is a crafted file.
MAX_XML_COMPRESSION_RATIO = 100
XML_RATIO_FLOOR_BYTES = 1024 * 1024  # small parts may compress well; ignore their ratio
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
            content_types = _content_types(archive)
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
    xml_entries = [e for e in entries if _may_be_parsed(e.filename, content_types)]
    if sum(entry.file_size for entry in xml_entries) > MAX_XML_TOTAL_BYTES:
        raise OfficeExtractionError(
            ENGINE_ERROR,
            f"more than {MAX_XML_TOTAL_BYTES // 2**20} MB of XML once uncompressed",
        )
    for entry in xml_entries:
        if entry.file_size > MAX_XML_PART_BYTES:
            raise OfficeExtractionError(
                ENGINE_ERROR,
                f"part {entry.filename} is more than "
                f"{MAX_XML_PART_BYTES // 2**20} MB once uncompressed",
            )
        if (
            entry.file_size > XML_RATIO_FLOOR_BYTES
            and entry.file_size
            > MAX_XML_COMPRESSION_RATIO * max(entry.compress_size, 1)
        ):
            raise OfficeExtractionError(
                ENGINE_ERROR,
                f"part {entry.filename} is compressed more than "
                f"{MAX_XML_COMPRESSION_RATIO}:1",
            )


# Only these content types are kept as bytes by python-docx and openpyxl, never parsed.
_UNPARSED_TYPE_PREFIXES = ("image/", "audio/", "video/", "font/")
_UNPARSED_TYPES = frozenset(
    {
        "application/vnd.openxmlformats-officedocument.oleobject",
        "application/vnd.openxmlformats-officedocument.obfuscatedfont",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.printersettings",
        "application/vnd.ms-office.vbaproject",
        "application/octet-stream",
    }
)
_CONTENT_TYPES_PART = "[Content_Types].xml"


def _content_types(archive: zipfile.ZipFile) -> tuple[dict[str, str], dict[str, str]]:
    """(overrides by part name, defaults by extension), lowercased, from the package's
    [Content_Types].xml; empty when missing or unreadable, so every part counts as XML."""
    from defusedxml.ElementTree import fromstring

    try:
        info = archive.getinfo(_CONTENT_TYPES_PART)
    except KeyError:
        return {}, {}
    if info.file_size > MAX_XML_PART_BYTES:
        return {}, {}  # refused by the per-part cap below
    try:
        root = fromstring(archive.read(info))
    except Exception:  # damaged or hostile: no exemption at all
        return {}, {}
    overrides: dict[str, str] = {}
    defaults: dict[str, str] = {}
    for element in root:
        tag = element.tag.rsplit("}", 1)[-1]
        kind = (element.get("ContentType") or "").lower()
        if tag == "Override" and element.get("PartName"):
            overrides[element.get("PartName").lstrip("/").lower()] = kind
        elif tag == "Default" and element.get("Extension"):
            defaults[element.get("Extension").lower()] = kind
    return overrides, defaults


def _may_be_parsed(name: str, content_types: tuple[dict, dict]) -> bool:
    """Held to the XML caps unless the package declares a binary type for the part.

    Decided on the declared content type, as the readers do, not on the file name:
    a part renamed .dat or .XML is still parsed if declared as XML. A part with no
    declared type is held to the caps too (default deny)."""
    overrides, defaults = content_types
    lowered = name.lower()
    kind = overrides.get(lowered)
    if kind is None:
        extension = (
            lowered.rsplit(".", 1)[-1] if "." in lowered.rsplit("/", 1)[-1] else ""
        )
        kind = defaults.get(extension)
    if kind is None:
        return True
    return not (kind.startswith(_UNPARSED_TYPE_PREFIXES) or kind in _UNPARSED_TYPES)


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
                    logger.info(
                        "Spreadsheet text cut at %s cells (sheet %r)",
                        MAX_CELLS,
                        sheet.title,
                    )
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
