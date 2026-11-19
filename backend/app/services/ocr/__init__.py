"""
OCR Service Package
Provides multiple OCR engines with strategy pattern
"""

from .base import OCREngine, OCRResult
from .tesseract_engine import TesseractOCREngine
from .easyocr_engine import EasyOCREngine
from .rapidocr_engine import RapidOCREngine
from .strategy import OCRStrategy

__all__ = [
    "OCREngine",
    "OCRResult",
    "TesseractOCREngine",
    "EasyOCREngine",
    "RapidOCREngine",
    "OCRStrategy",
]
