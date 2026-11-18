"""RapidOCR: routing, Tesseract fallback, kill switch, offline behaviour.

The ONNX models are never loaded here: the engine object is replaced by a fake, so
these tests run in any environment (the real run is measured in the worker image).
"""

import time

import pytest
from PIL import Image

from app.core.config import Settings, settings
from app.services.ocr.base import OCRResult
from app.services.ocr.rapidocr_engine import RapidOCREngine
from app.services.ocr.strategy import DocumentType, OCRStrategy


class _Output:
    def __init__(self, txts, scores):
        self.txts = txts
        self.scores = scores


@pytest.fixture(autouse=True)
def _reset_engine():
    RapidOCREngine._engine = None
    RapidOCREngine._unavailable = False
    yield
    RapidOCREngine._engine = None
    RapidOCREngine._unavailable = False


def _image(size=(40, 30)):
    return Image.new("RGB", size, "white")


def _result(text, confidence, engine):
    return OCRResult(
        text=text,
        confidence=confidence,
        engine_used=engine,
        char_count=len(text),
        word_count=len(text.split()),
    )


class _Fake:
    def __init__(self, result, name):
        self.result = result
        self.name = name
        self.calls = 0

    def extract_from_image(self, _path):
        self.calls += 1
        return self.result


def _strategy(primary="rapidocr"):
    strategy = OCRStrategy(primary_engine=primary)
    strategy.rapidocr = _Fake(_result("Texte photo", 0.9, "RapidOCR"), "RapidOCR")
    strategy.tesseract = _Fake(_result("Texte scan", 0.9, "Tesseract"), "Tesseract")
    strategy.easyocr = _Fake(_result("Autre", 0.9, "EasyOCR"), "EasyOCR")
    return strategy


# --- routing ---------------------------------------------------------------


@pytest.mark.parametrize(
    "kind", [DocumentType.PHOTO, DocumentType.SCREENSHOT, DocumentType.FORM]
)
def test_photos_captures_and_forms_go_to_rapidocr(kind):
    strategy = _strategy()
    primary, fallback = strategy._select_engines(kind)
    assert primary is strategy.rapidocr
    assert fallback is strategy.tesseract


@pytest.mark.parametrize("kind", [DocumentType.SCANNED_DOCUMENT, DocumentType.UNKNOWN])
def test_clean_scans_stay_on_tesseract(kind):
    strategy = _strategy()
    primary, _ = strategy._select_engines(kind)
    assert primary is strategy.tesseract


def test_pdf_scan_pages_do_not_use_rapidocr():
    strategy = _strategy()
    strategy.rapidocr.calls = 0
    # process_pdf only ever asks Tesseract (then EasyOCR) for rendered pages.
    assert strategy.get_engine_by_name("rapidocr") is strategy.rapidocr
    primary, _ = strategy._select_engines(DocumentType.SCANNED_DOCUMENT)
    assert primary is strategy.tesseract


def test_kill_switch_routes_everything_to_tesseract(monkeypatch):
    monkeypatch.setattr(settings, "OCR_RAPIDOCR_ENABLED", False)
    strategy = _strategy()
    for kind in DocumentType:
        primary, _ = strategy._select_engines(kind)
        assert primary is not strategy.rapidocr


def test_primary_engine_setting_accepts_rapidocr_and_defaults_to_it():
    assert Settings(OCR_PRIMARY_ENGINE=" RapidOCR ").OCR_PRIMARY_ENGINE == "rapidocr"
    assert Settings(OCR_PRIMARY_ENGINE="").OCR_PRIMARY_ENGINE == "rapidocr"
    with pytest.raises(Exception):
        Settings(OCR_PRIMARY_ENGINE="other")


# --- fallback --------------------------------------------------------------


def test_photo_falls_back_to_tesseract_when_rapidocr_returns_nothing(monkeypatch):
    strategy = _strategy()
    strategy.rapidocr.result = _result("", 0.0, "RapidOCR")
    result = strategy.process_image("photo.jpg", DocumentType.PHOTO)
    assert result.engine_used == "Tesseract"
    assert strategy.tesseract.calls == 1


def test_good_rapidocr_result_is_kept():
    strategy = _strategy()
    result = strategy.process_image("photo.jpg", DocumentType.PHOTO)
    assert result.engine_used == "RapidOCR"
    assert strategy.tesseract.calls == 0


