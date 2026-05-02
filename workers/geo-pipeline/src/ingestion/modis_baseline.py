"""
MODIS NDVI historical baseline — via Microsoft Planetary Computer.

Builds a 5-year monthly NDVI baseline per parcel using MODIS Terra
Vegetation Indices (MOD13Q1.061): 250m resolution, 16-day composite,
2000-present global coverage. Gratis, no auth required.

Data flow per parcel (one-shot, run once per parcel — cached in MongoDB):
  1. Query MPC STAC for MOD13Q1 items intersecting parcel bbox, last 5 years
  2. Load NDVI band via odc.stac (signed URLs, lazy COG reads)
  3. Spatial mean → per-acquisition NDVI scalar (one number per date)
  4. Group by month → 12 monthly averages
  5. Store {month: 1..12, mean, std, n} array on parcel document

The baseline is then used in the anomaly detector to answer:
  "Is the current NDVI normal for THIS parcel in THIS month, given 5 years
   of history?" — far stronger than a generic crop-type heuristic.

Performance: small Spanish parcels (~1-5 ha) intersect 1-2 MODIS pixels.
A 5-year query returns ~115 items × ~250 bytes raster each = trivial I/O.
Typical wall time per parcel: 10-30 seconds.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
import structlog

from .planetary_computer import (
    open_catalog,
    geometry_to_bbox,
    expand_bbox,
    search_with_retry,
)

logger = structlog.get_logger(__name__)

# MOD13Q1 collection — Terra MODIS 16-day NDVI/EVI at 250m
# Data range needs to cover small parcels — buffer the bbox by ~250m (0.0025°)
MODIS_NDVI_COLLECTION = 'modis-13Q1-061'
MODIS_NDVI_BAND = '250m_16_days_NDVI'
MODIS_PIXEL_RELIABILITY_BAND = '250m_16_days_pixel_reliability'

# MODIS NDVI is stored as int16 with scale factor 0.0001 (range -2000..10000)
MODIS_NDVI_SCALE = 0.0001
MODIS_NDVI_FILL = -3000

# Pixel reliability: 0=good, 1=marginal, 2=snow/ice, 3=cloudy → keep <=1
MODIS_RELIABILITY_THRESHOLD = 1


def build_parcel_baseline(
    geometry: dict,
    years: int = 3,
    end_date: Optional[datetime] = None,
) -> Optional[dict]:
    """
    Build a 12-month NDVI baseline for a parcel polygon from MODIS history.

    Args:
        geometry: GeoJSON Polygon dict (WGS84)
        years: How many years of history to use (default 5 → 60 months)
        end_date: End of the historical window (default = today)

    Returns:
        {
            'source':   'modis-13Q1-061',
            'years':    5,
            'computed': datetime,
            'months':   [
                {'month': 1, 'mean': 0.34, 'std': 0.04, 'n': 5},
                ...
                {'month': 12, ...}
            ],
            'all_time_mean': 0.42,
            'observation_count': 115,
        }
        or None if MPC unavailable / no valid pixels found.
    """
    catalog = open_catalog()
    if catalog is None:
        return None

    end = end_date or datetime.now(timezone.utc)
    start = end - timedelta(days=int(365.25 * years))

    bbox = expand_bbox(geometry_to_bbox(geometry), buffer_deg=0.005)
    datetime_str = f"{start.strftime('%Y-%m-%d')}/{end.strftime('%Y-%m-%d')}"

    logger.info(
        'modis_baseline_started',
        bbox=bbox,
        years=years,
        window=datetime_str,
    )

    items = search_with_retry(
        catalog,
        collections=[MODIS_NDVI_COLLECTION],
        bbox=bbox,
        datetime=datetime_str,
        limit=200,
    )
    if items is None:
        logger.warning('modis_search_failed', bbox=bbox)
        return None

    if not items:
        logger.info('modis_no_items', bbox=bbox)
        return None

    logger.info('modis_items_found', count=len(items))

    # Use odc.stac to load NDVI + reliability as xarray DataArrays
    try:
        from odc.stac import stac_load
    except ImportError:
        logger.warning('odc_stac_not_installed')
        return None

    # Note: we load ONLY the NDVI band. The pixel reliability band is stored
    # as int8 in MODIS but contains the uint8 fill value 255, which trips
    # odc-stac's array decoder ("Python integer 255 out of bounds for int8").
    # We rely on the NDVI fill value (-3000) and the [-1,1] sanity check
    # below to filter bad pixels — adequate for parcel-level monthly means.
    try:
        ds = stac_load(
            items,
            bands=[MODIS_NDVI_BAND],
            bbox=bbox,
            chunks={},  # eager — small data
            resolution=0.0025,  # ~250m at the equator (matches native)
            crs='EPSG:4326',
        )
    except Exception as e:
        logger.warning('modis_stac_load_failed', error=str(e))
        return None

    ndvi_da = ds[MODIS_NDVI_BAND]

    # Mask: drop fill values; final [-1,1] clip happens after scaling
    valid_mask = ndvi_da != MODIS_NDVI_FILL
    ndvi_scaled = ndvi_da.where(valid_mask) * MODIS_NDVI_SCALE

    # Spatial mean per timestep → 1D series of NDVI values across time
    try:
        spatial_dims = [d for d in ndvi_scaled.dims if d != 'time']
        per_date = ndvi_scaled.mean(dim=spatial_dims, skipna=True)
        per_date_values = per_date.values
        per_date_times = per_date['time'].values
    except Exception as e:
        logger.warning('modis_aggregate_failed', error=str(e))
        return None

    # Build per-month buckets
    monthly: dict[int, list[float]] = {m: [] for m in range(1, 13)}
    valid_count = 0
    for t, v in zip(per_date_times, per_date_values):
        if v is None:
            continue
        v_float = float(v)
        if not np.isfinite(v_float) or v_float < -1.0 or v_float > 1.0:
            continue
        # convert numpy datetime64 to month
        ts = np.datetime64(t).astype('datetime64[M]').astype(int) % 12 + 1
        monthly[ts].append(v_float)
        valid_count += 1

    if valid_count == 0:
        logger.info('modis_no_valid_pixels', bbox=bbox)
        return None

    months_out = []
    all_values: list[float] = []
    for m in range(1, 13):
        vals = monthly[m]
        if not vals:
            continue
        months_out.append({
            'month': m,
            'mean': round(float(np.mean(vals)), 4),
            'std': round(float(np.std(vals)), 4),
            'n': len(vals),
        })
        all_values.extend(vals)

    if not months_out:
        return None

    result = {
        'source': MODIS_NDVI_COLLECTION,
        'years': years,
        'computed': datetime.now(timezone.utc),
        'months': months_out,
        'all_time_mean': round(float(np.mean(all_values)), 4),
        'observation_count': valid_count,
    }

    logger.info(
        'modis_baseline_built',
        months_covered=len(months_out),
        observations=valid_count,
        all_time_mean=result['all_time_mean'],
    )

    return result


def lookup_monthly_baseline(baseline: Optional[dict], month: int) -> Optional[float]:
    """
    Get the historical mean NDVI for a given month, or None if missing.
    Convenience helper used by the feature extractor.
    """
    if not baseline or 'months' not in baseline:
        return None
    for entry in baseline['months']:
        if entry.get('month') == month:
            return entry.get('mean')
    return None
