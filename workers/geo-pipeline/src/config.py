import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI: str = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/fitolink')
COPERNICUS_CLIENT_ID: str = os.getenv('COPERNICUS_CLIENT_ID', '')
COPERNICUS_CLIENT_SECRET: str = os.getenv('COPERNICUS_CLIENT_SECRET', '')

# CDSE OData — stable paths (not affected by March 2026 Sentinel Hub path changes)
COPERNICUS_TOKEN_URL: str = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'
COPERNICUS_CATALOG_URL: str = 'https://catalogue.dataspace.copernicus.eu/odata/v1'

# openEO cloud processing (Sprint GEE)
# Uses same CDSE credentials. Set USE_OPENEO=false to force legacy OData download.
OPENEO_URL: str = 'https://openeo.dataspace.copernicus.eu'
USE_OPENEO: bool = os.getenv('USE_OPENEO', 'true').lower() != 'false'
OPENEO_COLLECTION: str = 'SENTINEL2_L2A'

# NDVI anomaly thresholds
NDVI_ANOMALY_DROP_THRESHOLD: float = 0.10  # Drop of >0.10 from previous reading
NDVI_CRITICAL_THRESHOLD: float = 0.30  # Absolute NDVI below 0.30
NDVI_HIGH_THRESHOLD: float = 0.40
CLOUD_COVER_MAX: float = 50.0  # Skip images with >50% cloud cover

# Legacy OData download fallback (used when USE_OPENEO=false or openEO unavailable)
DOWNLOAD_DIR: str = os.getenv('DOWNLOAD_DIR', '/tmp/fitolink-downloads')

# NDVI intra-parcel grid (Sprint Intra-Parcela)
NDVI_GRID_ENABLED: bool = os.getenv('NDVI_GRID_ENABLED', 'true').lower() != 'false'
NDVI_GRID_RESOLUTION: int = int(os.getenv('NDVI_GRID_RESOLUTION', '20'))

# Schedule
PROCESSING_INTERVAL_DAYS: int = 5
