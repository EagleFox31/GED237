"""
Test Réel E2E : Génération de 500 vrais documents bruités + classement automatique par le moteur IFTTT.

Structure cible auto-générée dans le "serveur distant" :
    E:/tmp_remote_server/
    ├── RH/
    │   ├── 2024/
    │   └── 2025/
    ├── Finances/
    │   ├── 2024/
    │   └── 2025/
    ├── Juridique/
    ├── Informatique/
    ├── Direction/
    └── Autre/   <-- dossier créé automatiquement si aucune règle ne correspond

L'OCR simulé lit le CONTENU TEXTE réel des documents (pas juste le titre).
"""

import os
import sys
import shutil
import asyncio
import datetime
import csv
import hashlib
import random
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Dict, Any, List, Tuple

# Path setup pour les imports app
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# --- Bibliothèques pour créer de vrais fichiers binaires ---
try:
    import openpyxl
except ImportError:
    openpyxl = None

try:
    from docx import Document as DocxDocument
except ImportError:
    DocxDocument = None

try:
    from pptx import Presentation
    from pptx.util import Inches, Pt
except ImportError:
    Presentation = None
    Inches = None
    Pt = None

try:
    from fpdf import FPDF
except ImportError:
    FPDF = None

try:
    from reportlab.pdfgen import canvas
except ImportError:
    canvas = None

# === CONFIGURATION DU TEST ===
SOURCE_GED = Path("E:/tmp_ged_real_v2")  # Stockage GED interne
REMOTE_SERVER = Path("E:/tmp_remote_server_v2")  # Serveur distant
FALLBACK_FOLDER = "Autre"  # Dossier si aucune règle ne match
TOTAL_DOCUMENTS = int(os.getenv("GED_EXPORT_DOC_COUNT", "500"))
RANDOM_SEED = int(os.getenv("GED_EXPORT_SEED", "237"))
AMBIGUITY_RATE = float(os.getenv("GED_EXPORT_AMBIGUITY_RATE", "0.22"))
CSV_REPORT_PATH = SOURCE_GED / "classification_results.csv"

EMPLOYEE_NAMES = [
    "Jean Mbarga",
    "Alice Mvondo",
    "Patrick Nkom",
    "Lucie Ebang",
    "Armel Tcham",
    "Mireille Biloa",
    "Samuel Essono",
    "Nadine Tsafack",
    "Roger Ndjodo",
    "Cindy Penda",
    "Paul Atangana",
    "Justine Ngono",
    "Kevin Foe",
    "Sylvie Mveng",
    "Brice Mvogo",
]

NOISE_PREFIXES = [
    "scan",
    "copie",
    "recu",
    "tmp",
    "brouillon",
    "urgent",
    "archiv",
    "new",
    "old",
    "piece",
]

NOISE_SUFFIXES = [
    "final",
    "v2",
    "v3",
    "ok",
    "corrige",
    "a_trier",
    "2024",
    "2025",
    "signer",
    "backup",
]

