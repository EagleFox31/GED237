"""
Base OCR Engine - Abstract Interface (SRP: Define contract)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
from PIL import Image


@dataclass
class OCRResult:
    """OCR result with metadata"""

    text: str
    confidence: float
    engine_used: str
    char_count: int
    word_count: int
    processing_time: Optional[float] = None

    @property
    def is_reliable(self) -> bool:
        """Check if result is reliable (>70% confidence)"""
        return self.confidence >= 0.7

    @property
    def needs_review(self) -> bool:
        """Check if manual review is recommended"""
        return self.confidence < 0.7


class OCREngine(ABC):
    """
    Abstract OCR Engine
    Single Responsibility: Define the interface for all OCR engines
    """

    @abstractmethod
    def extract_from_image(self, image_path: str) -> OCRResult:
        """
        Extract text from image file

        Args:
            image_path: Path to image file

        Returns:
            OCRResult with extracted text and metadata
        """
        pass

    @abstractmethod
    def extract_from_pil_image(self, image: Image.Image) -> OCRResult:
        """
        Extract text from PIL Image object

        Args:
            image: PIL Image object

        Returns:
            OCRResult with extracted text and metadata
        """
        pass

    @abstractmethod
    def supports_language(self, lang_code: str) -> bool:
        """Check if engine supports a specific language"""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Engine name for logging"""
        pass

    @property
    @abstractmethod
    def best_for(self) -> list[str]:
        """List of use cases this engine is optimized for"""
        pass
