"""reocr.py : sélection par nom, une ligne par document, rien n'est mis en file sans --run."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import reocr  # noqa: E402

ROWS = [
    ("id-1", "IMG_0413.jpg", 0, "t/v2.jpg", "image/jpeg"),
    ("id-1", "IMG_0413.jpg", 0, "t/v1.jpg", "image/jpeg"),
    ("id-2", "IMG_0413 copie.jpg", 365, "t/c.jpg", "image/jpeg"),
]


def test_like_pattern_matches_substring_literally():
    assert reocr.like_pattern("IMG_04") == r"%IMG\_04%"
    assert reocr.like_pattern("100%") == r"%100\%%"


def test_latest_version_kept_per_document():
    picked = reocr.latest_per_document(ROWS)
    assert [r[0] for r in picked] == ["id-1", "id-2"]
    assert picked[0][3] == "t/v2.jpg"


def test_without_run_lists_and_dispatches_nothing():
    calls, lines = [], []
    count = reocr.plan(ROWS, False, lambda *a: calls.append(a) or "x", lines.append)
    assert count == 2 and calls == []
    assert lines[0] == "id-1 | IMG_0413.jpg | ocr_chars=0"
    assert not any("task_id" in line for line in lines)


def test_with_run_dispatches_latest_version_of_each_document():
    calls, lines = [], []
    reocr.plan(ROWS, True, lambda *a: calls.append(a) or "tid", lines.append)
    assert calls == [
        ("id-1", "t/v2.jpg", "image/jpeg"),
        ("id-2", "t/c.jpg", "image/jpeg"),
    ]
    assert "  relance task_id=tid" in lines