SERVICE_TEMPLATES: Dict[str, List[Dict[str, Any]]] = {
    "RH": [
        {
            "base_name": "contrat_cdi_jean_mvondo",
            "ext": "docx",
            "year": 2024,
            "title": "Contrat CDI",
            "keywords": ["contrat", "travail", "rh", "cdi"],
        },
        {
            "base_name": "fiche_paie_mars",
            "ext": "xlsx",
            "year": 2025,
            "title": "Fiche de paie",
            "keywords": ["salaire", "paie", "bulletin", "rh"],
        },
        {
            "base_name": "attestation_travail_atanga",
            "ext": "docx",
            "year": 2024,
            "title": "Attestation de travail",
            "keywords": ["attestation", "emploi", "formation", "rh"],
        },
        {
            "base_name": "plan_formation_equipe",
            "ext": "pptx",
            "year": 2025,
            "title": "Plan de formation",
            "keywords": ["formation", "programme", "competences", "rh"],
        },
    ],
    "Finances": [
        {
            "base_name": "facture_fournisseur_0423",
            "ext": "pdf",
            "year": 2024,
            "title": "Facture fournisseur",
            "keywords": ["facture", "paiement", "tresorerie", "finances"],
        },
        {
            "base_name": "budget_previsionnel_2025",
            "ext": "xlsx",
            "year": 2025,
            "title": "Budget prévisionnel",
            "keywords": ["budget", "previsionnel", "depenses", "finances"],
        },
        {
            "base_name": "rpport_comptable_t1",
            "ext": "pdf",
            "year": 2025,
            "title": "Rapport comptable",
            "keywords": ["comptabilite", "bilan", "rapport", "finances"],
        },
        {
            "base_name": "ordre_virement_022025",
            "ext": "pdf",
            "year": 2025,
            "title": "Ordre de virement",
            "keywords": ["virement", "ordre", "banque", "finances"],
        },
    ],
    "Juridique": [
        {
            "base_name": "contrat_prestation_orange",
            "ext": "docx",
            "year": 2024,
            "title": "Contrat de prestation",
            "keywords": ["contrat", "prestation", "juridique", "accord"],
        },
        {
            "base_name": "convention_partenariat",
            "ext": "pdf",
            "year": 2025,
            "title": "Convention de partenariat",
            "keywords": ["convention", "partenariat", "accord", "juridique"],
        },
        {
            "base_name": "statuts_societe_v2",
            "ext": "docx",
            "year": 2024,
            "title": "Statuts société",
            "keywords": ["statuts", "societe", "juridique", "assemblee"],
        },
        {
            "base_name": "mise_en_demeure_fournisseur",
            "ext": "pdf",
            "year": 2025,
            "title": "Mise en demeure",
            "keywords": ["mise en demeure", "litige", "juridique", "contentieux"],
        },
    ],
    "Informatique": [
        {
            "base_name": "rapport_maintenance_serveurs",
            "ext": "pdf",
            "year": 2025,
            "title": "Rapport maintenance serveurs",
            "keywords": ["maintenance", "serveurs", "informatique", "infra"],
        },
        {
            "base_name": "cahier_charges_erp",
            "ext": "docx",
            "year": 2024,
            "title": "Cahier des charges ERP",
            "keywords": ["cahier de charges", "erp", "informatique", "projet"],
        },
        {
            "base_name": "plan_migration_cloud",
            "ext": "pptx",
            "year": 2025,
            "title": "Plan migration cloud",
            "keywords": ["migration", "cloud", "aws", "informatique"],
        },
        {
            "base_name": "tiket_incident_0089",
            "ext": "pdf",
            "year": 2025,
            "title": "Ticket incident",
            "keywords": ["incident", "ticket", "support", "informatique"],
        },
    ],
    "Direction": [
        {
            "base_name": "cr_reunion_comex_jan",
            "ext": "docx",
            "year": 2025,
            "title": "Compte rendu COMEX",
            "keywords": ["compte rendu", "reunion", "direction", "comex"],
        },
        {
            "base_name": "note_strategie_2025",
            "ext": "pdf",
            "year": 2025,
            "title": "Note stratégie",
            "keywords": ["strategie", "vision", "direction", "plan"],
        },
        {
            "base_name": "rapport_dg_annuel",
            "ext": "pptx",
            "year": 2024,
            "title": "Rapport DG annuel",
            "keywords": ["rapport", "directeur general", "direction", "annuel"],
        },
        {
            "base_name": "decret_nomination_drh",
            "ext": "pdf",
            "year": 2025,
            "title": "Décret nomination",
            "keywords": ["decret", "nomination", "direction", "officiel"],
        },
    ],
    "Logistique": [
        {
            "base_name": "bon_livraison_colis_045",
            "ext": "pdf",
            "year": 2025,
            "title": "Bon de livraison",
            "keywords": ["livraison", "colis", "logistique", "bon"],
        },
        {
            "base_name": "planning_transport_fev",
            "ext": "xlsx",
            "year": 2025,
            "title": "Planning transport",
            "keywords": ["transport", "planning", "logistique", "vehicule"],
        },
        {
            "base_name": "inventaire_stock_bureau",
            "ext": "xlsx",
            "year": 2024,
            "title": "Inventaire stock",
            "keywords": ["inventaire", "stock", "fournitures", "logistique"],
        },
        {
            "base_name": "fiche_reception_materiel",
            "ext": "docx",
            "year": 2024,
            "title": "Fiche réception matériel",
            "keywords": ["reception", "materiel", "logistique", "entree"],
        },
    ],
    "Marketing": [
        {
            "base_name": "plan_communication_2025",
            "ext": "pptx",
            "year": 2025,
            "title": "Plan communication",
            "keywords": ["communication", "plan", "marketing", "campagne"],
        },
        {
            "base_name": "rapport_google_ads_q1",
            "ext": "pdf",
            "year": 2025,
            "title": "Rapport Google Ads",
            "keywords": ["publicite", "google ads", "marketing", "rapport"],
        },
        {
            "base_name": "brief_agence_creative",
            "ext": "docx",
            "year": 2025,
            "title": "Brief agence créative",
            "keywords": ["brief", "creatif", "agence", "marketing"],
        },
        {
            "base_name": "tableau_kpis_marketing",
            "ext": "xlsx",
            "year": 2025,
            "title": "Tableau KPI marketing",
            "keywords": ["kpi", "indicateurs", "marketing", "performance"],
        },
    ],
    "Autre": [
        {
            "base_name": "document_personnel_divers",
            "ext": "pdf",
            "year": 2025,
            "title": "Document divers",
            "keywords": ["document", "divers", "personnel"],
        },
        {
            "base_name": "notes_reunion_informelle",
            "ext": "docx",
            "year": 2025,
            "title": "Notes réunion informelle",
            "keywords": ["notes", "reunion", "informelle"],
        },
        {
            "base_name": "fichier_temp_archive",
            "ext": "xlsx",
            "year": 2024,
            "title": "Fichier temporaire",
            "keywords": ["archive", "temporaire", "divers"],
        },
        {
            "base_name": "presentation_generique",
            "ext": "pptx",
            "year": 2024,
            "title": "Présentation générique",
            "keywords": ["presentation", "generique", "divers"],
        },
    ],
}

