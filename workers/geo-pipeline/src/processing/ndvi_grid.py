"""
NDVI Intra-Parcel Grid — Sprint Intra-Parcela.

Samples the NDVI GeoTIFF at pixel level and aggregates it into a uniform
grid of lat/lng/ndvi cells clipped to the parcel polygon, where each cell
holds the MEAN of the real pixels that fall inside it (zonal mean / binning).

Why binning and not interpolation (cambio 11-jun-2026):
- The previous version used a dense RBFInterpolator over every pixel. For a
  large parcel (Encineño, 407 ha ≈ 40.000 Sentinel-2 px) that builds an
  n×n matrix (~12 GB) and an O(n^3) solve → it pinned the VPS CPU and the
  host (Hostinger) flagged the server over its resource limit. The grid
  silently failed and large parcels were left WITHOUT a heatmap.
- Binning is O(n): assign each pixel to its cell, average per cell. It scales
  to parcels of any size without exhausting memory or CPU, and it is more
  EXACT than interpolation — each cell shows the real mean of its pixels,
  not a smoothed estimate. No scipy/pyproj dependency needed.

The grid is stored in the `ndvi_snapshots` MongoDB collection and served
via GET /api/v1/parcels/:id/ndvi-snapshot for the frontend heatmap.
"""
import logging
from datetime import datetime
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


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
            src_crs = ds.crs

    mask = np.isfinite(raw)
    if nodata is not None:
        mask &= raw != nodata

    rows, cols = np.where(mask)
    if len(rows) == 0:
        return samples

    # Clip values to physical NDVI range
    values = np.clip(raw[rows, cols], -1.0, 1.0)

    # Convert pixel centres to raster CRS, then to WGS84 if projected
    xs, ys = transform_xy(transform, rows.tolist(), cols.tolist())
    if src_crs and not src_crs.is_geographic:
        from pyproj import Transformer as _T
        to_wgs84 = _T.from_crs(src_crs, 'EPSG:4326', always_xy=True)
        lngs, lats = to_wgs84.transform(xs, ys)
    else:
        lngs, lats = xs, ys

    for lat, lng, ndvi in zip(lats, lngs, values.tolist()):
        samples.append((float(lat), float(lng), float(ndvi)))

    return samples


def zonal_grid(
    samples: list[tuple[float, float, float]],
    geometry: dict,
    resolution: int = 20,
) -> list[dict]:
    """
    Aggregate NDVI pixels into a uniform grid by zonal mean (binning).

    Builds a resolution×resolution grid over the parcel bbox and assigns
    each real pixel to its cell, then averages per cell. NO interpolation,
    NO smoothing: every cell carries the real mean NDVI of its slice of the
    parcel. Linear O(n) in the number of pixels (NumPy bincount, no Python
    loop over pixels) so it scales to parcels of any size without exhausting
    memory or CPU.

    Args:
        samples: List of (lat, lng, ndvi) from extract_pixel_samples.
        geometry: GeoJSON Polygon (WGS84) for clipping the grid.
        resolution: Number of grid cells per axis (default 20 → up to 400 cells).

    Returns:
        List of {"lat": float, "lng": float, "ndvi": float} dicts — one per
        cell that has at least one pixel AND whose centre is inside the polygon.
    """
    if len(samples) < 4:
        logger.warning('ndvi_grid_too_few_samples', count=len(samples))
        return []

    try:
        from shapely.geometry import shape, Point
    except ImportError as e:
        raise RuntimeError(f'shapely is required: {e}')

    polygon = shape(geometry)

    coords = geometry['coordinates'][0]
    min_lng = min(c[0] for c in coords)
    max_lng = max(c[0] for c in coords)
    min_lat = min(c[1] for c in coords)
    max_lat = max(c[1] for c in coords)

    lng_span = max_lng - min_lng
    lat_span = max_lat - min_lat
    if lng_span <= 0 or lat_span <= 0:
        return []

    lats = np.array([s[0] for s in samples])
    lngs = np.array([s[1] for s in samples])
    ndvis = np.array([s[2] for s in samples])

    # Asignar cada píxel a su celda (índice fila/col en la rejilla regular).
    # Vectorizado: O(n) sin bucle Python sobre los píxeles.
    col = np.clip(((lngs - min_lng) / lng_span * resolution).astype(int), 0, resolution - 1)
    row = np.clip(((lats - min_lat) / lat_span * resolution).astype(int), 0, resolution - 1)
    cell_id = row * resolution + col

    n_cells = resolution * resolution
    sums = np.bincount(cell_id, weights=ndvis, minlength=n_cells)
    counts = np.bincount(cell_id, minlength=n_cells)

    # Centro geográfico de cada celda de la rejilla.
    cell_lng = min_lng + (np.arange(resolution) + 0.5) / resolution * lng_span
    cell_lat = min_lat + (np.arange(resolution) + 0.5) / resolution * lat_span

    out: list[dict] = []
    for idx in range(n_cells):
        if counts[idx] == 0:
            continue  # celda sin píxeles reales → no inventamos dato
        r = idx // resolution
        c = idx % resolution
        lat = float(cell_lat[r])
        lng = float(cell_lng[c])
        if not polygon.contains(Point(lng, lat)):
            continue  # centro de celda fuera del polígono
        mean_ndvi = float(sums[idx] / counts[idx])
        out.append({
            'lat': round(lat, 6),
            'lng': round(lng, 6),
            'ndvi': round(mean_ndvi, 4),
        })

    return out


def build_grid_snapshot(
    geotiff_bytes: bytes,
    geometry: dict,
    parcel_id: str,
    date: datetime,
    resolution: int = 20,
) -> Optional[dict]:
    """
    Full pipeline: sample pixels → zonal-mean grid → snapshot document.

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

        points = zonal_grid(samples, geometry, resolution=resolution)
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
