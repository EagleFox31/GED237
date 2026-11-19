"""Audit journal as an official PDF (L7-2): printable copy with a SHA-256 fingerprint.

Pure functions, no database: the endpoint passes the rows it already built for the CSV.
Two fingerprints, both written to the export's own audit row:

* ``content_digest``: hash of the exported data (columns, rows, filters), printed in the PDF;
  the same data always gives the same value, whatever the layout.
* the file hash (SHA-256 of the returned bytes), sent in ``X-Report-SHA256``. It cannot be
  printed in the file it hashes, so the PDF says where to find it: in the journal.
"""

import hashlib
import html
import io
import json
from typing import Any, Sequence

# A cell taller than a page stops reportlab (LayoutError): long free text is cut,
# the CSV export keeps it whole.
CELL_MAX_CHARS = 300

# Landscape A4 is 297 mm wide; 10 mm margins leave 277 mm. Widths follow EXPORT_COLUMNS:
# Date, Matricule, Utilisateur, Objet, Ressource, Action, Détail, Adresse IP.
COLUMN_WIDTHS_MM = (32, 22, 38, 28, 50, 30, 52, 25)


def content_digest(
    columns: Sequence[str], rows: Sequence[Sequence[str]], filters: dict[str, Any]
) -> str:
    """SHA-256 of the exported data in a canonical form (key order and spacing fixed)."""
    canonical = json.dumps(
        {"columns": list(columns), "filters": filters, "rows": [list(r) for r in rows]},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _cut(value: str) -> str:
    return value if len(value) <= CELL_MAX_CHARS else value[: CELL_MAX_CHARS - 1] + "…"


def render_audit_pdf(
    *,
    title: str,
    meta: Sequence[tuple[str, str]],
    columns: Sequence[str],
    rows: Sequence[Sequence[str]],
    footer: str,
) -> bytes:
    """Landscape A4: title, a label/value block, then the journal table (header on each page).

    Built-in Helvetica (WinAnsi: French accents), no font file. ``invariant`` drops the
    creation date and random id, so the same input gives the same bytes.
    """
    # Imported here: only this format needs reportlab.
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table

    styles = getSampleStyleSheet()
    small = ParagraphStyle("cell", parent=styles["BodyText"], fontSize=7, leading=8.5)
    bold = ParagraphStyle("head", parent=small, fontName="Helvetica-Bold")
    label = ParagraphStyle(
        "label", parent=styles["BodyText"], fontName="Helvetica-Bold"
    )

    def para(value: str, style: ParagraphStyle) -> Paragraph:
        return Paragraph(html.escape(_cut(value or ""), quote=False), style)

    page = landscape(A4)
    story: list[Any] = [Paragraph(html.escape(title, quote=False), styles["Title"])]

    summary = Table(
        [[para(key, label), para(value, styles["BodyText"])] for key, value in meta],
        colWidths=[55 * mm, page[0] - 20 * mm - 55 * mm],
        hAlign="LEFT",
    )
    summary.setStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey)])
    story += [summary, Spacer(1, 5 * mm)]

    body = [[para(value, small) for value in row] for row in rows] or [
        [para("Aucune ligne pour ces filtres.", small)] + [""] * (len(columns) - 1)
    ]
    journal = Table(
        [[para(name, bold) for name in columns], *body],
        colWidths=[width * mm for width in COLUMN_WIDTHS_MM],
        repeatRows=1,
        hAlign="LEFT",
    )
    journal.setStyle(
        [
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eeeeee")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]
    )
    story.append(journal)

    def draw_footer(canvas, doc) -> None:
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.drawString(10 * mm, 7 * mm, footer)
        canvas.drawRightString(page[0] - 10 * mm, 7 * mm, f"Page {doc.page}")
        canvas.restoreState()

    buffer = io.BytesIO()
    SimpleDocTemplate(
        buffer,
        pagesize=page,
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=14 * mm,
        title=title,
        invariant=1,
    ).build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
    return buffer.getvalue()