SERVICE_SEQUENCE = list(SERVICE_TEMPLATES.keys())
NOISE_LEVEL_WEIGHTS = [18, 32, 30, 20]


def strip_accents(text: str) -> str:
    return "".join(
        ch
        for ch in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(ch)
    )


def normalize_text(text: str) -> str:
    text = strip_accents(text).lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def stable_suffix(text: str, size: int = 6) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:size].upper()


def sanitize_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\\\|?*]', "_", name)
    name = re.sub(r"\s+", " ", name).strip()
    name = re.sub(r"_+", "_", name)
    return name.rstrip(" ._")[:180] or "document"


def write_text_fallback(path: Path, doc: Dict[str, Any], kind: str) -> None:
    """Fallback minimaliste quand les bibliothèques de documents ne sont pas installées."""
    reference_seed = doc.get("filename_stem", doc["name"])
    content = [
        f"[{kind.upper()} fallback]",
        f"Titre: {doc.get('title', doc['name'])}",
        f"Service: {doc['service']}",
        f"Annee: {doc['year']}",
        f"Keywords: {', '.join(doc['keywords'])}",
        f"Reference: REF-{doc['service'].upper()[:3]}-{doc['year']}-{stable_suffix(reference_seed)}",
    ]
    path.write_text("\n".join(content), encoding="utf-8")


def pick_conflict_service(primary_service: str, rng: random.Random) -> str:
    """Choisit un service concurrent, en privilégiant les services classés avant le service attendu."""
    candidates = [service for service in SERVICE_SEQUENCE if service != primary_service]
    primary_index = SERVICE_SEQUENCE.index(primary_service)
    earlier = [
        service
        for service in candidates
        if SERVICE_SEQUENCE.index(service) < primary_index
    ]
    if earlier and rng.random() < 0.75:
        return rng.choice(earlier)
    return rng.choice(candidates)


def build_ambiguity_bundle(primary_service: str, rng: random.Random) -> Dict[str, Any]:
    """Construit un scénario ambigu entre deux services."""
    if primary_service not in ROUTING_RULES:
        return {
            "is_ambiguous": False,
            "conflict_service": None,
            "conflict_keywords": [],
        }

    conflict_service = pick_conflict_service(primary_service, rng)
    primary_keywords = [normalize_text(kw) for kw in ROUTING_RULES[primary_service]]
    if not primary_keywords:
        primary_keywords = ["divers", "archive"]
    conflict_keywords = [normalize_text(kw) for kw in ROUTING_RULES[conflict_service]]
    if not conflict_keywords:
        conflict_keywords = ["divers", "archive"]
    chosen = [rng.choice(primary_keywords), rng.choice(conflict_keywords)]
    if rng.random() < 0.5:
        chosen.append(rng.choice(conflict_keywords))
    if rng.random() < 0.35:
        chosen.append(rng.choice(primary_keywords))

    return {
        "is_ambiguous": True,
        "conflict_service": conflict_service,
        "conflict_keywords": list(dict.fromkeys(chosen)),
    }


