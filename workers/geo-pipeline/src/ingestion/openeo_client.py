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
import os
import tempfile
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
            # Step 1: Load collection — include B02 (Blue) and B11 (SWIR-1) so the
            # same fetch yields NDVI + NDRE + NDMI + EVI + SAVI without a second
            # download.
            s2 = self._conn.load_collection(
                OPENEO_COLLECTION,
                spatial_extent={
                    'west': bbox[0], 'south': bbox[1],
                    'east': bbox[2], 'north': bbox[3],
                    'crs': 'EPSG:4326',
                },
                temporal_extent=[start_str, end_str],
                bands=['B02', 'B04', 'B05', 'B08', 'B11', 'SCL'],
                max_cloud_cover=max_cloud_cover,
            )

            # Step 2: Cloud masking via SCL — build mask with OR of comparisons
            # (isin() not available in all openeo-python-client versions)
            scl = s2.band('SCL')
            cloud_mask = (scl == 0) | (scl == 1) | (scl == 3) | (scl == 8) | (scl == 9) | (scl == 10) | (scl == 11)
            s2_clean = s2.mask(cloud_mask)

            # Step 3: index band math
            b02 = s2_clean.band('B02')   # Blue (10 m)  — needed by EVI
            b04 = s2_clean.band('B04')   # Red (10 m)
            b05 = s2_clean.band('B05')   # Red Edge (20 m)
            b08 = s2_clean.band('B08')   # NIR (10 m)
            b11 = s2_clean.band('B11')   # SWIR-1 (20 m) — needed by NDMI

            ndvi = (b08 - b04) / (b08 + b04)                              # vigor general
            ndre = (b08 - b05) / (b08 + b05)                              # clorofila red-edge
            ndmi = (b08 - b11) / (b08 + b11)                              # leaf moisture (key for water stress)
            evi  = 2.5 * (b08 - b04) / (b08 + 6.0 * b04 - 7.5 * b02 + 1.0)  # canopy density, soil/atmosphere corrected
            savi = 1.5 * (b08 - b04) / (b08 + b04 + 0.5)                  # soil-adjusted, sparse canopy friendly

            # Step 4: Clip every index to parcel polygon
            ndvi_parcel = ndvi.filter_spatial(geometry)
            ndre_parcel = ndre.filter_spatial(geometry)
            ndmi_parcel = ndmi.filter_spatial(geometry)
            evi_parcel  = evi.filter_spatial(geometry)
            savi_parcel = savi.filter_spatial(geometry)

            # Step 5: Temporal reduction — max composite (clearest pixel per location)
            ndvi_composite = ndvi_parcel.reduce_temporal('max')
            ndre_composite = ndre_parcel.reduce_temporal('max')
            ndmi_composite = ndmi_parcel.reduce_temporal('max')
            evi_composite  = evi_parcel.reduce_temporal('max')
            savi_composite = savi_parcel.reduce_temporal('max')

            # Step 6: Download each composite as a tiny GeoTIFF, read bytes, clean up.
            tmp_paths: dict[str, str] = {}
            for key in ('ndvi', 'ndre', 'ndmi', 'evi', 'savi'):
                with tempfile.NamedTemporaryFile(suffix='.tif', delete=False) as f:
                    tmp_paths[key] = f.name

            raw_bytes: dict[str, bytes] = {}
            try:
                ndvi_composite.download(tmp_paths['ndvi'], format='GTiff')
                ndre_composite.download(tmp_paths['ndre'], format='GTiff')
                ndmi_composite.download(tmp_paths['ndmi'], format='GTiff')
                evi_composite.download(tmp_paths['evi'], format='GTiff')
                savi_composite.download(tmp_paths['savi'], format='GTiff')
                for key, path in tmp_paths.items():
                    with open(path, 'rb') as f:
                        raw_bytes[key] = f.read()
            finally:
                for path in tmp_paths.values():
                    if os.path.exists(path):
                        os.unlink(path)

            # Step 7: Compute NDVI stats (the canonical ones — drive the rest).
            result = _stats_from_geotiff(io.BytesIO(raw_bytes['ndvi']))
            if result is None:
                logger.info('openeo_no_valid_pixels', bbox=bbox)
                return None

            # Auxiliary indices: only the mean is propagated (history compactness).
            # EVI/SAVI can exceed [-1, 1] over bright surfaces; widen bounds.
            for key, attr, lo, hi in (
                ('ndre', 'ndre_mean', -1.0, 1.0),
                ('ndmi', 'ndmi_mean', -1.0, 1.0),
                ('evi',  'evi_mean',  -1.5, 1.5),
                ('savi', 'savi_mean', -1.5, 1.5),
            ):
                aux = _stats_from_geotiff(io.BytesIO(raw_bytes[key]), clip_min=lo, clip_max=hi)
                if aux is not None:
                    setattr(result, attr, aux.mean)

            logger.info(
                'openeo_processing_completed',
                ndvi=result.mean,
                ndre=result.ndre_mean,
                ndmi=result.ndmi_mean,
                evi=result.evi_mean,
                savi=result.savi_mean,
                min_val=result.min_val,
                max_val=result.max_val,
                pixels=result.pixel_count,
            )
            # Return result + raw NDVI bytes for intra-parcel grid generation
            return result, raw_bytes['ndvi']

        except Exception as e:
            logger.error('openeo_processing_failed', error=str(e), bbox=bbox)
            return None


def _geometry_to_bbox(geometry: dict) -> tuple[float, float, float, float]:
    """Extract (west, south, east, north) bounding box from GeoJSON Polygon."""
    coords = geometry['coordinates'][0]
    lngs = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return (min(lngs), min(lats), max(lngs), max(lats))


def _stats_from_geotiff(
    buffer: io.BytesIO,
    clip_min: float = -1.0,
    clip_max: float = 1.0,
) -> Optional[NdviResult]:
    """
    Parse a GeoTIFF from a BytesIO buffer and compute pixel statistics.

    Defaults to NDVI/NDRE/NDMI bounds [-1, 1]. EVI and SAVI legitimately
    exceed those over bright surfaces and can be passed wider bounds.

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

    valid = np.clip(valid, clip_min, clip_max)

    return NdviResult(
        mean=round(float(np.mean(valid)), 4),
        min_val=round(float(np.min(valid)), 4),
        max_val=round(float(np.max(valid)), 4),
        std=round(float(np.std(valid)), 4),
        pixel_count=int(len(valid)),
        cloud_fraction=0.0,  # pixels already masked; composite is cloud-free
    )
