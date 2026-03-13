import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI: str = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/fitolink')
COPERNICUS_CLIENT_ID: str = os.getenv('COPERNICUS_CLIENT_ID', '')
COPERNICUS_CLIENT_SECRET: str = os.getenv('COPERNICUS_CLIENT_SECRET', '')
COPERNICUS_TOKEN_URL: str = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'
COPERNICUS_CATALOG_URL: str = 'https://catalogue.dataspace.copernicus.eu/odata/v1'

# NDVI anomaly thresholds
NDVI_ANOMALY_DROP_THRESHOLD: float = 0.10  # Drop of >0.10 from previous reading
NDVI_CRITICAL_THRESHOLD: float = 0.30  # Absolute NDVI below 0.30
NDVI_HIGH_THRESHOLD: float = 0.40
CLOUD_COVER_MAX: float = 50.0  # Skip images with >50% cloud cover

# Schedule
PROCESSING_INTERVAL_DAYS: int = 5