def mutate_token(token: str, severity: int, rng: random.Random) -> str:
    token = strip_accents(token)
    token = token.replace("'", "")
    if severity <= 0 or len(token) <= 2:
        return token

    current = token
    steps = max(1, severity)
    for _ in range(steps):
        if len(current) <= 2:
            break
        op = rng.choice(["delete", "swap", "duplicate", "replace"])
        chars = list(current)
        if op == "delete" and len(chars) > 3:
            del chars[rng.randrange(len(chars))]
        elif op == "swap" and len(chars) > 3:
            idx = rng.randrange(len(chars) - 1)
            chars[idx], chars[idx + 1] = chars[idx + 1], chars[idx]
        elif op == "duplicate":
            idx = rng.randrange(len(chars))
            chars.insert(idx, chars[idx])
        else:
            idx = rng.randrange(len(chars))
            replacements = "aeiourstnmlpgh"
            chars[idx] = rng.choice(replacements)
        current = "".join(chars)

    if severity >= 2 and rng.random() < 0.45:
        current = current[: max(2, len(current) - rng.randint(0, 2))]
    if severity >= 3 and rng.random() < 0.60:
        current = f"{current}{rng.choice(['1', '2', '3', 'bis', 'copy'])}"
    return current


def build_employee_alias(rng: random.Random, severity: int) -> str:
    alias = rng.choice(EMPLOYEE_NAMES)
    if severity <= 0:
        return alias
    pieces = alias.split()
    mutated = []
    for piece in pieces:
        if rng.random() < (0.35 + 0.15 * severity):
            mutated.append(mutate_token(piece, min(severity, 2), rng))
        else:
            mutated.append(piece)
    alias = " ".join(mutated)
    if severity >= 2 and rng.random() < 0.50:
        alias = alias.replace(" ", rng.choice(["_", "-", " "]))
    if severity >= 3 and rng.random() < 0.40:
        alias = f"{rng.choice(NOISE_PREFIXES)} {alias}"
    return alias


def build_noisy_filename_stem(
    template: Dict[str, Any], employee_alias: str, severity: int, rng: random.Random
) -> str:
    base_tokens = [
        token for token in re.split(r"[_\-\s]+", template["base_name"]) if token
    ]
    mutated_tokens: List[str] = []
    for token in base_tokens:
        chance = [0.0, 0.35, 0.60, 0.90][severity]
        if rng.random() < chance:
            mutated_tokens.append(mutate_token(token, severity, rng))
        else:
            mutated_tokens.append(strip_accents(token))

    fragments: List[str] = []
    if rng.random() < 0.80:
        fragments.append(employee_alias)
    if rng.random() < 0.55:
        fragments.append(rng.choice(NOISE_PREFIXES))
    fragments.append(" ".join(mutated_tokens))
    if severity >= 1:
        fragments.append(str(template["year"]))
    if severity >= 2:
        fragments.append(rng.choice(NOISE_SUFFIXES))
    if severity >= 3 and rng.random() < 0.60:
        fragments.append(rng.choice(["(1)", "(2)", "copie", "scan", "archive"]))

    stem = " - ".join(fragment for fragment in fragments if fragment)
    stem = re.sub(r"\s+", " ", stem).strip()
    return sanitize_filename(stem)


def build_ocr_text(
    template: Dict[str, Any],
    employee_alias: str,
    severity: int,
    rng: random.Random,
    conflict_service: str | None = None,
    conflict_keywords: List[str] | None = None,
) -> str:
    keywords = [strip_accents(k) for k in template["keywords"]]
    if template["service"] == "Autre":
        keywords = ["divers", "note", "archive", "personnel"]

    lines = [
        f"Document pour le service {template['service']}.",
        f"Responsable humain : {employee_alias}.",
        f"Titre : {template['title']}.",
        f"Annee de traitement : {template['year']}.",
        f"Mots cles detectes : {', '.join(keywords)}.",
        "Fichier genere pour verification de la classification automatique.",
    ]

    if conflict_service and conflict_keywords:
        lines.insert(
            1,
            f"Document hybride entre {template['service']} et {conflict_service}; indices croises: {', '.join(conflict_keywords)}.",
        )
        lines.insert(
            2,
            "Rattachement provisoire. Les deux services partagent des elements de contexte.",
        )

    if severity >= 1:
        lines.append("Le document a ete depose en urgence par un employe presse.")
    if severity >= 2:
        lines.append(
            "Version de travail provisoire, nommage approximatif, controle manuel recommande."
        )
    if severity >= 3:
        noisy_note = (
            "Observation interne: copie finale, archive a verifier, scan incomplet."
        )
        if rng.random() < 0.5:
            noisy_note = noisy_note.replace("copie", "c0pie").replace(
                "finale", "f1nale"
            )
        lines.append(noisy_note)

    if severity >= 2 and keywords:
        noisy_keyword = rng.choice([k for k in keywords if len(k) > 4] or keywords)
        if len(noisy_keyword) > 4 and rng.random() < 0.55:
            lines.append(f"Note OCR bruitee: {mutate_token(noisy_keyword, 1, rng)}.")

    if conflict_keywords and severity >= 1:
        extra_conflict = rng.choice(conflict_keywords)
        if extra_conflict not in lines[-1]:
            lines.append(f"Indice concurrent supplementaire: {extra_conflict}.")

    if severity >= 1 and rng.random() < 0.35:
        rng.shuffle(lines)

    return " ".join(lines)


