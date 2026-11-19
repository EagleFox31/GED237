FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Install system dependencies required by PostgreSQL tooling and OCR.
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    tesseract-ocr \
    tesseract-ocr-fra \
    tesseract-ocr-eng \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install CPU-only PyTorch wheels first. EasyOCR needs torch/torchvision, but
# the default Linux wheels pull large CUDA libraries that are unused in this
# CPU container and can exhaust GitHub-hosted runner disk space during Trivy
# image export/scanning. Keep the versions aligned with requirements.txt.
# Up to 3 attempts: a wheel truncated in transit (torch is ~180 MB) fails pip's
# sha256 check against the index ("THESE PACKAGES DO NOT MATCH THE HASHES"), and
# a new download is safe because pip installs nothing from a rejected file.
# TORCH_INDEX_URL can point to a mirror (docker build --build-arg).
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu
RUN for attempt in 1 2 3; do \
      pip install --no-cache-dir --timeout 60 \
        --index-url "$TORCH_INDEX_URL" \
        torch==2.6.0 torchvision==0.21.0 torchaudio==2.6.0 && break; \
      if [ "$attempt" = 3 ]; then exit 1; fi; \
      echo "torch install failed (attempt $attempt/3), retrying" >&2; sleep 10; \
    done \
    && pip install --no-cache-dir -r requirements.txt

# EasyOCR models (fr + en, the engine's default languages) baked into the image:
# the container never downloads at runtime (offline-safe). Own cached layer, placed
# before the application code so a code change does not re-download them.
ENV EASYOCR_MODEL_DIR=/opt/easyocr
RUN mkdir -p "$EASYOCR_MODEL_DIR" \
    && python -c "import easyocr; easyocr.Reader(['fr', 'en'], gpu=False, model_storage_directory='$EASYOCR_MODEL_DIR', user_network_directory='$EASYOCR_MODEL_DIR', download_enabled=True, verbose=False)"

# RapidOCR models (PP-OCRv5 latin mobile: detector + recognizer) baked into the
# image: the container never downloads at runtime (offline-safe). Own cached layer,
# before the application code. The build fails if the latin recognizer is missing.
ENV RAPIDOCR_MODEL_DIR=/opt/rapidocr
COPY app/services/ocr/rapidocr_params.py /tmp/rapidocr_build/rapidocr_params.py
RUN mkdir -p "$RAPIDOCR_MODEL_DIR" \
    && PYTHONPATH=/tmp/rapidocr_build python -c "from rapidocr_params import download_models; download_models('$RAPIDOCR_MODEL_DIR')" \
    && ls "$RAPIDOCR_MODEL_DIR" \
    && ls "$RAPIDOCR_MODEL_DIR" | grep -i latin \
    && rm -rf /tmp/rapidocr_build

# Copy application code
COPY . .

# Create storage directory
RUN mkdir -p /var/ged/files

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
