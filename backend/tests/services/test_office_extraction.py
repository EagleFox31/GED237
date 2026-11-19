"""Text of Word and Excel files, read from real files built with the same libraries
users' files come from, plus the hostile cases the bounds exist for."""

import io
import zipfile

import openpyxl
import pytest
from docx import Document as WordDocument

from app.services.extraction import (
    DOCX_MIME_TYPE,
    XLSX_MIME_TYPE,
    has_text_reader,
)
from app.services.extraction import office
from app.services.extraction.office import OfficeExtractionError, extract_office_text


def _save_docx(tmp_path, build) -> str:
    document = WordDocument()
    build(document)
    path = tmp_path / "f.docx"
    document.save(path)
    return str(path)


def _save_xlsx(tmp_path, build) -> str:
    workbook = openpyxl.Workbook()
    build(workbook)
    path = tmp_path / "f.xlsx"
    workbook.save(path)
    return str(path)


def test_docx_paragraphs_and_tables_in_order(tmp_path):
    def build(document):
        document.add_paragraph("Décret portant nomination")
        table = document.add_table(rows=2, cols=2)
        table.cell(0, 0).text = "Matricule"
        table.cell(0, 1).text = "Nom"
        table.cell(1, 0).text = "MINFI001"
        table.cell(1, 1).text = "Mbarga"
        document.add_paragraph("Fait à Yaoundé")

    text = extract_office_text(_save_docx(tmp_path, build), DOCX_MIME_TYPE)
    assert text.splitlines() == [
        "Décret portant nomination",
        "Matricule | Nom",
        "MINFI001 | Mbarga",
        "Fait à Yaoundé",
    ]


def test_docx_merged_cell_is_read_once(tmp_path):
    def build(document):
        table = document.add_table(rows=1, cols=3)
        table.cell(0, 0).merge(table.cell(0, 1)).text = "Titre fusionné"
        table.cell(0, 2).text = "Fin"

    text = extract_office_text(_save_docx(tmp_path, build), DOCX_MIME_TYPE)
    assert text == "Titre fusionné | Fin"


def test_xlsx_sheets_rows_and_values(tmp_path):
    def build(workbook):
        sheet = workbook.active
        sheet.title = "Budget"
        sheet.append(["Rubrique", "Montant"])
        sheet.append(["Salaires", 1500000.0])
        sheet.append([None, None])
        other = workbook.create_sheet("Notes")
        other.append(["Révisé le", None, "x"])

    text = extract_office_text(_save_xlsx(tmp_path, build), XLSX_MIME_TYPE)
    assert text.splitlines() == [
        "Budget",
        "Rubrique Montant",
        "Salaires 1500000",
        "Notes",
        "Révisé le x",
    ]


def test_xlsx_cell_budget_stops_reading(tmp_path, monkeypatch):
    monkeypatch.setattr(office, "MAX_CELLS", 10)

    def build(workbook):
        for i in range(100):
            workbook.active.append([f"ligne{i}", "a", "b"])

    text = extract_office_text(_save_xlsx(tmp_path, build), XLSX_MIME_TYPE)
    assert "ligne0" in text and "ligne99" not in text


def test_text_is_capped(tmp_path, monkeypatch):
    monkeypatch.setattr(office, "MAX_CHARS", 50)

    def build(document):
        for _ in range(20):
            document.add_paragraph("mot " * 10)

    text = extract_office_text(_save_docx(tmp_path, build), DOCX_MIME_TYPE)
    assert 0 < len(text) <= 50


@pytest.mark.parametrize(
    "mime, build, save",
    [
        (DOCX_MIME_TYPE, lambda d: None, _save_docx),
        (XLSX_MIME_TYPE, lambda w: None, _save_xlsx),
    ],
)
def test_empty_file_raises_no_text(tmp_path, mime, build, save):
    with pytest.raises(OfficeExtractionError) as error:
        extract_office_text(save(tmp_path, build), mime)
    assert error.value.reason == "no_text"