def build_document_case(index: int, rng: random.Random) -> Dict[str, Any]:
    service = SERVICE_SEQUENCE[index % len(SERVICE_SEQUENCE)]
    template = rng.choice(SERVICE_TEMPLATES[service])
    noise_level = rng.choices([0, 1, 2, 3], weights=NOISE_LEVEL_WEIGHTS, k=1)[0]
    employee_alias = build_employee_alias(rng, noise_level)
    filename_stem = build_noisy_filename_stem(
        template, employee_alias, noise_level, rng
    )
    display_title = template["title"]
    ambiguity_bundle: Dict[str, Any] = {
        "is_ambiguous": False,
        "conflict_service": None,
        "conflict_keywords": [],
    }
    if rng.random() < AMBIGUITY_RATE:
        ambiguity_bundle = build_ambiguity_bundle(service, rng)

    return {
        "index": index,
        "service": service,
        "year": template["year"],
        "ext": template["ext"],
        "base_name": template["base_name"],
        "title": display_title,
        "name": display_title,
        "keywords": template["keywords"],
        "employee": employee_alias,
        "noise_level": noise_level,
        "filename_stem": filename_stem,
        "expected_service": service,
        "is_ambiguous": ambiguity_bundle["is_ambiguous"],
        "conflict_service": ambiguity_bundle["conflict_service"],
        "conflict_keywords": ambiguity_bundle["conflict_keywords"],
    }


def build_test_documents(
    total: int = TOTAL_DOCUMENTS, seed: int = RANDOM_SEED
) -> List[Dict[str, Any]]:
    rng = random.Random(seed)
    documents = [build_document_case(i, rng) for i in range(total)]
    rng.shuffle(documents)
    return documents


# Nettoyage des runs précédents
for d in [SOURCE_GED, REMOTE_SERVER]:
    if d.exists():
        shutil.rmtree(d)
    d.mkdir(parents=True, exist_ok=True)

# =============================================
# 2. GÉNÉRATEURS DE VRAIS FICHIERS BINAIRES
# =============================================


def create_real_pdf_reportlab(path: Path, doc: Dict[str, Any]):
    """Crée un PDF lisible avec contenu texte OCR-able via reportlab."""
    if canvas is None:
        write_text_fallback(path, doc, "pdf")
        return

    title = doc.get("title", doc["name"]).replace("_", " ").title()
    c = canvas.Canvas(str(path))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 800, f"Document : {title}")
    c.setFont("Helvetica", 12)
    c.drawString(50, 770, f"Service : {doc['service']}")
    c.drawString(50, 750, f"Année : {doc['year']}")
    c.drawString(50, 730, f"Date de création : {datetime.date.today()}")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, 700, "Contenu (lisible par OCR) :")
    c.setFont("Helvetica", 10)
    content_lines = [
        f"Ce document concerne le service {doc['service']}.",
        f"Mots-clés identifiés : {', '.join(doc['keywords'])}.",
        f"Document approuvé et classifié pour l'année {doc['year']}.",
        "Ce fichier est un vrai PDF binaire généré par la GED E-Dossier Cameroun.",
        f"Référence unique : REF-{doc['service'].upper()[:3]}-{doc['year']}-{stable_suffix(doc.get('filename_stem', doc['name']))}",
    ]
    y = 680
    for line in content_lines:
        c.drawString(50, y, line)
        y -= 20
    c.save()


