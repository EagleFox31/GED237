"""Demo dataset generator: the versioned manifest is coherent and the corpus is deterministic."""

import hashlib
import json
import os
import sys
from collections import Counter
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
MANIFEST = Path(
    os.getenv(
        "DEMO_MANIFEST",
        BACKEND.parent / "frontend" / "e2e" / "data" / "demo-manifest.json",
    )
)
sys.path.insert(0, str(BACKEND / "scripts"))

import demo_dataset  # noqa: E402


@pytest.fixture(scope="module")
def entries():
    return demo_dataset.build_corpus(237)


@pytest.fixture(scope="module")
def manifest():
    if not MANIFEST.exists():
        pytest.skip(
            "frontend/e2e/data/demo-manifest.json not available in this checkout"
        )
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def test_corpus_is_deterministic(entries):
    again = demo_dataset.build_corpus(237)

    def digest(items):
        return [
            (e["folder"], e["name"], hashlib.sha256(e["content"]).hexdigest())
            for e in items
        ]

    assert digest(entries) == digest(again)
    assert demo_dataset.build_corpus(1)[0]["name"] != entries[0]["name"]


def test_expected_aggregates_derive_from_files(manifest, entries):
    expected = demo_dataset.compute_expected(manifest, entries)
    assert (
        expected == manifest["expected"]
    ), "manifest drifted: run scripts/demo-dataset.sh --write"
    files = expected["files"]
    per_unit = Counter()
    for entry in files:
        if entry["status"] != "duplicate":
            # classified: the rule's target unit (where the document lands); review: the import's target unit
            source_unit = demo_dataset.UNIT[entry["path"].split("/")[0]]
            unit = entry["orgUnit"] if entry["status"] == "classified" else source_unit
            per_unit[(unit, entry["status"])] += 1
    for unit, bucket in expected["byOrgUnit"].items():
        assert bucket["classified"] == per_unit[(unit, "classified")]
        assert bucket["toReview"] == per_unit[(unit, "needs_review")]
        assert bucket["total"] == bucket["classified"] + bucket["toReview"]
    assert expected["documents"]["total"] == sum(
        b["total"] for b in expected["byOrgUnit"].values()
    )
    assert expected["imports"]["duplicates"] == sum(
        1 for e in files if e["status"] == "duplicate"
    )
    # trash, locks and versions act on documents: only classified items create one at commit
    titles = {Path(e["path"]).stem for e in files if e["status"] == "classified"}
    assert set(expected["trash"]) <= titles
    assert set(expected["locks"]["MGR001"]) <= titles and not set(
        expected["locks"]["MGR001"]
    ) & set(expected["trash"])
    assert set(expected["versions"]) <= titles
    assert 300 <= expected["documents"]["total"] <= 500
    assert expected["live"] == {"files": 30, "new": 28, "duplicates": 2}


def test_prediction_follows_rule_priority_and_source_unit(manifest):
    rules = manifest["rules"]
    pdf = "application/pdf"
    # rule 02 (DSI) beats rule 03 on "contrat" when the source is the DSI
    assert (
        demo_dataset.predict(
            rules, "DSI/contrat de maintenance 2024.pdf", pdf, "MINFI-DSI", "MINFI"
        )["activity"]
        == "DEMO-ACT-SI-MAINTENANCE"
    )
    assert (
        demo_dataset.predict(
            rules, "DRH/contrat cdi 2024.pdf", pdf, "MINFI-DRH", "MINFI"
        )["activity"]
        == "DEMO-ACT-RH-CONTRATS"
    )
    # the DAF has no rule for a maintenance contract: shown in the review screen
    assert (
        demo_dataset.predict(
            rules,
            "DAF/contrat maintenance climatiseurs 2025.pdf",
            pdf,
            "MINFI-DAF",
            "MINFI",
        )["status"]
        == "needs_review"
    )
    # rule 09 is PDF only and targets the source service; rule 10 is inactive
    courrier = demo_dataset.predict(
        rules, "DSI/lettre 2025.pdf", pdf, "MINFI-DSI", "MINFI"
    )
    assert (courrier["orgUnit"], courrier["year"]) == ("MINFI-DSI", 2025)
    assert (
        demo_dataset.predict(
            rules,
            "DSI/lettre 2025.docx",
            demo_dataset.MIME["docx"],
            "MINFI-DSI",
            "MINFI",
        )["status"]
        == "needs_review"
    )
    assert (
        demo_dataset.predict(rules, "DAF/bilan 2024.pdf", pdf, "MINFI-DAF", "MINFI")[
            "status"
        ]
        == "needs_review"
    )
