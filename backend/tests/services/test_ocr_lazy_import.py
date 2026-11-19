"""Importing the OCR module must not load torch/easyocr (~260 MB) while unused."""

import subprocess
import sys
import textwrap
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]


def _run(code: str) -> str:
    prelude = f"import sys; sys.path.insert(0, {str(BACKEND)!r})\n"
    out = subprocess.run(
        [sys.executable, "-I", "-c", prelude + textwrap.dedent(code)],
        capture_output=True,
        text=True,
        check=True,
        timeout=120,
    )
    return out.stdout.strip()


def test_importing_and_building_the_strategy_does_not_load_heavy_libraries():
    loaded = _run(
        """
        import sys
        import app.services.ocr as ocr
        from app.services.ocr.strategy import OCRStrategy
        OCRStrategy()
        print(",".join(m for m in ("torch", "easyocr") if m in sys.modules))
        """
    )
    assert loaded == ""


def test_gpu_mode_is_resolved_on_first_use_not_at_construction():
    from app.services.ocr.easyocr_engine import EasyOCREngine

    engine = EasyOCREngine(use_gpu=False)
    assert engine._resolved_gpu is None
    assert engine._reader_key == (("fr", "en"), False)
    assert engine._resolved_gpu is False
