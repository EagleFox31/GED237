"""E2E seed (#284): reading states declared in the manifest use the worker's contract."""

import importlib.util
import json
import os
import pathlib

import pytest

from app.services.ocr.base import is_low_confidence

BACKEND = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = pathlib.Path(
    os.getenv(
        "E2E_MANIFEST",
        BACKEND.parent / "frontend" / "e2e" / "data" / "seed-manifest.json",
    )
)


def _load_seed_module():
    spec = importlib.util.spec_from_file_location(
        "seed_e2e", BACKEND / "scripts/seed_e2e.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


seed_e2e = _load_seed_module()


def test_no_ocr_key_writes_nothing():
    assert seed_e2e.ocr_state("DOC", None) == (None, {})


def test_failure_uses_the_worker_fields():
    assert seed_e2e.ocr_state("DOC", {"status": "failed", "error": "no_text"}) == (
        None,
        {"ocr_status": "failed", "ocr_error": "no_text"},
    )


def test_reading_keeps_text_and_confidence():
    assert seed_e2e.ocr_state("DOC", {"content": "Texte lu", "confidence": 0.42}) == (
        "Texte lu",
        {"ocr_confidence": 0.42},
    )


@pytest.mark.parametrize(
    "spec",
    [
        {"status": "failed", "error": "unknown_code"},
        {"status": "failed"},
        {"status": "completed", "error": "no_text"},
        {"content": "", "confidence": 0.5},
        {"content": "Texte", "confidence": 1.5},
        {"content": "Texte", "confidence": True},
        {"content": "Texte"},
        "failed",
    ],
)
def test_invalid_spec_is_refused(spec):
    with pytest.raises(seed_e2e.ManifestError, match="DOC"):
        seed_e2e.ocr_state("DOC", spec)


def test_manifest_reading_states_match_expected():
    """Each declared state is valid and gives the GET /documents/{id}/ocr answer the suite expects."""
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    declared = {d["title"]: d["ocr"] for d in manifest["documents"] if "ocr" in d}
    expected = manifest["expected"]["ocr"]
    assert set(declared) == set(expected)
    for title, spec in declared.items():
        content, extra = seed_e2e.ocr_state(title, spec)
        confidence = extra.get("ocr_confidence") if content else None
        answer = {
            "status": "completed" if content else extra["ocr_status"],
            "error": extra.get("ocr_error"),
            "lowConfidence": is_low_confidence(confidence),
        }
        assert answer == expected[title], title
    lows = [t for t, e in expected.items() if e["lowConfidence"]]
    failures = [t for t, e in expected.items() if e["status"] == "failed"]
    assert (
        lows and failures
    ), "the suite needs one low-confidence reading and one failure"
