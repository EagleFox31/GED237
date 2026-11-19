import pytest
from PIL import Image

from app.core.config import Settings, settings
from app.services.ocr.base import OCRResult
from app.services.ocr.strategy import DocumentType, OCRStrategy


@pytest.fixture(autouse=True)
def _fallback_enabled(monkeypatch):
    # The shipped default is off; the existing scenarios exercise the fallback itself.
    monkeypatch.setattr(settings, "OCR_FALLBACK_ENABLED", True)


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


def _photo_strategy(primary_engine: str) -> OCRStrategy:
    strategy = OCRStrategy(primary_engine=primary_engine)
    strategy.tesseract = FakeEngine(_result("Texte photo", 0.90, "tesseract"))
    strategy.easyocr = FakeEngine(_result("Autre texte", 0.99, "easyocr"))
    strategy.easyocr.name = "easyocr"
    return strategy


def test_photo_does_not_load_easyocr_when_primary_engine_is_tesseract(monkeypatch):
    strategy = _photo_strategy("tesseract")
    monkeypatch.setattr(
        strategy, "_detect_document_type", lambda _path: DocumentType.PHOTO
    )

    result = strategy.process_image("photo.jpg")

    assert result.engine_used == "tesseract"
    assert strategy.tesseract.calls == 1
    assert strategy.easyocr.calls == 0


def test_photo_falls_back_to_easyocr_when_tesseract_is_weak(monkeypatch):
    strategy = _photo_strategy("tesseract")
    strategy.tesseract.result = _result("", 0.0, "tesseract")
    monkeypatch.setattr(
        strategy, "_detect_document_type", lambda _path: DocumentType.SCREENSHOT
    )

    result = strategy.process_image("capture.png")

    assert strategy.easyocr.calls == 1
    assert result.engine_used == "easyocr"


def test_photo_keeps_easyocr_first_when_primary_engine_is_easyocr(monkeypatch):
    """Existing behaviour, unchanged for deployments that opt in."""
    strategy = _photo_strategy("easyocr")
    monkeypatch.setattr(
        strategy, "_detect_document_type", lambda _path: DocumentType.PHOTO
    )

    result = strategy.process_image("photo.jpg")

    assert result.engine_used == "easyocr"
    assert strategy.easyocr.calls == 1
    assert strategy.tesseract.calls == 0


def test_scanned_documents_stay_tesseract_first_with_either_setting():
    for engine in ("tesseract", "easyocr"):
        strategy = OCRStrategy(primary_engine=engine)
        for kind in (
            DocumentType.SCANNED_DOCUMENT,
            DocumentType.FORM,
            DocumentType.UNKNOWN,
        ):
            primary, fallback = strategy._select_engines(kind)
            assert primary is strategy.tesseract
            assert fallback is strategy.easyocr


def test_primary_engine_setting_is_validated():
    import pytest
    from pydantic import ValidationError

    from app.core.config import Settings

    assert Settings(OCR_PRIMARY_ENGINE=" EasyOCR ").OCR_PRIMARY_ENGINE == "easyocr"
    assert Settings(OCR_PRIMARY_ENGINE="").OCR_PRIMARY_ENGINE == "rapidocr"
    with pytest.raises(ValidationError):
        Settings(OCR_PRIMARY_ENGINE="paddle")


def test_easyocr_receives_an_image_of_at_most_2000_px(monkeypatch):
    """A 12 MP photo must not reach torch at full size (worker OOM)."""
    from app.services.ocr.easyocr_engine import EasyOCREngine

    seen = []

    class FakeReader:
        def readtext(self, array):
            seen.append(array.shape)
            return []

    monkeypatch.setattr(EasyOCREngine, "_unavailable", set())
    monkeypatch.setattr(EasyOCREngine, "reader", property(lambda _self: FakeReader()))

    EasyOCREngine().extract_from_pil_image(Image.new("RGB", (4000, 3000)))
    EasyOCREngine().extract_from_pil_image(Image.new("RGB", (800, 600)))

    assert seen[0] == (1500, 2000, 3)  # (height, width, channels), ratio kept
    assert seen[1] == (600, 800, 3)  # small image untouched


# --- OCR_FALLBACK_ENABLED ----------------------------------------------------


def test_fallback_is_disabled_by_default():
    assert Settings().OCR_FALLBACK_ENABLED is False


def test_disabled_fallback_keeps_weak_tesseract_text_and_never_loads_easyocr(
    monkeypatch,
):
    monkeypatch.setattr(settings, "OCR_FALLBACK_ENABLED", False)
    strategy = _photo_strategy("tesseract")
    strategy.tesseract.result = _result("agrafeuses", 0.57, "tesseract")
    monkeypatch.setattr(
        strategy, "_detect_document_type", lambda _path: DocumentType.PHOTO
    )

    result = strategy.process_image("IMG_0413.jpg")

    assert result.text == "agrafeuses"
    assert result.engine_used == "tesseract"
    assert strategy.easyocr.calls == 0


def test_enabled_fallback_still_replaces_weak_text(monkeypatch):
    monkeypatch.setattr(settings, "OCR_FALLBACK_ENABLED", True)
    strategy = _photo_strategy("tesseract")
    strategy.tesseract.result = _result("agrafeuses", 0.57, "tesseract")
    monkeypatch.setattr(
        strategy, "_detect_document_type", lambda _path: DocumentType.PHOTO
    )

    result = strategy.process_image("IMG_0413.jpg")

    assert strategy.easyocr.calls == 1
    assert result.engine_used == "easyocr"


