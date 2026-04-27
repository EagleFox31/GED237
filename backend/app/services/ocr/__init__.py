"""
OCR Service Package
Provides multiple OCR engines with strategy pattern
"""

from .base import OCREngine, OCRResult
from .tesseract_engine import TesseractOCREngine
from .easyocr_engine import EasyOCREngine
from .strategy import OCRStrategy

__all__ = [
    "OCREngine",
    "OCRResult",
    "TesseractOCREngine",
    "EasyOCREngine",
    "OCRStrategy",
]