def create_real_docx(path: Path, doc: Dict[str, Any]):
    """Crée un vrai fichier .docx Word lisible."""
    if DocxDocument is None:
        write_text_fallback(path, doc, "docx")
        return

    title = doc.get("title", doc["name"]).replace("_", " ").title()
    document = DocxDocument()
    document.add_heading(title, 0)
    document.add_paragraph(f"Service : {doc['service']}")
    document.add_paragraph(f"Année : {doc['year']}")
    document.add_paragraph(f"Date : {datetime.date.today()}")
    document.add_heading("Contenu du document", level=1)
    document.add_paragraph(
        f"Ce document a été créé pour le service {doc['service']} "
        f"en {doc['year']}. Il est classifié automatiquement par le moteur "
        f"de règles IFTTT de la GED E-Dossier Cameroun."
    )
    document.add_paragraph(f"Mots-clés : {', '.join(doc['keywords'])}")
    document.add_paragraph(
        f"Référence : REF-{doc['service'].upper()[:3]}-{doc['year']}-{stable_suffix(doc.get('filename_stem', doc['name']))}"
    )
    document.save(str(path))


def create_real_xlsx(path: Path, doc: Dict[str, Any]):
    """Crée un vrai fichier .xlsx Excel lisible."""
    if openpyxl is None:
        write_text_fallback(path, doc, "xlsx")
        return

    title = doc.get("title", doc["name"]).replace("_", " ").title()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = doc["service"]
    ws["A1"] = "Document"
    ws["B1"] = title
    ws["A2"] = "Service"
    ws["B2"] = doc["service"]
    ws["A3"] = "Année"
    ws["B3"] = doc["year"]
    ws["A4"] = "Mots-clés"
    ws["B4"] = ", ".join(doc["keywords"])
    ws["A5"] = "Statut"
    ws["B5"] = "Validé"
    ws["A6"] = "Date"
    ws["B6"] = str(datetime.date.today())
    ws["A8"] = "Données"
    ws["B8"] = "Valeur"
    ws["C8"] = "Commentaire"
    for i in range(9, 20):
        ws[f"A{i}"] = f"Ligne {i-8}"
        ws[f"B{i}"] = (i - 8) * 1000
        ws[f"C{i}"] = f"Données {doc['service']} - {doc['year']}"
    wb.save(str(path))


def create_real_pptx(path: Path, doc: Dict[str, Any]):
    """Crée un vrai fichier .pptx PowerPoint lisible."""
    if Presentation is None:
        write_text_fallback(path, doc, "pptx")
        return

    title = doc.get("title", doc["name"]).replace("_", " ").title()
    prs = Presentation()
    # Slide 1 : titre
    slide_layout = prs.slide_layouts[0]
    slide = prs.slides.add_slide(slide_layout)
    slide.shapes.title.text = title
    slide.placeholders[1].text = f"{doc['service']} | {doc['year']}"
    # Slide 2 : contenu
    slide_layout2 = prs.slide_layouts[1]
    slide2 = prs.slides.add_slide(slide_layout2)
    slide2.shapes.title.text = "Informations clés"
    tf = slide2.placeholders[1].text_frame
    tf.text = f"Service : {doc['service']}"
    p = tf.add_paragraph()
    p.text = f"Mots-clés : {', '.join(doc['keywords'])}"
    p = tf.add_paragraph()
    p.text = f"Référence : REF-{doc['service'].upper()[:3]}-{doc['year']}"
    prs.save(str(path))


def generate_document(doc: Dict[str, Any]) -> Tuple[Path, str]:
    """Génère le fichier binaire réel et retourne (path, ocr_content simulé)."""
    filename = f"{doc['filename_stem']}.{doc['ext']}"
    file_path = SOURCE_GED / filename

    if doc["ext"] == "pdf":
        create_real_pdf_reportlab(file_path, doc)
    elif doc["ext"] == "docx":
        create_real_docx(file_path, doc)
    elif doc["ext"] == "xlsx":
        create_real_xlsx(file_path, doc)
    elif doc["ext"] == "pptx":
        create_real_pptx(file_path, doc)

    ocr_text = build_ocr_text(
        doc,
        doc["employee"],
        doc["noise_level"],
        random.Random(RANDOM_SEED + doc["index"]),
        conflict_service=doc.get("conflict_service"),
        conflict_keywords=doc.get("conflict_keywords"),
    )
    return file_path, ocr_text


# =============================================
# 3. MOTEUR DE CLASSEMENT PAR RÈGLES IFTTT
#    (sans base de données — pure logique Python)
# =============================================

