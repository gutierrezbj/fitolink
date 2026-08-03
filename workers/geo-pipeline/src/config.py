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

# Proveedor de la imagen Sentinel-2 en vivo. Migración 3-ago-2026 (CDSE nos dejó
# tirados dos veces con 0 clientes: 402 y 401 con créditos activos).
#   'mpc'    → Microsoft Planetary Computer (gratis, sin cupo, NDVI local). Default.
#   'openeo' → legacy CDSE/openEO + fallback OData (de pago por créditos).
# En modo 'mpc' NO se cae a CDSE: es un corte limpio y reversible por env.
SATELLITE_SOURCE: str = os.getenv('SATELLITE_SOURCE', 'mpc').strip().lower()

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

# Frescura: no volver a pedir imagen de una parcela que ya tiene una lectura
# más reciente que esto. Sentinel-2 revisita cada ~5 días, así que por debajo
# de ese umbral NO hay escena nueva que buscar y la petición es dinero tirado.
#
# Sin esto (hasta 25-jul-2026) el pipeline pedía una ventana de 10 días para
# las 63 parcelas en CADA corrida, hubiera o no dato nuevo — así se agotaron
# los créditos de CDSE sin un solo usuario real. Poner NDVI_MIN_AGE_DAYS=0
# fuerza el refetch (útil para depurar o rellenar huecos).
NDVI_MIN_AGE_DAYS: float = float(os.getenv('NDVI_MIN_AGE_DAYS', '4.5'))

# Sprint MPC — Microsoft Planetary Computer enrichment
# Refresh 30-day climate snapshot on every pipeline run (cheap HTTP fetch).
# Set MPC_CLIMATE_REFRESH=false to disable (e.g. if Open-Meteo is rate-limited).
MPC_CLIMATE_REFRESH: bool = os.getenv('MPC_CLIMATE_REFRESH', 'true').lower() != 'false'

# Sprint Thermal — Landsat C2 L2 surface temperature
# Refresh latest LST on every pipeline run (Landsat 8/9 ~8-day cadence per pixel).
# Set MPC_THERMAL_REFRESH=false if MPC throttles or you want to skip.
MPC_THERMAL_REFRESH: bool = os.getenv('MPC_THERMAL_REFRESH', 'true').lower() != 'false'
