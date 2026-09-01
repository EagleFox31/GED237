"""
OCR Strategy - Intelligent engine selection (SRP: Choose the right engine)
"""

from enum import Enum
from typing import Optional

import PyPDF2
from pdf2image import convert_from_path
from PIL import Image

from .base import OCREngine, OCRResult
from .easyocr_engine import EasyOCREngine
from .tesseract_engine import TesseractOCREngine


class DocumentType(Enum):
    """Document type classification"""

    SCANNED_DOCUMENT = "scanned_document"  # Clean scanned doc → Tesseract
    PHOTO = "photo"  # Photo of document → EasyOCR
    SCREENSHOT = "screenshot"  # Screenshot → EasyOCR
    FORM = "form"  # Form/invoice → Tesseract
    UNKNOWN = "unknown"  # Unknown → Try both


class OCRStrategy:
    """
    OCR Strategy - Chooses the best engine for each document type

    Single Responsibility: Select and orchestrate OCR engines based on context

    Decision Logic:
    - Scanned PDFs, forms, invoices → Tesseract (better for structured documents)
    - Photos, screenshots, captures → EasyOCR (better for real-world images)
    - Unknown → Try Tesseract first (faster), fallback to EasyOCR if low confidence
    """

    def __init__(self):
        self.tesseract = TesseractOCREngine()
        self.easyocr = EasyOCREngine()

    @staticmethod
    def _should_use_fallback(result: OCRResult) -> bool:
        """Fallback when the primary engine failed or produced weak OCR."""
        return not result.text.strip() or not result.is_reliable

    @staticmethod
    def _prefer_fallback(primary: OCRResult, fallback: OCRResult) -> bool:
        """Prefer a fallback that recovers missing text or improves confidence."""
        if not fallback.text.strip():
            return False
        if not primary.text.strip():
            return True
        return fallback.confidence > primary.confidence

    def process_image(
        self,
        image_path: str,
        document_type: Optional[DocumentType] = None,
        try_fallback: bool = True,
    ) -> OCRResult:
        """
        Process image with intelligent engine selection

        Args:
            image_path: Path to image file
            document_type: Hint about document type (auto-detect if None)
            try_fallback: Try alternative engine if first one fails

        Returns:
            OCRResult from the best engine
        """
        # Auto-detect document type if not provided
        if document_type is None:
            document_type = self._detect_document_type(image_path)

        # Select engine based on document type
        primary_engine, fallback_engine = self._select_engines(document_type)

        print(f"OCR Strategy: Using {primary_engine.name} for {document_type.value}")

        # Try primary engine
        result = primary_engine.extract_from_image(image_path)

        # Try fallback if the primary result is empty or unreliable.
        if try_fallback and self._should_use_fallback(result):
            print(
                f"⚠️ Primary OCR weak/empty ({result.confidence:.2%}), "
                f"trying fallback engine: {fallback_engine.name}"
            )
            fallback_result = fallback_engine.extract_from_image(image_path)

            if self._prefer_fallback(result, fallback_result):
                print(
                    f"✓ Fallback engine selected "
                    f"({fallback_result.confidence:.2%} vs {result.confidence:.2%})"
                )
                return fallback_result

        return result

    def process_pdf(self, pdf_path: str) -> tuple[str, float]:
        """
        Process PDF - extract native text first, then OCR scanned pages if needed.

        Args:
            pdf_path: Path to PDF file

        Returns:
            Tuple of (text, confidence)
        """
        try:
            # Try native text extraction first (fast).
            text = ""
            with open(pdf_path, "rb") as file:
                reader = PyPDF2.PdfReader(file)
                for page in reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"

            if text.strip():
                print("PDF: Native text extraction successful")
                return text, 0.95

            # No native text: render pages and OCR them.
            print("PDF: No native text found. Running OCR on scanned pages.")
            pages = convert_from_path(pdf_path, dpi=200)
            extracted_pages: list[str] = []
            confidences: list[float] = []

            for page_number, page_image in enumerate(pages, start=1):
                result = self.tesseract.extract_from_pil_image(page_image)

                if self._should_use_fallback(result):
                    fallback_result = self.easyocr.extract_from_pil_image(page_image)
                    if self._prefer_fallback(result, fallback_result):
                        result = fallback_result

                if result.text.strip():
                    extracted_pages.append(result.text.strip())
                    confidences.append(result.confidence)
                else:
                    print(f"PDF: No OCR text extracted from page {page_number}")

            if not extracted_pages:
                return "", 0.0

            average_confidence = sum(confidences) / len(confidences)
            return "\n\n".join(extracted_pages), average_confidence

        except Exception as e:
            print(f"PDF extraction error: {e}")
            return "", 0.0

    def _detect_document_type(self, image_path: str) -> DocumentType:
        """
        Auto-detect document type based on image characteristics

        Simple heuristics for MVP:
        - Check filename for hints
        - Could be enhanced with ML-based classification

        Args:
            image_path: Path to image

        Returns:
            Detected DocumentType
        """
        filename_lower = image_path.lower()

        # Check filename for hints
        if any(keyword in filename_lower for keyword in ["scan", "scanner", "scanned"]):
            return DocumentType.SCANNED_DOCUMENT

        if any(keyword in filename_lower for keyword in ["photo", "img", "camera"]):
            return DocumentType.PHOTO

        if any(
            keyword in filename_lower for keyword in ["screenshot", "capture", "screen"]
        ):
            return DocumentType.SCREENSHOT

        if any(
            keyword in filename_lower
            for keyword in ["form", "formulaire", "invoice", "facture"]
        ):
            return DocumentType.FORM

        # Default: unknown
        return DocumentType.UNKNOWN

    def _select_engines(
        self, document_type: DocumentType
    ) -> tuple[OCREngine, OCREngine]:
        """
        Select primary and fallback engines based on document type

        Args:
            document_type: Type of document

        Returns:
            Tuple of (primary_engine, fallback_engine)
        """
        # Tesseract-first scenarios
        if document_type in [
            DocumentType.SCANNED_DOCUMENT,
            DocumentType.FORM,
            DocumentType.UNKNOWN,
        ]:
            return self.tesseract, self.easyocr

        # EasyOCR-first scenarios
        elif document_type in [DocumentType.PHOTO, DocumentType.SCREENSHOT]:
            return self.easyocr, self.tesseract

        # Default
        return self.tesseract, self.easyocr

    def get_engine_by_name(self, engine_name: str) -> Optional[OCREngine]:
        """Get specific engine by name"""
        engines = {
            "tesseract": self.tesseract,
            "easyocr": self.easyocr,
        }
        return engines.get(engine_name.lower())
