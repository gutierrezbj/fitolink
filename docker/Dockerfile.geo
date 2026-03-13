FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for rasterio/GDAL
RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

COPY workers/geo-pipeline/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY workers/geo-pipeline/ .

CMD ["python", "-m", "src.pipeline"]
