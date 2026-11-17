"""Rendering of official reports, without database."""

from app.services.official_report import (
    build_sections,
    content_digest,
    format_number,
    render_csv,
    render_html,
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