def test_engine_error_returns_empty_result_without_document_text(caplog):
    engine = RapidOCREngine()

    def boom(_frame):
        raise RuntimeError("SECRET-DOCUMENT-CONTENT")

    RapidOCREngine._engine = boom
    with caplog.at_level("WARNING"):
        result = engine.extract_from_pil_image(_image())

    assert result.text == "" and result.confidence == 0.0
    assert "SECRET-DOCUMENT-CONTENT" not in caplog.text
    assert "RuntimeError" in caplog.text


def test_timeout_returns_empty_result(monkeypatch):
    monkeypatch.setattr(settings, "OCR_RAPIDOCR_TIMEOUT_SECONDS", 0.2)

    def slow(_frame):
        time.sleep(1)
        return _Output(["x"], [0.9])

    RapidOCREngine._engine = slow
    result = RapidOCREngine().extract_from_pil_image(_image())
    assert result.text == ""
    time.sleep(1)  # let the abandoned call finish before the next test


def test_result_joins_lines_and_averages_scores():
    RapidOCREngine._engine = lambda _f: _Output(["Bonjour", "le monde"], [0.8, 0.6])
    result = RapidOCREngine().extract_from_pil_image(_image())
    assert result.text == "Bonjour\nle monde"
    assert result.confidence == pytest.approx(0.7)
    assert result.word_count == 3
    assert result.engine_used == "RapidOCR"


def test_large_image_is_downscaled_to_the_configured_side(monkeypatch):
    seen = {}

    def capture(frame):
        seen["shape"] = frame.shape
        return _Output(["ok"], [0.9])

    monkeypatch.setattr(settings, "OCR_RAPIDOCR_MAX_SIDE", 100)
    RapidOCREngine._engine = capture
    RapidOCREngine().extract_from_pil_image(_image((400, 200)))
    assert max(seen["shape"][:2]) == 100


# --- offline ---------------------------------------------------------------


def test_missing_models_make_the_engine_unavailable_without_network(
    tmp_path, monkeypatch
):
    """No model in the image: no download attempt, empty result, Tesseract takes over."""
    import socket

    def no_network(*_a, **_k):
        raise AssertionError("network access attempted")

    monkeypatch.setattr(socket.socket, "connect", no_network)
    engine = RapidOCREngine(model_dir=str(tmp_path / "absent"))
    result = engine.extract_from_pil_image(_image())

    assert result.text == ""
    assert RapidOCREngine._unavailable is True
    # Second call short-circuits.
    assert engine.extract_from_pil_image(_image()).text == ""


def test_disabled_engine_never_loads_models(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "OCR_RAPIDOCR_ENABLED", False)
    engine = RapidOCREngine(model_dir=str(tmp_path))
    assert engine.extract_from_pil_image(_image()).text == ""
    assert RapidOCREngine._engine is None


def test_default_max_side_keeps_the_memory_peak_bounded():
    # 2000 px measured 755-895 MB, 1600 px 609-695 MB (memory.peak, 2 GB worker).
    assert Settings().OCR_RAPIDOCR_MAX_SIDE == 1600


def test_fallback_switch_off_keeps_the_light_rapidocr_to_tesseract_fallback(
    monkeypatch,
):
    """OCR_FALLBACK_ENABLED only governs the heavy EasyOCR fallback."""
    monkeypatch.setattr(settings, "OCR_FALLBACK_ENABLED", False)
    strategy = _strategy()
    strategy.rapidocr.result = _result("", 0.0, "RapidOCR")  # engine failed
    result = strategy.process_image("photo.jpg", DocumentType.PHOTO)

    assert result.engine_used == "Tesseract"
    assert strategy.tesseract.calls == 1
    assert strategy.easyocr.calls == 0


def test_fallback_switch_off_still_blocks_easyocr_after_weak_tesseract(monkeypatch):
    monkeypatch.setattr(settings, "OCR_FALLBACK_ENABLED", False)
    strategy = _strategy(primary="tesseract")
    strategy.tesseract.result = _result("agrafeuses", 0.57, "Tesseract")
    result = strategy.process_image("photo.jpg", DocumentType.SCANNED_DOCUMENT)

    assert result.engine_used == "Tesseract"
    assert strategy.easyocr.calls == 0
