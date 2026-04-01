"""
openEO cloud processing client — Sprint GEE.

Replaces the OData download approach: instead of downloading 500MB Sentinel-2
SAFE ZIPs and computing NDVI locally, this client sends a process graph to
CDSE openEO, executes it in the cloud, and receives a small GeoTIFF in memory.

Benefits vs legacy OData download:
- No disk I/O — result is kept in a BytesIO buffer
- ~10-50x faster per parcel (seconds vs minutes)
- 25% cheaper credits (CDSE STAC backend, March 2026)
- Same CDSE credentials — no separate service account
- Cloud masking via SCL band built into process graph

Authentication: client_credentials via CDSE OAuth2 (same as CopernicusClient).
"""
import io
from datetime import datetime
from typing import Optional

import numpy as np
import structlog

from ..config import (
    COPERNICUS_CLIENT_ID,
    COPERNICUS_CLIENT_SECRET,
    OPENEO_URL,
    OPENEO_COLLECTION,
    CLOUD_COVER_MAX,
)
from ..processing.ndvi import NdviResult

logger = structlog.get_logger(__name__)

# SCL (Scene Classification Layer) values to mask out:
# 0=no data, 1=saturated, 3=cloud shadow, 8=cloud medium, 9=cloud high, 10=cirrus, 11=snow
_SCL_CLOUD_VALUES = [0, 1, 3, 8, 9, 10, 11]


class OpenEOClient:
    """
    CDSE openEO client for cloud-side NDVI computation.

    Usage:
        client = OpenEOClient()
        client.connect()
        result = client.compute_ndvi_stats(geometry, start_date, end_date)
    """

    def __init__(self) -> None:
        self._conn = None

    def connect(self) -> None:
        """Connect and authenticate to CDSE openEO endpoint."""
        try:
            import openeo  # lazy import — not available in fallback path
        except ImportError:
            raise RuntimeError(
                'openeo package not installed. Run: pip install openeo>=0.26.0'
            )

        if not COPERNICUS_CLIENT_ID or not COPERNICUS_CLIENT_SECRET:
            raise ValueError('Copernicus credentials not configured for openEO')

        self._conn = openeo.connect(OPENEO_URL)
        self._conn.authenticate_oidc_client_credentials(
            client_id=COPERNICUS_CLIENT_ID,
            client_secret=COPERNICUS_CLIENT_SECRET,
        )
        logger.info('openeo_connected', url=OPENEO_URL)

    def compute_ndvi_stats(
        self,
        geometry: dict,
        start_date: datetime,
        end_date: datetime,
        max_cloud_cover: float = CLOUD_COVER_MAX,
    ) -> Optional[tuple[NdviResult, bytes]]:
        """
        Compute NDVI statistics for a parcel polygon entirely in the CDSE cloud.

        Process graph:
          1. Load SENTINEL2_L2A with bbox + temporal filter + max_cloud_cover pre-filter
          2. Cloud-mask pixels using SCL band (remove shadows, clouds, cirrus, snow)
          3. Compute NDVI = (B08 - B04) / (B08 + B04)
          4. Clip spatially to the parcel polygon
          5. Reduce temporal dimension → max composite (picks clearest pixel per location)
          6. Download resulting raster as in-memory GeoTIFF (bytes, no disk write)
          7. Compute mean / min / max / std / pixel_count locally from valid pixels

        Args:
            geometry: GeoJSON Polygon dict (parcel boundary, WGS84)
            start_date: Start of search window
            end_date: End of search window
            max_cloud_cover: Scene-level cloud cover pre-filter (%)

        Returns:
            NdviResult with statistics, or None if no valid imagery found.
        """
        if self._conn is None:
            raise RuntimeError('Call connect() before compute_ndvi_stats()')

        import openeo  # already imported in connect(), kept for type clarity

        bbox = _geometry_to_bbox(geometry)
        start_str = start_date.strftime('%Y-%m-%d')
        end_str = end_date.strftime('%Y-%m-%d')

        logger.info(
            'openeo_processing_started',
            bbox=bbox,
            start=start_str,
            end=end_str,
            max_cloud=max_cloud_cover,
        )

        try:
            # Step 1: Load collection — include B05 (RedEdge) for NDRE (Sprint ML)
            s2 = self._conn.load_collection(
                OPENEO_COLLECTION,
                spatial_extent={
                    'west': bbox[0], 'south': bbox[1],
                    'east': bbox[2], 'north': bbox[3],
                    'crs': 'EPSG:4326',
                },
                temporal_extent=[start_str, end_str],
                bands=['B04', 'B05', 'B08', 'SCL'],
                max_cloud_cover=max_cloud_cover,
            )

            # Step 2: Cloud masking via SCL
            scl = s2.band('SCL')
            cloud_mask = scl.isin(_SCL_CLOUD_VALUES)
            s2_clean = s2.mask(cloud_mask)

            # Step 3: NDVI band math = (B08 - B04) / (B08 + B04)
            b04 = s2_clean.band('B04')
            b05 = s2_clean.band('B05')
            b08 = s2_clean.band('B08')
            ndvi = (b08 - b04) / (b08 + b04)

            # NDRE band math = (B08 - B05) / (B08 + B05) — more sensitive to chlorophyll
            ndre = (b08 - b05) / (b08 + b05)

            # Step 4: Clip both indices to parcel polygon
            ndvi_parcel = ndvi.filter_spatial(geometry)
            ndre_parcel = ndre.filter_spatial(geometry)

            # Step 5: Temporal reduction — max composite
            ndvi_composite = ndvi_parcel.reduce_temporal('max')
            ndre_composite = ndre_parcel.reduce_temporal('max')

            # Step 6: Download both as in-memory GeoTIFFs (no disk write)
            ndvi_buf = io.BytesIO()
            ndvi_composite.download(ndvi_buf, format='GTiff')
            # Read raw bytes once — share across stats + grid (buffer is exhausted after one read)
            ndvi_raw_bytes = ndvi_buf.getvalue()

            ndre_buf = io.BytesIO()
            ndre_composite.download(ndre_buf, format='GTiff')
            ndre_buf.seek(0)

            # Step 7: Compute statistics (feed a fresh BytesIO from the raw bytes)
            result = _stats_from_geotiff(io.BytesIO(ndvi_raw_bytes))
            if result is None:
                logger.info('openeo_no_valid_pixels', bbox=bbox)
                return None

            # Add NDRE mean to result
            ndre_result = _stats_from_geotiff(ndre_buf)
            if ndre_result is not None:
                result.ndre_mean = ndre_result.mean

            logger.info(
                'openeo_processing_completed',
                mean=result.mean,
                ndre_mean=result.ndre_mean,
                min_val=result.min_val,
                max_val=result.max_val,
                pixels=result.pixel_count,
            )
            # Return result + raw NDVI bytes for intra-parcel grid generation
            return result, ndvi_raw_bytes

        except Exception as e:
            logger.error('openeo_processing_failed', error=str(e), bbox=bbox)
            return None


