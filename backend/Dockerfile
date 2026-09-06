FROM python:3.11-slim

WORKDIR /app

# System dependencies for OpenCV and Tesseract OCR (Arabic + English)
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgl1 \
    curl \
    tesseract-ocr \
    tesseract-ocr-ara \
    && rm -rf /var/lib/apt/lists/*

# Cache bust - v9
ARG CACHE_BUST=9

# Install all Python dependencies in a single unified resolution pass using CPU PyTorch
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

# Pre-download EasyOCR Arabic & English models during build
RUN python -c "import easyocr; easyocr.Reader(['ar', 'en'], gpu=False)"

# Copy application code
COPY . .

# Create uploads directory for local fallback
RUN mkdir -p /app/uploads

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