# Table de routage : mot-clé → (service_folder, sous-folder)
ROUTING_RULES = {
    "RH": [
        "contrat",
        "paie",
        "recrutement",
        "congé",
        "évaluation",
        "formation",
        "règlement",
        "bulletin",
        "salaire",
        "attestation",
        "emploi",
        "absence",
    ],
    "Finances": [
        "facture",
        "budget",
        "comptabilité",
        "commande",
        "devis",
        "trésorerie",
        "audit",
        "virement",
        "paiement",
        "bilan",
        "achat",
    ],
    "Juridique": [
        "contrat",
        "convention",
        "partenariat",
        "statuts",
        "litige",
        "NDA",
        "confidentialité",
        "consultation",
        "juridique",
        "contentieux",
        "mise en demeure",
    ],
    "Informatique": [
        "maintenance",
        "ERP",
        "sécurité",
        "cloud",
        "migration",
        "licence",
        "logiciel",
        "inventaire",
        "backup",
        "incident",
        "informatique",
        "infra",
        "serveurs",
    ],
    "Direction": [
        "compte rendu",
        "stratégie",
        "vision",
        "directeur",
        "COMEX",
        "lettre",
        "décret",
        "nomination",
        "qualité",
    ],
    "Logistique": [
        "livraison",
        "transport",
        "stock",
        "fournitures",
        "réception",
        "logistique",
    ],
    "Marketing": [
        "communication",
        "publicité",
        "Google Ads",
        "brief",
        "KPI",
        "marketing",
        "campagne",
    ],
    "Autre": [],
}

NORMALIZED_ROUTING_RULES = {
    service: [normalize_text(keyword) for keyword in keywords]
    for service, keywords in ROUTING_RULES.items()
}


def token_distance_one(left: str, right: str) -> bool:
    """Retourne True si les deux mots sont identiques ou à une faute près."""
    left = normalize_text(left)
    right = normalize_text(right)
    if left == right:
        return True
    if abs(len(left) - len(right)) > 1:
        return False

    if len(left) == len(right):
        mismatches = sum(1 for a, b in zip(left, right) if a != b)
        return mismatches <= 1

    longer, shorter = (left, right) if len(left) > len(right) else (right, left)
    i = j = 0
    edits = 0
    while i < len(longer) and j < len(shorter):
        if longer[i] == shorter[j]:
            i += 1
            j += 1
            continue
        edits += 1
        if edits > 1:
            return False
        i += 1
    return True


def classify_document(ocr_content: str, year: int) -> Tuple[str, str]:
    """
    Analyse l'OCR et retourne (service_folder, year_folder).
    Crée automatiquement 'Autre/{year}' si aucune règle ne match.
    """
    ocr_normalized = normalize_text(ocr_content)
    ocr_tokens = ocr_normalized.split()

    for service, keywords in NORMALIZED_ROUTING_RULES.items():
        for kw in keywords:
            if " " in kw:
                if kw in ocr_normalized:
                    return service, str(year)
                continue

            if kw in ocr_tokens:
                return service, str(year)

            if any(token_distance_one(token, kw) for token in ocr_tokens):
                return service, str(year)

    # Aucune règle ne match → dossier "Autre" créé automatiquement
    return FALLBACK_FOLDER, str(year)


def export_to_server(file_path: Path, service: str, year: str) -> Path:
    """Copie le fichier dans la structure organisée du serveur distant. Crée les dossiers si besoin."""
    dest_dir = REMOTE_SERVER / service / year
    dest_dir.mkdir(parents=True, exist_ok=True)  # Création automatique si inexistant !
    dest = dest_dir / file_path.name
    shutil.copy2(file_path, dest)
    return dest


