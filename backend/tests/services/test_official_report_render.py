"""Rendering of official reports, without database."""

import io

from pypdf import PdfReader

from app.services.official_report import (
    build_sections,
    content_digest,
    format_number,
    render,
    render_csv,
    render_html,
    render_pdf,
)

HEADER = {"title": "Rapport officiel – Test", "number": "N° 0007/2026/MINX"}


def test_sections_from_scalars_lists_and_nested_objects():
    data = {
        "total_active_documents": 3,
        "availability": {"by_status": True},
        "by_status": [{"key": "draft", "label": "Brouillon", "value": 2}],
        "signals": {"documents_needing_review": 1},
        "services": [],
    }
    sections = build_sections(data)
    assert [section.title for section in sections] == [
        "Synthèse",
        "Par statut",
        "Points d'attention",
        "Services",
    ]
    assert sections[0].rows == (("Documents actifs", "3"),)
    assert sections[1].headers == ("Code", "Libellé", "Valeur")
    assert sections[1].rows == (("draft", "Brouillon", "2"),)
    assert sections[3].rows == ()


def test_csv_cells_cannot_run_as_formulas():
    data = {"by_org_unit": [{"key": "u1", "label": "=HYPERLINK(1)", "value": 1}]}
    text = render_csv(HEADER, build_sections(data)).decode("utf-8")
    assert "u1;'=HYPERLINK(1);1" in text
    assert "=HYPERLINK" not in text.replace("'=HYPERLINK", "")


def test_floats_use_a_decimal_comma_and_empty_tables_say_so():
    data = {"average_workflow_days": 2.5, "services": []}
    text = render_csv(HEADER, build_sections(data)).decode("utf-8")
    assert "Durée moyenne des circuits (jours);2,50" in text
    assert "Aucune donnée" in text


def test_html_escapes_text():
    data = {"by_status": [{"key": "x", "label": "<script>", "value": 1}]}
    page = render_html(HEADER, build_sections(data)).decode("utf-8")
    assert "<script>" not in page
    assert "&lt;script&gt;" in page


def test_rendering_is_deterministic():
    data = {"total_services": 2, "services": [{"id": "a", "label": "S", "value": 1}]}
    assert render_csv(HEADER, build_sections(data)) == render_csv(
        HEADER, build_sections(data)
    )
    assert content_digest("k", {"a": 1}, data) == content_digest("k", {"a": 1}, data)
    assert content_digest("k", {"a": 1}, data) != content_digest("k", {"a": 2}, data)


def test_number_format():
    assert format_number(1, 2026, "MINX") == "N° 0001/2026/MINX"
    assert format_number(12345, 2027, "MINX") == "N° 12345/2027/MINX"
    assert format_number(12, 2026, "MINX", "DRH") == "N° 0012/2026/MINX/DRH"


def _pdf_text(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    return "\n".join(page.extract_text() for page in reader.pages)


def test_pdf_carries_the_header_and_every_table():
    header = {
        **HEADER,
        "institution": "Ministère X",
        "unit": "Direction des études",
        "period": "Du 01/11/2026 au 17/11/2026",
    }
    data = {
        "total_active_documents": 3,
        "by_status": [{"key": "x", "label": "<b>Été</b> & co", "value": 1}],
        "services": [],
    }
    content = render_pdf(header, build_sections(data))
    assert content.startswith(b"%PDF-")
    text = _pdf_text(content)
    for expected in (
        "Rapport officiel",
        "N° 0007/2026/MINX",  # body and every page footer
        "Ministère X",
        "Direction des études",
        "Documents actifs",
        "Par statut",
        "<b>Été</b> & co",  # shown as typed, not read as markup
        "Aucune donnée",
        "Page 1",
    ):
        assert expected in text, expected


def test_pdf_is_deterministic_and_long_tables_span_pages():
    rows = [{"key": f"k{i}", "label": f"Service {i}", "value": i} for i in range(150)]
    data = {"by_org_unit": rows}
    first = render_pdf(HEADER, build_sections(data))
    assert first == render_pdf(HEADER, build_sections(data))
    reader = PdfReader(io.BytesIO(first))
    assert len(reader.pages) > 1
    # The column titles come back on every page.
    assert all("Libellé" in page.extract_text() for page in reader.pages)
    assert "Service 149" in _pdf_text(first)


def test_render_dispatches_on_the_format():
    data = {"total_services": 1}
    assert render(HEADER, data, "pdf").startswith(b"%PDF-")
    assert render(HEADER, data, "html").startswith(b"<!doctype html>")
    assert render(HEADER, data, "csv").startswith("﻿".encode("utf-8"))
