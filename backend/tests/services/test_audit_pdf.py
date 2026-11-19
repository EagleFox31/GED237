"""Audit journal PDF renderer (L7-2): pure functions, no database."""

import io

from pypdf import PdfReader

from app.services.audit_pdf import CELL_MAX_CHARS, content_digest, render_audit_pdf

COLUMNS = (
    "Date",
    "Matricule",
    "Utilisateur",
    "Objet",
    "Ressource",
    "Action",
    "Détail",
    "IP",
)
ROW = [
    "06/11/2026 00:30:00",
    "M1",
    "Awa Ndi",
    "Documents",
    "Note",
    "Création",
    "ok",
    "10.0.0.7",
]


def _render(rows, footer="pied") -> bytes:
    return render_audit_pdf(
        title="Journal d'audit",
        meta=[("Période", "Tout le journal")],
        columns=COLUMNS,
        rows=rows,
        footer=footer,
    )


def _text(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    return " ".join(" ".join(page.extract_text() for page in reader.pages).split())


def test_same_input_gives_the_same_bytes():
    assert _render([ROW]) == _render([ROW])


def test_data_digest_is_canonical_and_follows_the_data():
    digest = content_digest(
        COLUMNS, [ROW], {"action": "create", "date_from": "2026-11-01"}
    )

    assert digest == content_digest(
        COLUMNS, [tuple(ROW)], {"date_from": "2026-11-01", "action": "create"}
    )
    assert digest != content_digest(COLUMNS, [ROW], {"action": "create"})
    assert digest != content_digest(COLUMNS, [ROW[:-1] + ["10.0.0.8"]], {})


def test_long_text_is_cut_instead_of_breaking_the_page():
    huge = "mot " * 5_000

    text = _text(_render([ROW[:-2] + [huge, "10.0.0.7"]]))

    assert "…" in text
    assert text.count("mot") < CELL_MAX_CHARS


def test_many_rows_repeat_the_header_on_each_page():
    content = _render([ROW] * 300, footer="Journal exporté")
    reader = PdfReader(io.BytesIO(content))

    assert len(reader.pages) > 1
    for number, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text()
        assert "Matricule" in page_text
        assert f"Page {number}" in page_text and "Journal exporté" in page_text


def test_no_row_prints_a_plain_sentence_and_markup_is_escaped():
    assert "Aucune ligne pour ces filtres." in _text(_render([]))
    assert "<b>x</b> & y" in _text(_render([ROW[:-2] + ["<b>x</b> & y", "10.0.0.7"]]))
