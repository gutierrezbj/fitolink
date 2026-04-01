"""
NDVI Intra-Parcel Grid — Sprint Intra-Parcela.

Samples the NDVI GeoTIFF at pixel level, projects to UTM, applies RBF
interpolation, and returns a uniform grid of lat/lng/ndvi points clipped
to the parcel polygon.

The grid is stored in the `ndvi_snapshots` MongoDB collection and served
via GET /api/v1/parcels/:id/ndvi-snapshot for the frontend heatmap.
"""
import io
import logging
from datetime import datetime
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Half-side of each output cell in degrees (~10m at Spain latitude)
_CELL_HALF_DEG = 0.000045


def extract_pixel_samples(
    geotiff_bytes: bytes,
    geometry: dict,
) -> list[tuple[float, float, float]]:
    """
    Read a GeoTIFF buffer and return a list of (lat, lng, ndvi) tuples
    for every valid pixel inside the parcel polygon.

    Args:
        geotiff_bytes: Raw bytes of the GeoTIFF (already read from BytesIO).
        geometry: GeoJSON Polygon dict (WGS84).

    Returns:
        List of (lat, lng, ndvi) tuples. May be empty if no valid pixels.
    """
    try:
        import rasterio
        from rasterio.io import MemoryFile
        from rasterio.transform import xy as transform_xy
    except ImportError:
        raise RuntimeError('rasterio is required for pixel sampling')

    samples: list[tuple[float, float, float]] = []

    with MemoryFile(geotiff_bytes) as memfile:
        with memfile.open() as ds:
            raw = ds.read(1).astype(np.float32)
            transform = ds.transform
            nodata = ds.nodata

    mask = np.isfinite(raw)
    if nodata is not None:
        mask &= raw != nodata

    rows, cols = np.where(mask)
    if len(rows) == 0:
        return samples

    # Clip values to physical NDVI range
    values = np.clip(raw[rows, cols], -1.0, 1.0)

    # Convert pixel centres to geographic coordinates
    lngs, lats = transform_xy(transform, rows.tolist(), cols.tolist())

    for lat, lng, ndvi in zip(lats, lngs, values.tolist()):
        samples.append((float(lat), float(lng), float(ndvi)))

    return samples


def interpolate_rbf(
    samples: list[tuple[float, float, float]],
    geometry: dict,
    resolution: int = 20,
) -> list[dict]:
    """
    Interpolate NDVI values on a uniform grid inside the parcel polygon.

    Uses scipy RBFInterpolator with thin_plate_spline kernel in UTM
    coordinates for metric accuracy, then converts output back to WGS84.

    Args:
        samples: List of (lat, lng, ndvi) from extract_pixel_samples.
        geometry: GeoJSON Polygon (WGS84) for clipping the grid.
        resolution: Number of grid cells per axis (default 20 → ~400 points).

    Returns:
        List of {"lat": float, "lng": float, "ndvi": float} dicts
        for points that fall inside the polygon.
    """
    if len(samples) < 4:
        logger.warning('ndvi_grid_too_few_samples', count=len(samples))
        return []

    try:
        from scipy.interpolate import RBFInterpolator
        from shapely.geometry import shape, Point
        from pyproj import Transformer
    except ImportError as e:
        raise RuntimeError(f'scipy, shapely and pyproj are required: {e}')

    polygon = shape(geometry)

    # Project to UTM zone 30N (EPSG:25830) for metric RBF
    to_utm = Transformer.from_crs('EPSG:4326', 'EPSG:25830', always_xy=True)
    to_wgs = Transformer.from_crs('EPSG:25830', 'EPSG:4326', always_xy=True)

    lats = np.array([s[0] for s in samples])
    lngs = np.array([s[1] for s in samples])
    ndvis = np.array([s[2] for s in samples])

    # Transform known points to UTM
    east_known, north_known = to_utm.transform(lngs, lats)
    xy_known = np.column_stack([east_known, north_known])

    # Build RBF interpolator
    rbf = RBFInterpolator(xy_known, ndvis, kernel='thin_plate_spline', smoothing=0.1)

    # Generate uniform grid in bbox
    coords = geometry['coordinates'][0]
    min_lng = min(c[0] for c in coords)
    max_lng = max(c[0] for c in coords)
    min_lat = min(c[1] for c in coords)
    max_lat = max(c[1] for c in coords)

    grid_lngs = np.linspace(min_lng, max_lng, resolution)
    grid_lats = np.linspace(min_lat, max_lat, resolution)
    mesh_lng, mesh_lat = np.meshgrid(grid_lngs, grid_lats)
    flat_lngs = mesh_lng.ravel()
    flat_lats = mesh_lat.ravel()

    # Filter to points inside polygon
    inside_mask = np.array([
        polygon.contains(Point(lng, lat))
        for lng, lat in zip(flat_lngs, flat_lats)
    ])
    query_lngs = flat_lngs[inside_mask]
    query_lats = flat_lats[inside_mask]

    if len(query_lngs) == 0:
        return []

    # Transform query points to UTM and evaluate RBF
    east_q, north_q = to_utm.transform(query_lngs, query_lats)
    xy_query = np.column_stack([east_q, north_q])
    ndvi_interp = rbf(xy_query)
    ndvi_interp = np.clip(ndvi_interp, -1.0, 1.0)

    return [
        {'lat': round(float(lat), 6), 'lng': round(float(lng), 6), 'ndvi': round(float(v), 4)}
        for lat, lng, v in zip(query_lats, query_lngs, ndvi_interp)
    ]


def build_grid_snapshot(
    geotiff_bytes: bytes,
    geometry: dict,
    parcel_id: str,
    date: datetime,
    resolution: int = 20,
) -> Optional[dict]:
    """
    Full pipeline: sample pixels → RBF interpolation → snapshot document.

    Args:
        geotiff_bytes: Raw GeoTIFF bytes (NDVI band).
        geometry: GeoJSON Polygon (WGS84).
        parcel_id: String ObjectId of the parcel.
        date: Datetime of the NDVI reading.
        resolution: Grid resolution per axis.

    Returns:
        MongoDB document dict ready for `db.ndvi_snapshots.insert_one()`,
        or None if not enough valid pixels.
    """
    from bson import ObjectId

    coords = geometry['coordinates'][0]
    bbox = [
        round(min(c[0] for c in coords), 6),
        round(min(c[1] for c in coords), 6),
        round(max(c[0] for c in coords), 6),
        round(max(c[1] for c in coords), 6),
    ]

    try:
        samples = extract_pixel_samples(geotiff_bytes, geometry)
        if len(samples) < 4:
            logger.info('ndvi_grid_skipped_no_samples', parcel_id=parcel_id)
            return None

        points = interpolate_rbf(samples, geometry, resolution=resolution)
        if not points:
            logger.info('ndvi_grid_skipped_empty_grid', parcel_id=parcel_id)
            return None

        return {
            'parcelId': ObjectId(parcel_id),
            'date': date,
            'resolution': resolution,
            'points': points,
            'bbox': bbox,
            'pixelCount': len(samples),
            'createdAt': datetime.now(),
        }

    except Exception as e:
        logger.error('ndvi_grid_build_failed', parcel_id=parcel_id, error=str(e))
        return None
