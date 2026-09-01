FROM python:3.11-slim

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
# image export/scanning.
RUN pip install --no-cache-dir \
      --index-url https://download.pytorch.org/whl/cpu \
      torch==2.2.2 torchvision==0.17.2 torchaudio==2.2.2 \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create storage directory
RUN mkdir -p /var/ged/files

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
