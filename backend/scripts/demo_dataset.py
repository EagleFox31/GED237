"""Generate the demo corpus (DOCS/exploitation/donnees-demo.md, spec gestion-projet/innovateur/jeu-donnees-demo.md).

    python scripts/demo_dataset.py --out /e2e-data/demo-import --manifest /e2e-data/demo-manifest.json --check

Writes ``<out>/{DRH,DAF,DSI,MINESUP,live,versions}/`` and computes the ``expected`` section of the
manifest from the generated filenames, with the same matching helpers the classification engine
uses (keywords OR, accents and case ignored, MIME aliases, year from filename). The output is a
pure function of ``GED_EXPORT_SEED`` (default 237): a second run rewrites byte-identical files.

``--check`` (default) fails when the versioned manifest differs from what the generator computes;
``--write`` rewrites the manifest (corpus and expected sections) instead.

Names, noise and helpers come from test_real_export_v2.py; reportlab/python-docx/openpyxl are not
in the backend image, so the files are written here with Pillow, zipfile and a minimal PDF writer.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import random
import re
import shutil
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image, ImageDraw  # noqa: E402

import test_real_export_v2 as v2  # noqa: E402
from app.services.classification_rule_engine import (  # noqa: E402
    ClassificationRuleEngine,
)

SEED = int(os.getenv("GED_EXPORT_SEED", "237"))
YEARS = (2024, 2025)
FIXED_DATE = (2026, 1, 1, 0, 0, 0)
PDF_DATE = "D:20260101000000Z"
UNIT = {
    "DRH": "MINFI-DRH",
    "DAF": "MINFI-DAF",
    "DSI": "MINFI-DSI",
    "MINESUP": "MINESUP-DAAJ",
}
FOLDERS = ("DRH", "DAF", "DSI", "MINESUP")

MIME = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "png": "image/png",
}
# PDF 70 % (40 text, 30 image), DOCX 15, XLSX 10, PNG 5 (spec § 3).
FORMATS = ["pdf_text", "pdf_image", "docx", "xlsx", "png"]
FORMAT_WEIGHTS = [40, 30, 15, 10, 5]

# Filename phrases per family. Each family is designed to hit one rule (or none); the
# expected status is nevertheless computed from the final filename, never assumed.
PHRASES: dict[str, list[str]] = {
    "paie": [
        "bulletin de paie",
        "bulletin de salaire",
        "fiche de paie",
        "etat de salaire",
    ],
    "contrats": [
        "contrat cdi",
        "contrat cdd",
        "arrete de nomination",
        "decision avancement",
        "arrete",
    ],
    "formation": ["attestation formation", "seminaire", "atelier", "plan de formation"],
    "factures": ["facture", "devis", "proforma", "facture fournisseur"],
    "engagements": [
        "mandat de paiement",
        "engagement budgetaire",
        "bon de commande",
        "ordonnancement",
    ],
    "marches": ["marche", "appel d offres", "dao", "pv ouverture des plis"],
    "maintenance": [
        "contrat de maintenance",
        "maintenance serveurs",
        "contrat maintenance onduleur",
    ],
    "incidents": ["incident", "ticket", "fiche intervention", "panne"],
    "courrier": ["courrier", "lettre", "correspondance", "note de service"],
    "rapports": ["rapport financier", "bilan", "etat financier"],
    "licences": ["licence", "inventaire equipements", "procedure"],
    "juridique": ["convention", "avis juridique", "circulaire"],
    "sans_mot_cle": [
        "scan",
        "document",
        "piece jointe",
        "annexe",
        "fichier",
        "numerisation",
    ],
}
PDF_ONLY = {"courrier"}  # rule 09 requires MIME application/pdf

# Corpus plan (spec § 3): family -> count per folder, plus byte-for-byte duplicates.
PLAN: dict[str, dict[str, int]] = {
    "DRH": {
        "paie": 42,
        "contrats": 42,
        "formation": 32,
        "courrier": 22,
        "sans_mot_cle": 8,
        "_dup": 4,
    },
    "DAF": {
        "factures": 52,
        "engagements": 42,
        "marches": 31,
        "courrier": 20,
        "rapports": 15,
        "sans_mot_cle": 4,
        "_dup": 5,
    },
    "DSI": {
        "maintenance": 28,
        "incidents": 28,
        "courrier": 18,
        "sans_mot_cle": 6,
        "licences": 7,
        "_dup": 3,
    },
    "MINESUP": {"juridique": 10},
}
SPECIAL = {
    "DAF": ["contrat maintenance climatiseurs 2025"]
}  # shown in P6 (no rule for DAF)
LIVE = {"new": 28, "dup": 2}
TRASH = 8  # of which 2 "facture" documents (keyword of the P5 search)
LOCKS = 3  # DAF documents, locked by MGR001
VERSIONS = 5
VERSIONED_FAMILIES = {
    "factures",
    "engagements",
    "marches",
}  # rules 05-07, no source restriction

# Keyword-safe noise: v2 suffixes "2024"/"2025" would change the year read from the filename.
NOISE_SUFFIXES = [s for s in v2.NOISE_SUFFIXES if not re.fullmatch(r"\d{4}", s)]


# --- deterministic file writers --------------------------------------------------------------


def pdf_text(title: str, lines: list[str]) -> bytes:
    def esc(text: str) -> bytes:
        return (
            text.encode("latin-1", "replace")
            .replace(b"\\", b"\\\\")
            .replace(b"(", b"\\(")
            .replace(b")", b"\\)")
        )

    content = b"BT /F1 14 Tf 72 740 Td (" + esc(title) + b") Tj ET\n"
    y = 710
    for line in lines:
        content += b"BT /F1 11 Tf 72 %d Td (" % y + esc(line) + b") Tj ET\n"
        y -= 16
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length "
        + str(len(content)).encode()
        + b" >>\nstream\n"
        + content
        + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for index, obj in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(b"%d 0 obj\n" % index + obj + b"\nendobj\n")
    xref = out.tell()
    out.write(b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1))
    for offset in offsets:
        out.write(b"%010d 00000 n \n" % offset)
    out.write(
        b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n"
        % (len(objects) + 1, xref)
    )
    return out.getvalue()


def _render_image(title: str, lines: list[str]) -> Image.Image:
    image = Image.new("L", (1240, 1754), 255)  # A4 at 150 dpi
    draw = ImageDraw.Draw(image)
    draw.rectangle([80, 80, 1160, 160], outline=0, width=3)
    draw.text((100, 110), title, fill=0)
    y = 220
    for line in lines:
        draw.text((100, y), line, fill=0)
        y += 30
    return image


def pdf_image(title: str, lines: list[str]) -> bytes:
    out = io.BytesIO()
    _render_image(title, lines).save(
        out, "PDF", creationDate=PDF_DATE, modDate=PDF_DATE
    )
    return out.getvalue()


def png(title: str, lines: list[str]) -> bytes:
    out = io.BytesIO()
    _render_image(title, lines).save(out, "PNG")
    return out.getvalue()


def _ooxml(parts: dict[str, str]) -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, body in parts.items():
            info = zipfile.ZipInfo(name, date_time=FIXED_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, body.encode("utf-8"))
    return out.getvalue()


def _xml(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def docx(title: str, lines: list[str]) -> bytes:
    paragraphs = "".join(
        f'<w:p><w:r><w:t xml:space="preserve">{_xml(t)}</w:t></w:r></w:p>'
        for t in [title, *lines]
    )
    return _ooxml(
        {
            "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            "</Types>",
            "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            "</Relationships>",
            "word/document.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            f"<w:body>{paragraphs}</w:body></w:document>",
        }
    )


def xlsx(title: str, lines: list[str]) -> bytes:
    rows = "".join(
        f'<row r="{i}"><c r="A{i}" t="inlineStr"><is><t>{_xml(t)}</t></is></c></row>'
        for i, t in enumerate([title, *lines], start=1)
    )
    return _ooxml(
        {
            "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            "</Types>",
            "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            "</Relationships>",
            "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Feuil1" sheetId="1" r:id="rId1"/></sheets></workbook>',
            "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            "</Relationships>",
            "xl/worksheets/sheet1.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f"<sheetData>{rows}</sheetData></worksheet>",
        }
    )


WRITERS = {
    "pdf_text": pdf_text,
    "pdf_image": pdf_image,
    "docx": docx,
    "xlsx": xlsx,
    "png": png,
}
EXTENSION = {
    "pdf_text": "pdf",
    "pdf_image": "pdf",
    "docx": "docx",
    "xlsx": "xlsx",
    "png": "png",
}


# --- corpus plan -----------------------------------------------------------------------------


def _stem(rng: random.Random, phrase: str, year: int) -> str:
    severity = rng.choices([0, 1, 2, 3], weights=v2.NOISE_LEVEL_WEIGHTS)[0]
    alias = v2.build_employee_alias(rng, severity)
    fragments: list[str] = []
    if severity >= 2 and rng.random() < 0.5:
        fragments.append(rng.choice(v2.NOISE_PREFIXES))
    fragments.append(phrase)
    fragments.append(alias)
    if severity >= 2:
        suffix = rng.choice(NOISE_SUFFIXES)
    joiner = rng.choice([" ", "_", " - "])
    # The engine reads the year with a word-bounded (19|20)dd regex and "_" is a word character: next to an
    # underscore the year is missed and the current year is used instead (date-dependent).
    around_year = "-" if joiner == "_" else joiner
    name = joiner.join(fragments) + around_year + str(year)
    if severity >= 2:
        name += around_year + suffix
    return v2.sanitize_filename(name)


def build_corpus(seed: int = SEED) -> list[dict]:
    """One entry per file: folder, name, family, format, year, bytes, dup_of."""
    rng = random.Random(seed)
    entries: list[dict] = []
    for folder in FOLDERS:
        plan = PLAN[folder]
        used: set[str] = set()
        originals: list[dict] = []
        families = [
            (family, count)
            for family, count in plan.items()
            if not family.startswith("_")
        ]
        for family, count in families:
            for _ in range(count):
                fmt = (
                    "pdf_text"
                    if family in PDF_ONLY and rng.random() < 0.6
                    else (
                        "pdf_image"
                        if family in PDF_ONLY
                        else rng.choices(FORMATS, weights=FORMAT_WEIGHTS)[0]
                    )
                )
                year = rng.choice(YEARS)
                stem = _unique(_stem(rng, rng.choice(PHRASES[family]), year), used)
                entry = _entry(folder, stem, family, fmt, year)
                entries.append(entry)
                originals.append(entry)
        for phrase in SPECIAL.get(folder, []):
            fmt = "pdf_text"
            entry = _entry(folder, phrase, "special", fmt, 2025)
            entries.append(entry)
            originals.append(entry)
        shuffled = entries[-len(originals) :]
        rng.shuffle(shuffled)
        entries[-len(originals) :] = shuffled
        for index in range(plan.get("_dup", 0)):
            source = originals[rng.randrange(len(originals))]
            stem = _unique(
                f"{rng.choice(['copie de', 'Copie', 'doublon'])} {Path(source['name']).stem}",
                used,
            )
            entries.append(
                {
                    **source,
                    "name": f"{stem}.{Path(source['name']).suffix[1:]}",
                    "family": "_dup",
                    "dup_of": f"{source['folder']}/{source['name']}",
                }
            )
    # live/: 28 new files across the families, 2 byte copies of imported files
    used = set()
    live_families = [f for f in PHRASES if f not in {"juridique", "sans_mot_cle"}]
    for index in range(LIVE["new"]):
        family = live_families[index % len(live_families)]
        fmt = (
            "pdf_text"
            if family in PDF_ONLY
            else rng.choices(FORMATS, weights=FORMAT_WEIGHTS)[0]
        )
        year = rng.choice(YEARS)
        stem = _unique(_stem(rng, rng.choice(PHRASES[family]), year), used)
        entries.append(_entry("live", stem, family, fmt, year))
    imported = [
        e for e in entries if e["folder"] in ("DRH", "DAF") and not e.get("dup_of")
    ]
    for _ in range(LIVE["dup"]):
        source = imported[rng.randrange(len(imported))]
        entries.append(
            {
                **source,
                "folder": "live",
                "name": f"depot {source['name']}",
                "family": "_dup",
                "dup_of": f"{source['folder']}/{source['name']}",
            }
        )
    # versions/: a second, different file for VERSIONS imported documents (title = stem). Only
    # families that a DAF rule classifies: an item left for review has no document to version.
    candidates = [
        e
        for e in entries
        if e["folder"] == "DAF"
        and e["format"] == "pdf_text"
        and not e.get("dup_of")
        and e["family"] in VERSIONED_FAMILIES
    ]
    for entry in candidates[:VERSIONS]:
        entries.append(
            {
                **entry,
                "folder": "versions",
                "family": "_version",
                "dup_of": None,
                "content": WRITERS["pdf_text"](
                    Path(entry["name"]).stem,
                    ["Version 2 - corrige", f"Annee {entry['year']}"],
                ),
            }
        )
    return entries


def _unique(stem: str, used: set[str]) -> str:
    candidate, counter = stem, 1
    while candidate.lower() in used:
        counter += 1
        candidate = f"{stem} ({counter})"
    used.add(candidate.lower())
    return candidate


def _entry(folder: str, stem: str, family: str, fmt: str, year: int) -> dict:
    name = f"{stem}.{EXTENSION[fmt]}"
    lines = [
        f"Service : {UNIT.get(folder, folder)}",
        f"Annee : {year}",
        f"Reference : {v2.stable_suffix(f'{folder}/{name}')}",
    ]
    return {
        "folder": folder,
        "name": name,
        "family": family,
        "format": fmt,
        "year": year,
        "dup_of": None,
        "content": WRITERS[fmt](stem, lines),
    }


# --- expected --------------------------------------------------------------------------------


def _ancestors(unit_code: str) -> set[str]:
    # closure: the unit itself and its parents (seed_db: MINFI-CAB > MINFI-SG > directions)
    chain = {
        "MINFI-DRH": ["MINFI-SG", "MINFI-CAB"],
        "MINFI-DAF": ["MINFI-SG", "MINFI-CAB"],
        "MINFI-DSI": ["MINFI-SG", "MINFI-CAB"],
        "MINESUP-DAAJ": ["MINESUP-CAB"],
    }
    return {unit_code, *chain.get(unit_code, [])}


def predict(
    rules: list[dict], path: str, mime: str, source_unit: str, tenant: str
) -> dict:
    """Same decision as ClassificationRuleEngine for an import item (filename = relative path)."""
    matches = []
    for rule in sorted(rules, key=lambda r: r["priority"]):
        if not rule.get("isActive", True) or rule.get("tenant", "MINFI") != tenant:
            continue
        if rule.get(
            "filenamePattern"
        ) and not ClassificationRuleEngine._matches_filename_pattern(
            path, rule["filenamePattern"]
        ):
            continue
        if rule.get(
            "mimeTypePattern"
        ) and not ClassificationRuleEngine._matches_mime_type(
            mime, rule["mimeTypePattern"]
        ):
            continue
        units = rule.get("sourceOrgUnits") or []
        if units and not _ancestors(source_unit).intersection(units):
            continue
        matches.append(rule)
    if not matches:
        return {
            "status": "needs_review",
            "orgUnit": None,
            "domain": None,
            "activity": None,
            "year": None,
            "rule": None,
        }
    if len(matches) > 1 and matches[0]["priority"] == matches[1]["priority"]:
        return {
            "status": "needs_review",
            "orgUnit": None,
            "domain": None,
            "activity": None,
            "year": None,
            "rule": None,
        }
    rule = matches[0]
    year_match = re.search(r"\b(19|20)\d{2}\b", path)
    year = (
        int(year_match.group(0))
        if (rule.get("yearStrategy") == "from_filename" and year_match)
        else None
    )
    return {
        "status": "classified",
        "orgUnit": rule.get("targetOrgUnit") or source_unit,
        "domain": rule["domain"],
        "activity": rule["activity"],
        "year": year,
        "rule": rule["code"],
    }


def compute_expected(manifest: dict, entries: list[dict]) -> dict:
    for rule in manifest["rules"]:
        # the API stores codes as lower-case [a-z0-9_]; the manifest uses that form so both sides compare as-is
        if not re.fullmatch(r"[a-z0-9_]+", rule["code"]):
            raise SystemExit(
                f"rule code {rule['code']!r}: use the stored form (lower-case, [a-z0-9_])"
            )
    rules = manifest["rules"]
    files: list[dict] = []
    seen: set[str] = set()
    for entry in entries:
        if entry["folder"] not in FOLDERS:
            continue
        path = f"{entry['folder']}/{entry['name']}"
        digest = hashlib.sha256(entry["content"]).hexdigest()
        if digest in seen:
            files.append(
                {
                    "path": path,
                    "status": "duplicate",
                    "orgUnit": None,
                    "domain": None,
                    "activity": None,
                    "year": None,
                }
            )
            continue
        seen.add(digest)
        tenant = "MINESUP" if entry["folder"] == "MINESUP" else "MINFI"
        verdict = predict(
            rules, path, MIME[EXTENSION[entry["format"]]], UNIT[entry["folder"]], tenant
        )
        verdict.pop("rule")
        if verdict["status"] == "classified" and verdict["year"] is None:
            raise SystemExit(
                f"{path}: no year readable by the engine (it would fall back to the current year)"
            )
        files.append({"path": path, **verdict})

    by_unit: dict[str, dict[str, int]] = {}
    for entry in files:
        if entry["status"] == "duplicate":
            continue
        # a classified document lands in its rule's target unit; a review stays on the import's target unit
        unit = (
            entry["orgUnit"]
            if entry["status"] == "classified"
            else UNIT[entry["path"].split("/", 1)[0]]
        )
        bucket = by_unit.setdefault(unit, {"total": 0, "classified": 0, "toReview": 0})
        bucket["total"] += 1
        bucket["classified" if entry["status"] == "classified" else "toReview"] += 1
    documents = {
        "total": sum(b["total"] for b in by_unit.values()),
        "classified": sum(b["classified"] for b in by_unit.values()),
        "toReview": sum(b["toReview"] for b in by_unit.values()),
    }

    def titles(folder: str, status: str, n: int, pred=lambda e: True) -> list[str]:
        return [
            Path(e["path"]).stem
            for e in files
            if e["path"].startswith(folder + "/") and e["status"] == status and pred(e)
        ][:n]

    facture = titles("DAF", "classified", 2, lambda e: "facture" in e["path"].lower())
    trash = (
        facture
        + [t for t in titles("DRH", "classified", TRASH) if t not in facture][
            : TRASH - len(facture)
        ]
    )
    locks = [t for t in titles("DAF", "classified", LOCKS + 2) if t not in trash][
        :LOCKS
    ]
    versions = {Path(e["name"]).stem: 2 for e in entries if e["folder"] == "versions"}
    live = [e for e in entries if e["folder"] == "live"]
    return {
        "domains": [d["code"] for d in manifest["classification"]["domains"]],
        "activities": [
            a["code"]
            for d in manifest["classification"]["domains"]
            for a in d["activities"]
        ],
        "classificationRules": [r["code"] for r in rules],
        "inactiveRules": [r["code"] for r in rules if not r.get("isActive", True)],
        "counting": {  # read by the e2e counters (spec #65): an item to review is not a document
            "classified": "documents created at commit (list, search, trash, locks, versions act on these)",
            "toReview": "open classification reviews (review screen); no document until the review is resolved",
            "total": "classified + toReview",
        },
        "documents": documents,
        "byOrgUnit": by_unit,
        "imports": {
            "jobs": len(FOLDERS),
            "duplicates": sum(1 for e in files if e["status"] == "duplicate"),
        },
        "trash": trash,
        "locks": {"MGR001": locks},
        "versions": versions,
        "live": {
            "files": len(live),
            "new": sum(1 for e in live if not e.get("dup_of")),
            "duplicates": sum(1 for e in live if e.get("dup_of")),
        },
        "files": files,
    }


# --- entry point -----------------------------------------------------------------------------


def write_corpus(out: Path, entries: list[dict]) -> dict[str, str]:
    """Rewrite <out> from scratch; returns path -> sha256."""
    for child in out.iterdir() if out.exists() else []:
        if child.is_dir():
            shutil.rmtree(child)
        elif child.name != ".gitkeep":
            child.unlink()
    digests: dict[str, str] = {}
    for entry in entries:
        target = out / entry["folder"] / entry["name"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(entry["content"])
        digests[f"{entry['folder']}/{entry['name']}"] = hashlib.sha256(
            entry["content"]
        ).hexdigest()
    return digests


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--out", required=True, help="demo-import directory (rewritten)"
    )
    parser.add_argument("--manifest", required=True, help="demo-manifest.json")
    parser.add_argument(
        "--write",
        action="store_true",
        help="update the manifest instead of checking it",
    )
    args = parser.parse_args()

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    entries = build_corpus(SEED)
    digests = write_corpus(Path(args.out), entries)
    expected = compute_expected(manifest, entries)
    corpus = {
        "seed": SEED,
        "generator": "backend/scripts/demo_dataset.py",
        "files": len(digests),
        "sha256": hashlib.sha256(
            "".join(f"{k}:{v}\n" for k, v in sorted(digests.items())).encode()
        ).hexdigest(),
    }
    print(
        f"corpus: {len(digests)} files in {args.out} (seed {SEED}, corpus sha256 {corpus['sha256'][:12]})"
    )
    print(
        f"expected: {expected['documents']} duplicates={expected['imports']['duplicates']} live={expected['live']}"
    )

    if args.write:
        manifest["corpus"] = corpus
        manifest["expected"] = expected
        Path(args.manifest).write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"manifest updated: {args.manifest}")
        return 0
    drift = []
    if manifest.get("corpus") != corpus:
        drift.append("corpus")
    if manifest.get("expected") != expected:
        drift.append("expected")
    if drift:
        print(
            f"ERROR: {args.manifest} differs from the generated {', '.join(drift)} (run with --write)"
        )
        return 1
    print("manifest matches the generated corpus")
    return 0


if __name__ == "__main__":
    sys.exit(main())
