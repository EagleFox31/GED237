"""
RapidOCR engine (PP-OCRv5 latin, ONNX Runtime) - light OCR for photos, captures
and forms.

Same contract as the EasyOCR adapter: an unavailable engine (models missing, load
error), an error or a timeout returns an empty result, and the strategy falls back
to Tesseract. Models are baked into the image (RAPIDOCR_MODEL_DIR, see the
Dockerfile); nothing is downloaded at runtime.
"""

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image

from app.core.config import settings

from .base import OCREngine, OCRResult
from .rapidocr_params import rapidocr_params

logger = logging.getLogger(__name__)

# Languages the PP-OCRv5 latin recognizer reads (fr, en and the other latin scripts).
_LATIN_LANGS = {"fr", "en", "de", "es", "it", "pt", "nl", "ro", "pl", "tr"}


class RapidOCREngine(OCREngine):
    """RapidOCR PP-OCRv5 latin (mobile). One lazily loaded engine per process."""

    _engine = None
    _unavailable = False
    _lock = threading.Lock()
    # One OCR call at a time per process (worker concurrency is 1 as well); the
    # single thread lets a call be abandoned on timeout without blocking the caller.
    _pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="rapidocr")

    def __init__(self, model_dir: Optional[str] = None):
        self.model_dir = model_dir or settings.RAPIDOCR_MODEL_DIR

    @property
    def name(self) -> str:
        return "RapidOCR"

    @property
    def best_for(self) -> list[str]:
        return ["photos", "screenshots", "captures", "forms"]

    def supports_language(self, lang_code: str) -> bool:
        return lang_code in _LATIN_LANGS

    @staticmethod
    def _empty(start: float) -> OCRResult:
        return OCRResult(
            text="",
            confidence=0.0,
            engine_used="RapidOCR",
            char_count=0,
            word_count=0,
            processing_time=time.time() - start,
        )

    def _models_present(self) -> bool:
        root = Path(self.model_dir)
        return root.is_dir() and len(list(root.glob("*.onnx"))) >= 2

    def _ensure_engine(self):
        with RapidOCREngine._lock:
            if RapidOCREngine._engine is not None:
                return RapidOCREngine._engine
            # Never download at runtime: models must already be in the image.
            if not self._models_present():
                raise FileNotFoundError(f"RapidOCR models missing in {self.model_dir}")
            from rapidocr import RapidOCR

            logger.info(
                "Initializing RapidOCR (PP-OCRv5 latin) from %s", self.model_dir
            )
            RapidOCREngine._engine = RapidOCR(params=rapidocr_params(self.model_dir))
            return RapidOCREngine._engine

    @staticmethod
    def _downscale(image: Image.Image, max_side: int) -> Image.Image:
        """Longest side capped (memory is proportional to the pixel count)."""
        longest = max(image.size)
        if max_side <= 0 or longest <= max_side:
            return image
        ratio = max_side / longest
        return image.resize(
            (max(1, round(image.width * ratio)), max(1, round(image.height * ratio))),
            Image.LANCZOS,
        )

    def extract_from_image(self, image_path: str) -> OCRResult:
        with Image.open(image_path) as image:
            return self.extract_from_pil_image(image)

    def extract_from_pil_image(self, image: Image.Image) -> OCRResult:
        start = time.time()
        if not settings.OCR_RAPIDOCR_ENABLED or RapidOCREngine._unavailable:
            return self._empty(start)

        try:
            engine = self._ensure_engine()
        except Exception as exc:
            RapidOCREngine._unavailable = True
            logger.warning("RapidOCR unavailable (%s): falling back to Tesseract.", exc)
            return self._empty(start)

        try:
            frame = np.array(
                self._downscale(image, settings.OCR_RAPIDOCR_MAX_SIDE).convert("RGB")
            )
            future = RapidOCREngine._pool.submit(engine, frame)
            output = future.result(timeout=settings.OCR_RAPIDOCR_TIMEOUT_SECONDS)
        except FutureTimeout:
            logger.warning(
                "RapidOCR timed out after %ss: falling back to Tesseract.",
                settings.OCR_RAPIDOCR_TIMEOUT_SECONDS,
            )
            return self._empty(start)
        except Exception as exc:
            # Type only: the message could carry document content.
            logger.warning(
                "RapidOCR failed (%s): falling back to Tesseract.", type(exc).__name__
            )
            return self._empty(start)

        texts = list(getattr(output, "txts", None) or [])
        scores = [float(s) for s in (getattr(output, "scores", None) or [])]
        text = "\n".join(texts)
        confidence = sum(scores) / len(scores) if scores else 0.0
        elapsed = time.time() - start
        logger.info(
            "RapidOCR read %s segments, confidence %.0f%%, %.2fs",
            len(texts),
            confidence * 100,
            elapsed,
        )
        return OCRResult(
            text=text,
            confidence=confidence,
            engine_used=self.name,
            char_count=len(text),
            word_count=len(text.split()),
            processing_time=elapsed,
        )
