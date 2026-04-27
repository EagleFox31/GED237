"""
OCR Strategy - Intelligent engine selection (SRP: Choose the right engine)
"""

from enum import Enum
from typing import Optional
from PIL import Image
import PyPDF2
from .base import OCREngine, OCRResult
from .tesseract_engine import TesseractOCREngine
from .easyocr_engine import EasyOCREngine


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

        # Try fallback if result is poor and fallback is enabled
        if try_fallback and not result.is_reliable and result.text:
            print(
                f"⚠️ Low confidence ({result.confidence:.2%}), "
                f"trying fallback engine: {fallback_engine.name}"
            )
            fallback_result = fallback_engine.extract_from_image(image_path)

            # Use fallback if it's better
            if fallback_result.confidence > result.confidence:
                print(
                    f"✓ Fallback engine performed better "
                    f"({fallback_result.confidence:.2%} vs {result.confidence:.2%})"
                )
                return fallback_result

        return result

    def process_pdf(self, pdf_path: str) -> tuple[str, float]:
        """
        Process PDF - extract native text first, OCR if needed

        Args:
            pdf_path: Path to PDF file

        Returns:
            Tuple of (text, confidence)
        """
        try:
            # Try native text extraction first (fast)
            text = ""
            with open(pdf_path, "rb") as file:
                reader = PyPDF2.PdfReader(file)
                for page in reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"

            if text.strip():
                # Native text extraction successful
                print("PDF: Native text extraction successful")
                return text, 0.95

            # No text found - might be scanned PDF
            print("PDF: No native text found. This appears to be a scanned PDF.")
            print(
                "⚠️ Note: OCR on scanned PDFs requires pdf2image (not yet implemented)"
            )
            return "", 0.0

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
