from PIL import Image

from app.services.ocr.base import OCRResult
from app.services.ocr.strategy import DocumentType, OCRStrategy


class FakeEngine:
    def __init__(self, result: OCRResult):
        self.result = result
        self.calls = 0
        self.name = "fake"

    def extract_from_image(self, _image_path: str) -> OCRResult:
        self.calls += 1
        return self.result


def _result(text: str, confidence: float, engine: str = "fake") -> OCRResult:
    return OCRResult(
        text=text,
        confidence=confidence,
        engine_used=engine,
        char_count=len(text),
        word_count=len(text.split()),
    )


def test_fallback_is_used_when_primary_result_is_empty(monkeypatch):
    strategy = OCRStrategy.__new__(OCRStrategy)
    primary = FakeEngine(_result("", 0.0, "primary"))
    fallback = FakeEngine(_result("Recovered text", 0.88, "fallback"))

    monkeypatch.setattr(
        strategy, "_detect_document_type", lambda _path: DocumentType.UNKNOWN
    )
    monkeypatch.setattr(strategy, "_select_engines", lambda _type: (primary, fallback))

    result = strategy.process_image("scan.png")

    assert primary.calls == 1
    assert fallback.calls == 1
    assert result.text == "Recovered text"
    assert result.engine_used == "fallback"


def test_reliable_primary_result_does_not_trigger_fallback(monkeypatch):
    strategy = OCRStrategy.__new__(OCRStrategy)
    primary = FakeEngine(_result("Good text", 0.92, "primary"))
    fallback = FakeEngine(_result("Other text", 0.99, "fallback"))

    monkeypatch.setattr(
        strategy, "_detect_document_type", lambda _path: DocumentType.UNKNOWN
    )
    monkeypatch.setattr(strategy, "_select_engines", lambda _type: (primary, fallback))

    result = strategy.process_image("scan.png")

    assert primary.calls == 1
    assert fallback.calls == 0
    assert result.text == "Good text"
    assert result.engine_used == "primary"


def test_empty_fallback_does_not_replace_existing_primary_text():
    primary = _result("Some text", 0.35, "primary")
    fallback = _result("", 0.0, "fallback")

    assert OCRStrategy._prefer_fallback(primary, fallback) is False


def test_strategy_builds_and_keeps_tesseract_text_without_easyocr_models(
    monkeypatch, tmp_path
):
    """No model on disk and no download: OCR still works with Tesseract (V1.0).

    The engine used to load its models in its constructor, so an offline image
    could not even build OCRStrategy and every OCR task failed.
    """
    from app.services.ocr.easyocr_engine import EasyOCREngine

    monkeypatch.setenv("EASYOCR_MODEL_DIR", str(tmp_path))
    monkeypatch.setattr(EasyOCREngine, "_readers", {})
    monkeypatch.setattr(EasyOCREngine, "_unavailable", set())

    strategy = OCRStrategy()  # must not raise, nor touch the network

    weak = _result("Texte scanne", 0.30, "tesseract")
    tesseract = FakeEngine(weak)
    monkeypatch.setattr(strategy, "tesseract", tesseract)
    monkeypatch.setattr(
        strategy, "_detect_document_type", lambda _path: DocumentType.UNKNOWN
    )
    monkeypatch.setattr(
        strategy, "_select_engines", lambda _t: (tesseract, strategy.easyocr)
    )
    strategy.easyocr.extract_from_image = (
        lambda _p: strategy.easyocr.extract_from_pil_image(Image.new("RGB", (10, 10)))
    )

    result = strategy.process_image("scan.png")

    assert result.text == "Texte scanne"
    assert result.engine_used == "tesseract"
    # Unavailable once: the next call answers at once, without retrying the load.
    assert strategy.easyocr._reader_key in EasyOCREngine._unavailable