def export_results_csv(results: List[Dict[str, Any]], path: Path) -> None:
    """Export détaillé des résultats de classification en CSV."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "index",
        "doc",
        "source_file",
        "expected_service",
        "predicted_service",
        "year",
        "noise_level",
        "is_ambiguous",
        "conflict_service",
        "conflict_keywords",
        "is_true_positive",
        "false_positive",
        "false_negative",
        "error_type",
        "classified_path",
        "destination_path",
        "ocr_preview",
    ]

    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in results:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


# =============================================
# 4. EXECUTION DU TEST
# =============================================


async def main():
    print("=" * 65)
    print(
        f"  TEST RÉEL GED — {TOTAL_DOCUMENTS} Vrais Documents Bruités + Classement Automatique"
    )
    print("=" * 65)
    print(f"\n Source GED    : {SOURCE_GED}")
    print(f" Serveur Dist. : {REMOTE_SERVER}\n")
    print(f" Seed          : {RANDOM_SEED}")

    documents = build_test_documents()
    results = []
    new_folders_created = set()

    for i, doc in enumerate(documents, 1):
        # Génération du vrai fichier binaire
        file_path, ocr_text = generate_document(doc)
        size_kb = file_path.stat().st_size // 1024 or 1

        # Classement intelligent par lecture OCR
        classified_service, year_folder = classify_document(ocr_text, doc["year"])

        # Détection de nouveaux dossiers
        dest_dir_key = f"{classified_service}/{year_folder}"
        if dest_dir_key not in new_folders_created:
            new_folders_created.add(dest_dir_key)

        # Export physique vers le serveur distant
        dest_path = export_to_server(file_path, classified_service, year_folder)

        expected_service = doc["expected_service"]
        is_true_positive = int(classified_service == expected_service)
        false_negative = int(classified_service != expected_service)
        false_positive = int(
            classified_service != expected_service
            and classified_service != FALLBACK_FOLDER
        )
        if is_true_positive:
            error_type = "tp"
        elif classified_service == FALLBACK_FOLDER:
            error_type = "fn"
        else:
            error_type = "fp_fn"

        match = "✅" if is_true_positive else "📂 AUTRE"
        ocr_preview = re.sub(r"\s+", " ", ocr_text).strip()[:240]
        results.append(
            {
                "index": i,
                "doc": doc["filename_stem"],
                "source_file": str(file_path),
                "type": doc["ext"].upper(),
                "taille": f"{size_kb}KB",
                "classifié en": f"{classified_service}/{year_folder}",
                "classified_path": f"{classified_service}/{year_folder}",
                "attendu": expected_service,
                "expected_service": expected_service,
                "predicted_service": classified_service,
                "match": match,
                "noise_level": doc["noise_level"],
                "is_ambiguous": int(bool(doc.get("is_ambiguous"))),
                "conflict_service": doc.get("conflict_service") or "",
                "conflict_keywords": " | ".join(doc.get("conflict_keywords") or []),
                "is_true_positive": is_true_positive,
                "false_positive": false_positive,
                "false_negative": false_negative,
                "error_type": error_type,
                "destination_path": str(dest_path),
                "ocr_preview": ocr_preview,
            }
        )
        print(
            f"[{i:03d}/{len(documents)}] {match} "
            f"{doc['ext'].upper():<5} "
            f"n{doc['noise_level']} {doc['filename_stem'][:42]:<42} → {classified_service}/{year_folder}"
        )

    # Rapport de la structure créée sur le serveur
    print("\n" + "=" * 65)
    print("  STRUCTURE CRÉÉE SUR LE SERVEUR DISTANT")
    print("=" * 65)
    for service_dir in sorted(REMOTE_SERVER.iterdir()):
        if service_dir.is_dir():
            print(f"\n  📁 {service_dir.name}/")
            for year_dir in sorted(service_dir.iterdir()):
                if year_dir.is_dir():
                    files = list(year_dir.iterdir())
                    print(f"     └─ 📅 {year_dir.name}/ ({len(files)} fichiers)")
                    for f in sorted(files):
                        print(f"           • {f.name} ({f.stat().st_size} octets)")

    # Stats finales
    matched = sum(1 for r in results if "✅" in r["match"])
    by_expected = Counter(r["attendu"] for r in results)
    by_predicted = Counter(r["classifié en"].split("/")[0] for r in results)
    by_noise = Counter(r["noise_level"] for r in results)
    ambiguous_count = sum(1 for r in results if r["is_ambiguous"])
    fp_total = sum(r["false_positive"] for r in results)
    fn_total = sum(r["false_negative"] for r in results)
    csv_path = CSV_REPORT_PATH
    export_results_csv(results, csv_path)
    print(f"\n{'=' * 65}")
    print(f"  RÉSULTATS : {matched}/{len(documents)} documents classifiés correctement")
    print(f"  Taux de réussite : {matched / max(1, len(documents)):.1%}")
    print(f"  Cas ambigus : {ambiguous_count}")
    print(f"  Faux positifs : {fp_total}")
    print(f"  Faux négatifs : {fn_total}")
    print(f"  Dossiers créés automatiquement : {len(new_folders_created)}")
    total_files = sum(1 for _ in REMOTE_SERVER.rglob("*") if _.is_file())
    print(f"  Fichiers physiques sur le serveur : {total_files}")
    print(f"  Répartition attendue : {dict(by_expected)}")
    print(f"  Répartition détectée : {dict(by_predicted)}")
    print(f"  Niveaux de bruit : {dict(by_noise)}")
    print(f"  CSV résultats : {csv_path}")
    print(f"{'=' * 65}\n")


if __name__ == "__main__":
    asyncio.run(main())
