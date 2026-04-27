"""
Tesseract OCR Engine (SRP: Handle Tesseract-specific OCR)
Best for: Scanned documents, forms, invoices, administrative documents
"""

import time
from PIL import Image
import pytesseract
from .base import OCREngine, OCRResult


class TesseractOCREngine(OCREngine):
    """
    Tesseract OCR Engine

    Strengths:
    - Excellent for clean scanned documents
    - Great for structured forms and invoices
    - Mature, well-tested engine
    - Supports 100+ languages

    Best use cases:
    - PDF scanned documents
    - Administrative forms
    - Invoices and receipts
    - Structured documents
    """

    def __init__(self, languages: list[str] = None):
        """
        Initialize Tesseract engine

        Args:
            languages: List of language codes (default: ['fra', 'eng'])
        """
        self.languages = languages or ["fra", "eng"]
        self._lang_string = "+".join(self.languages)

    @property
    def name(self) -> str:
        return "Tesseract OCR"

    @property
    def best_for(self) -> list[str]:
        return [
            "scanned_documents",
            "forms",
            "invoices",
            "receipts",
            "administrative_documents",
            "structured_text",
        ]

    def supports_language(self, lang_code: str) -> bool:
        """Check if language is supported"""
        # Simplified - in production, check tesseract's available languages
        supported = ["fra", "eng", "ara", "deu", "spa", "ita"]
        return lang_code in supported

    def extract_from_image(self, image_path: str) -> OCRResult:
        """Extract text from image file"""
        image = Image.open(image_path)
        return self.extract_from_pil_image(image)

    def extract_from_pil_image(self, image: Image.Image) -> OCRResult:
        """
        Extract text from PIL Image using Tesseract

        Args:
            image: PIL Image object

        Returns:
            OCRResult with extracted text and metadata
        """
        start_time = time.time()

        try:
            # Extract text
            text = pytesseract.image_to_string(
                image,
                lang=self._lang_string,
                config="--psm 3",  # Fully automatic page segmentation
            )

            # Get confidence data
            data = pytesseract.image_to_data(
                image, lang=self._lang_string, output_type=pytesseract.Output.DICT
            )

            # Calculate average confidence
            confidences = [
                float(conf)
                for conf in data["conf"]
                if conf != "-1"  # -1 means no text detected
            ]
            avg_confidence = (
                sum(confidences) / len(confidences) / 100.0 if confidences else 0.0
            )

            processing_time = time.time() - start_time

            # Count words and chars
            word_count = len([w for w in text.split() if w.strip()])
            char_count = len(text)

            return OCRResult(
                text=text,
                confidence=avg_confidence,
                engine_used=self.name,
                char_count=char_count,
                word_count=word_count,
                processing_time=processing_time,
            )

        except Exception as e:
            print(f"Tesseract error: {e}")
            return OCRResult(
                text="",
                confidence=0.0,
                engine_used=self.name,
                char_count=0,
                word_count=0,
                processing_time=time.time() - start_time,
            )