def _geometry_to_bbox(geometry: dict) -> tuple[float, float, float, float]:
    """Extract (west, south, east, north) bounding box from GeoJSON Polygon."""
    coords = geometry['coordinates'][0]
    lngs = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return (min(lngs), min(lats), max(lngs), max(lats))


def _stats_from_geotiff(buffer: io.BytesIO) -> Optional[NdviResult]:
    """
    Parse a GeoTIFF from a BytesIO buffer and compute NDVI statistics.

    Returns None if the raster has no valid (non-nodata, finite) pixels.
    """
    try:
        import rasterio
        from rasterio.io import MemoryFile
    except ImportError:
        raise RuntimeError('rasterio is required for GeoTIFF parsing')

    with MemoryFile(buffer.read()) as memfile:
        with memfile.open() as ds:
            raw = ds.read(1).astype(np.float32)
            nodata = ds.nodata

    # Mask nodata and any non-finite values (NaN, Inf from masked cloud pixels)
    mask = np.isfinite(raw)
    if nodata is not None:
        mask &= raw != nodata

    valid = raw[mask]

    if len(valid) == 0:
        return None

    # Clip NDVI to physical range [-1, 1]
    valid = np.clip(valid, -1.0, 1.0)

    return NdviResult(
        mean=round(float(np.mean(valid)), 4),
        min_val=round(float(np.min(valid)), 4),
        max_val=round(float(np.max(valid)), 4),
        std=round(float(np.std(valid)), 4),
        pixel_count=int(len(valid)),
        cloud_fraction=0.0,  # pixels already masked; composite is cloud-free
    )
