"""
Celery tasks for document processing
Refactored to use OCR Strategy pattern with SRP
"""

import os
import asyncio
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from sqlalchemy.sql import func

from app.workers.celery_app import celery_app
from app.models.document import Document
from app.core.config import settings


# Async engine for database updates from the worker
async_engine = create_async_engine(
    settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"), echo=False
)
AsyncSessionLocal = sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False
)


async def update_document_ocr(
    document_id: str, text: str, confidence: float = None, engine_used: str = None
):
    """
    Update document with OCR results

    Single Responsibility: Database update only
    """
    async with AsyncSessionLocal() as session:
        document = await session.get(Document, document_id)
        if document:
            document.ocr_content = text

            # Index text in Postgres TSVECTOR
            document.ocr_content_vector = func.to_tsvector("french", text)

            # Store OCR metadata in extra_data
            if not document.extra_data:
                document.extra_data = {}

            document.extra_data["ocr_confidence"] = confidence
            document.extra_data["ocr_engine"] = engine_used

            await session.commit()


@celery_app.task(name="app.workers.tasks.process_document_ocr")
def process_document_ocr(document_id: str, file_path: str, file_type: str):
    """
    Process document OCR using intelligent strategy

    Single Responsibility: Orchestrate OCR processing

    Strategy:
    - Images → Auto-select between Tesseract/EasyOCR based on context
    - PDFs → Native extraction first, then OCR if needed
    - Fallback enabled for reliability
    """
    print(f"Starting OCR processing for document: {document_id}")
    print(f"  File: {file_path}")
    print(f"  Type: {file_type}")

    # 1. Resolve full path
    full_path = os.path.join(settings.STORAGE_PATH, file_path)

    if not os.path.exists(full_path):
        print(f"❌ File not found for OCR: {full_path}")
        return False

    # 2. Initialize OCR Strategy lazily so API/tests don't import heavy OCR deps at startup
    from app.services.ocr import OCRStrategy

    strategy = OCRStrategy()

    extracted_text = ""
    confidence = 0.0
    engine_used = "none"

    try:
        # 3. Process based on file type
        if file_type == "application/pdf":
            # PDF: Try native extraction first
            extracted_text, confidence = strategy.process_pdf(full_path)
            engine_used = "PyPDF2 (native)"

        elif file_type and file_type.startswith("image/"):
            # Image: Use intelligent strategy
            result = strategy.process_image(
                full_path,
                document_type=None,  # Auto-detect
                try_fallback=True,  # Enable fallback
            )

            extracted_text = result.text
            confidence = result.confidence
            engine_used = result.engine_used

        else:
            print(f"❌ Unsupported file type for OCR: {file_type}")
            return False

        # 4. Update database if text was extracted
        if extracted_text and extracted_text.strip():
            # Run async database update
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            loop.run_until_complete(
                update_document_ocr(
                    document_id, extracted_text, confidence, engine_used
                )
            )

            # Log results
            print(f"✓ OCR completed successfully for {document_id}")
            print(f"  Engine: {engine_used}")
            print(f"  Extracted: {len(extracted_text)} characters")
            print(f"  Confidence: {confidence:.2%}")

            # Warn if confidence is low
            if confidence < 0.7:
                print("  ⚠️ WARNING: Low confidence. Manual review recommended.")

            return True

        else:
            print(f"❌ No text extracted for {document_id}")
            return False

    except Exception as e:
        print(f"❌ OCR processing failed for {document_id}: {e}")
        import traceback

        traceback.print_exc()
        return False
