"""
OCR Service Package
Provides multiple OCR engines with strategy pattern

The engines load lazily (PEP 562): importing the package, or app.services.ocr.base for the
confidence threshold, must not pull EasyOCR and torch into the API process.
"""

from importlib import import_module

from .base import LOW_CONFIDENCE_THRESHOLD, OCREngine, OCRResult, is_low_confidence

_LAZY = {
    "TesseractOCREngine": ".tesseract_engine",
    "EasyOCREngine": ".easyocr_engine",
    "RapidOCREngine": ".rapidocr_engine",
    "OCRStrategy": ".strategy",
}


def __getattr__(name: str):
    if name in _LAZY:
        return getattr(import_module(_LAZY[name], __name__), name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "LOW_CONFIDENCE_THRESHOLD",
    "OCREngine",
    "OCRResult",
    "is_low_confidence",
    "TesseractOCREngine",
    "EasyOCREngine",
    "RapidOCREngine",
    "OCRStrategy",
]
