"""
EasyOCR Engine (SRP: Handle EasyOCR-specific OCR)
Best for: Photos, screenshots, real-world images, scene text
"""

import logging
import time
from PIL import Image
import numpy as np
import easyocr
from .base import OCREngine, OCRResult

try:
    import torch
except ImportError:  # pragma: no cover - depends on optional runtime install
    torch = None

logger = logging.getLogger(__name__)


class EasyOCREngine(OCREngine):
    """
    EasyOCR Engine (Deep Learning based)

    Strengths:
    - Excellent for photos and screenshots
    - Great for real-world scene text
    - Robust to rotation and perspective
    - Modern deep learning approach (CRAFT + CRNN)

    Best use cases:
    - Phone camera photos of documents
    - Screenshots
    - Captures from apps
    - Text in natural scenes
    - Rotated or skewed images
    """

    # Cache readers by (languages, gpu_mode) to avoid rebuilding models.
    _readers: dict[tuple[tuple[str, ...], bool], easyocr.Reader] = {}

    def __init__(self, languages: list[str] = None, use_gpu: bool | None = None):
        """
        Initialize EasyOCR engine

        Args:
            languages: List of language codes (default: ['fr', 'en'])
            use_gpu: `None` = auto-detect, otherwise force CPU/GPU preference
        """
        self.languages = languages or ["fr", "en"]
        self.use_gpu = self._resolve_gpu_mode(use_gpu)
        self._reader_key = (tuple(self.languages), self.use_gpu)
        self._ensure_reader()

    @staticmethod
    def _resolve_gpu_mode(requested: bool | None) -> bool:
        """Resolve GPU usage without making CUDA mandatory."""
        gpu_available = bool(torch and torch.cuda.is_available())
        if requested is None:
            return gpu_available
        if requested and not gpu_available:
            logger.warning(
                "EasyOCR GPU requested but CUDA is unavailable. Falling back to CPU."
            )
            return False
        return requested

    def _ensure_reader(self):
        """Lazy initialization of EasyOCR reader with CPU/GPU aware caching."""
        if self._reader_key not in EasyOCREngine._readers:
            mode = "GPU" if self.use_gpu else "CPU"
            logger.info(
                "Initializing EasyOCR reader for languages=%s using %s mode",
                ",".join(self.languages),
                mode,
            )
            logger.info(
                "EasyOCR first initialization may take time while models download."
            )
            EasyOCREngine._readers[self._reader_key] = easyocr.Reader(
                self.languages, gpu=self.use_gpu
            )
            logger.info("EasyOCR reader ready in %s mode", mode)

    @property
    def reader(self) -> easyocr.Reader:
        return EasyOCREngine._readers[self._reader_key]

    @property
    def name(self) -> str:
        return "EasyOCR"

    @property
    def best_for(self) -> list[str]:
        return [
            "photos",
            "screenshots",
            "captures",
            "scene_text",
            "rotated_images",
            "skewed_images",
            "natural_images",
        ]

    def supports_language(self, lang_code: str) -> bool:
        """Check if language is supported"""
        # EasyOCR supports 80+ languages
        supported = ["fr", "en", "ar", "de", "es", "it", "pt", "ru", "zh", "ja"]
        return lang_code in supported

    def extract_from_image(self, image_path: str) -> OCRResult:
        """Extract text from image file"""
        image = Image.open(image_path)
        return self.extract_from_pil_image(image)

    def extract_from_pil_image(self, image: Image.Image) -> OCRResult:
        """
        Extract text from PIL Image using EasyOCR

        Args:
            image: PIL Image object

        Returns:
            OCRResult with extracted text and metadata
        """
        start_time = time.time()

        try:
            # Convert PIL Image to numpy array
            image_np = np.array(image)

            # Perform OCR
            results = self.reader.readtext(image_np)

            # Extract text and confidences
            text_parts = []
            confidences = []

            for bbox, text, conf in results:
                text_parts.append(text)
                confidences.append(conf)

            # Combine text
            extracted_text = " ".join(text_parts)

            # Calculate average confidence
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

            processing_time = time.time() - start_time

            # Count words and chars
            word_count = len([w for w in extracted_text.split() if w.strip()])
            char_count = len(extracted_text)

            logger.info(
                "EasyOCR extracted %s text segments with %.2f%% confidence in %.2fs",
                len(text_parts),
                avg_confidence * 100,
                processing_time,
            )

            return OCRResult(
                text=extracted_text,
                confidence=avg_confidence,
                engine_used=self.name,
                char_count=char_count,
                word_count=word_count,
                processing_time=processing_time,
            )

        except Exception:
            logger.exception("EasyOCR extraction failed")
            return OCRResult(
                text="",
                confidence=0.0,
                engine_used=self.name,
                char_count=0,
                word_count=0,
                processing_time=time.time() - start_time,
            )