def test_not_an_office_file_raises_engine_error(tmp_path):
    path = tmp_path / "fake.docx"
    path.write_bytes(b"%PDF-1.4 renamed")
    with pytest.raises(OfficeExtractionError) as error:
        extract_office_text(str(path), DOCX_MIME_TYPE)
    assert error.value.reason == "engine_error"


def test_zip_without_word_content_raises_engine_error(tmp_path):
    path = tmp_path / "plain.docx"
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("hello.txt", "hello")
    with pytest.raises(OfficeExtractionError) as error:
        extract_office_text(str(path), DOCX_MIME_TYPE)
    assert error.value.reason == "engine_error"


def test_unknown_mime_is_unsupported(tmp_path):
    with pytest.raises(OfficeExtractionError) as error:
        extract_office_text(str(tmp_path / "x"), "application/zip")
    assert error.value.reason == "unsupported_format"


def test_zip_bomb_is_refused_before_parsing(tmp_path, monkeypatch):
    monkeypatch.setattr(office, "MAX_UNCOMPRESSED_BYTES", 1024 * 1024)
    path = tmp_path / "bomb.docx"
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", b"0" * (5 * 1024 * 1024))
    assert path.stat().st_size < 100 * 1024  # tiny on disk, large once inflated
    with pytest.raises(OfficeExtractionError, match="uncompressed"):
        extract_office_text(str(path), DOCX_MIME_TYPE)


def test_too_many_parts_is_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(office, "MAX_ENTRIES", 5)
    path = tmp_path / "many.docx"
    with zipfile.ZipFile(path, "w") as archive:
        for i in range(10):
            archive.writestr(f"p{i}.xml", "x")
    with pytest.raises(OfficeExtractionError, match="parts"):
        extract_office_text(str(path), DOCX_MIME_TYPE)


def test_file_size_cap(tmp_path, monkeypatch):
    monkeypatch.setattr(office, "MAX_FILE_BYTES", 100)

    def build(document):
        document.add_paragraph("texte")

    with pytest.raises(OfficeExtractionError, match="larger"):
        extract_office_text(_save_docx(tmp_path, build), DOCX_MIME_TYPE)


def test_time_budget(tmp_path):
    def build(document):
        for i in range(50):
            document.add_paragraph(f"paragraphe {i}")

    path = _save_docx(tmp_path, build)
    with pytest.raises(OfficeExtractionError, match="took more than"):
        extract_office_text(path, DOCX_MIME_TYPE, time_budget=-1)


def test_external_entity_is_not_resolved(tmp_path):
    """An XML entity pointing at a local file must not leak into the text."""
    secret = tmp_path / "secret.txt"
    secret.write_text("TOP-SECRET-CONTENT")
    xml = (
        '<?xml version="1.0"?>'
        f'<!DOCTYPE d [<!ENTITY x SYSTEM "file://{secret.as_posix()}">]>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body><w:p><w:r><w:t>avant &x; apres</w:t></w:r></w:p></w:body></w:document>"
    )
    base = io.BytesIO()
    WordDocument().save(base)
    path = tmp_path / "xxe.docx"
    with zipfile.ZipFile(io.BytesIO(base.getvalue())) as source, zipfile.ZipFile(
        path, "w"
    ) as target:
        for item in source.infolist():
            data = source.read(item.filename)
            target.writestr(
                item.filename,
                xml.encode() if item.filename == "word/document.xml" else data,
            )
    try:
        text = extract_office_text(str(path), DOCX_MIME_TYPE)
    except OfficeExtractionError:
        return  # refused outright is also safe
    assert "TOP-SECRET-CONTENT" not in text


@pytest.mark.parametrize(
    "mime, expected",
    [
        ("application/pdf", True),
        ("image/png", True),
        (DOCX_MIME_TYPE, True),
        (XLSX_MIME_TYPE, True),
        ("application/zip", False),
        ("text/plain", False),
        ("application/msword", False),
        (None, False),
        ("", False),
    ],
)
def test_has_text_reader(mime, expected):
    assert has_text_reader(mime) is expected