def test_disabled_fallback_never_loads_easyocr_for_scanned_pdf_pages(
    monkeypatch, tmp_path
):
    monkeypatch.setattr(settings, "OCR_FALLBACK_ENABLED", False)
    strategy = _photo_strategy("tesseract")
    weak = _result("page faible", 0.30, "tesseract")

    class _Tesseract:
        def extract_from_pil_image(self, _image):
            return weak

    class _Easy:
        calls = 0

        def extract_from_pil_image(self, _image):
            _Easy.calls += 1
            return _result("autre", 0.99, "easyocr")

    strategy.tesseract = _Tesseract()
    strategy.easyocr = _Easy()
    monkeypatch.setattr("app.services.ocr.strategy.PdfReader", _EmptyReader)
    monkeypatch.setattr(
        "app.services.ocr.strategy.convert_from_path",
        lambda *_a, **_k: [Image.new("RGB", (10, 10))],
    )

    pdf = tmp_path / "scan.pdf"
    pdf.write_bytes(b"%PDF-1.4")

    text, _confidence = strategy.process_pdf(str(pdf))

    assert text == "page faible"
    assert _Easy.calls == 0


class _EmptyReader:
    def __init__(self, _file):
        self.pages = []


def _pdf_strategy(monkeypatch, pages, tesseract_result):
    strategy = OCRStrategy.__new__(OCRStrategy)

    class _Tesseract:
        def extract_from_pil_image(self, _image):
            return tesseract_result

    strategy.tesseract = _Tesseract()

    class _Page:
        def __init__(self, text):
            self._text = text

        def extract_text(self):
            return self._text

    class _Reader:
        def __init__(self, _file):
            self.pages = [_Page(t) for t in pages]

    monkeypatch.setattr("app.services.ocr.strategy.PdfReader", _Reader)
    monkeypatch.setattr(
        "app.services.ocr.strategy.convert_from_path",
        lambda *_a, **_k: [Image.new("RGB", (10, 10))],
    )
    return strategy


def test_pdf_with_native_text_reports_the_native_engine(monkeypatch, tmp_path):
    strategy = _pdf_strategy(monkeypatch, ["Bonjour"], _result("", 0.0, "Tesseract"))
    pdf = tmp_path / "native.pdf"
    pdf.write_bytes(b"%PDF-1.4")

    text, confidence, engine = strategy.process_pdf_with_engine(str(pdf))

    assert text.strip() == "Bonjour"
    assert engine == "pypdf (native)"
    assert strategy.process_pdf(str(pdf)) == (text, confidence)


def test_scanned_pdf_reports_the_ocr_engine_not_pypdf(monkeypatch, tmp_path):
    strategy = _pdf_strategy(
        monkeypatch, [None], _result("Texte scanné", 0.9, "Tesseract")
    )
    pdf = tmp_path / "scan.pdf"
    pdf.write_bytes(b"%PDF-1.4")

    text, _confidence, engine = strategy.process_pdf_with_engine(str(pdf))

    assert text == "Texte scanné"
    assert engine == "Tesseract"


def test_pdf_without_any_text_reports_no_engine(monkeypatch, tmp_path):
    strategy = _pdf_strategy(monkeypatch, [None], _result("", 0.0, "Tesseract"))
    pdf = tmp_path / "blank.pdf"
    pdf.write_bytes(b"%PDF-1.4")

    assert strategy.process_pdf_with_engine(str(pdf)) == ("", 0.0, "none")


def _mixed_pdf(path):
    """2-page PDF built here: page 1 has native text, page 2 is an image only."""
    import io

    from pypdf import PdfReader as RealReader
    from pypdf import PdfWriter

    stream = b"BT /F1 24 Tf 72 700 Td (Page texte natif) Tj ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length "
        + str(len(stream)).encode()
        + b" >>\nstream\n"
        + stream
        + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    body = b"%PDF-1.4\n"
    offsets = []
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(body))
        body += f"{number} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(body)
    body += f"xref\n0 {len(objects) + 1}\n".encode() + b"0000000000 65535 f \n"
    for offset in offsets:
        body += f"{offset:010d} 00000 n \n".encode()
    body += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref}\n%%EOF\n"
    ).encode()

    image_pdf = io.BytesIO()
    Image.new("RGB", (200, 200), "white").save(image_pdf, format="PDF")
    image_pdf.seek(0)

    writer = PdfWriter()
    writer.append(RealReader(io.BytesIO(body)))
    writer.append(RealReader(image_pdf))
    with open(path, "wb") as out:
        writer.write(out)


def test_mixed_pdf_keeps_native_page_and_ocrs_the_image_only_page(
    monkeypatch, tmp_path
):
    pdf = tmp_path / "mixed.pdf"
    _mixed_pdf(pdf)

    strategy = OCRStrategy.__new__(OCRStrategy)
    ocr_calls = []

    class _Tesseract:
        def extract_from_pil_image(self, _image):
            ocr_calls.append(1)
            return _result("Page scannée", 0.8, "Tesseract")

    strategy.tesseract = _Tesseract()
    monkeypatch.setattr(
        "app.services.ocr.strategy.convert_from_path",
        lambda *_a, **_k: [Image.new("RGB", (10, 10)), Image.new("RGB", (10, 10))],
    )

    text, confidence, engine = strategy.process_pdf_with_engine(str(pdf))

    assert "Page texte natif" in text and "Page scannée" in text
    assert text.index("Page texte natif") < text.index("Page scannée")
    assert len(ocr_calls) == 1  # only the image-only page is OCRed
    assert engine == "pypdf (native) + Tesseract"
    assert confidence == pytest.approx((0.95 + 0.8) / 2)
