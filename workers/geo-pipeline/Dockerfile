FROM python:3.11-slim

# System dependencies for rasterio (GDAL) and geopandas
RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY src/ ./src/

# Download dir for OData fallback
RUN mkdir -p /tmp/fitolink-downloads

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Run the pipeline scheduler
CMD ["python", "-m", "src.main"]
