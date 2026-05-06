"""
Landsat C2 L2 surface temperature (LST) — via Microsoft Planetary Computer.

Adds the missing thermal channel that Sentinel-2 doesn't provide. NDVI/NDRE
shows what the canopy looks like; LST shows what it's *doing*
thermodynamically. For an irrigation-dependent perennial like pistacho in
Toledo in May, canopy temperature anomalies show 7-14 days before NDRE
drops — the "we caught it early" headline graph.

Collection: `landsat-c2-l2` (Landsat 8 + 9 fused, ~8-day per pixel, 30 m).
Asset: `lwir11` (Band 10 thermal infrared). STAC + COG + anonymous SAS.

Pipeline per parcel (refreshed every cron run, like recent climate):
  1. Search MPC STAC for items in last N days intersecting parcel bbox.
  2. Load lwir11 + qa_pixel via odc.stac.
  3. Mask via qa_pixel cloud/cloud-shadow/cirrus bits (3, 4, 5).
  4. Scale digital number → Kelvin → Celsius:
     T_C = DN · 0.00341802 + 149.0 - 273.15
  5. Spatial mean over the polygon, per scene → list of (date, lstC).
  6. Composition: weighted mean by pixel count over the window.
  7. Combined with `tempMeanC` from the recent climate widget so we can
     surface `lstDeltaAirC` = LST_canopy − T_air, the classic water-stress
     proxy.

Failures NEVER block the main NDVI pipeline. All exceptions are logged and
the function returns None.
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

LANDSAT_COLLECTION = 'landsat-c2-l2'
LANDSAT_THERMAL_BAND = 'lwir11'
LANDSAT_QA_BAND = 'qa_pixel'

# Surface temperature scaling (Landsat C2 L2 spec)
LST_SCALE = 0.00341802
LST_OFFSET = 149.0          # Kelvin offset
KELVIN_TO_CELSIUS = -273.15

# qa_pixel bits we want to drop (Collection 2 Level-2 spec):
#   bit 1 = dilated cloud
#   bit 2 = cirrus
#   bit 3 = cloud
#   bit 4 = cloud shadow
#   bit 5 = snow
# We keep bit 0 (fill) check via the DN==0 sentinel.
QA_BAD_BITS = (1, 2, 3, 4, 5)


def _qa_is_bad(qa_array: np.ndarray) -> np.ndarray:
    """Return a boolean mask where True = pixel should be discarded."""
    bad = np.zeros_like(qa_array, dtype=bool)
    for bit in QA_BAD_BITS:
        bad |= (qa_array & (1 << bit)) > 0
    return bad


def fetch_thermal(
    geometry: dict,
    days: int = 30,
    air_temp_c: Optional[float] = None,
) -> Optional[dict]:
    """
    Fetch the latest land-surface-temperature signal for a parcel.

    Args:
        geometry: GeoJSON Polygon (WGS84).
        days: Lookback window in days (default 30 — covers ~3-4 L8/L9 passes
              over Spain and tolerates cloudy weeks).
        air_temp_c: If provided, computes LST − T_air for the stress proxy.
                    Typically the 30-day mean from `recentClimate.tempMeanC`.

    Returns:
        {
            'source':       'landsat-c2-l2',
            'fetched':      datetime,
            'days':         30,
            'lstC':         32.4,                   # weighted mean LST °C
            'airTempC':     24.0,                   # echoed from input (None if not given)
            'lstDeltaAirC': 8.4,                    # canopy minus air
            'scenesUsed':   3,                      # number of L8/L9 scenes used
            'lastDate':     datetime of the last scene actually used,
        }
        or None when MPC unavailable / no usable scenes.
    """
    catalog = open_catalog()
    if catalog is None:
        return None

    try:
        from odc.stac import stac_load
    except ImportError:
        logger.warning('odc_stac_not_installed')
        return None

    # Landsat C2 L2 ships at 30 m → bbox padding matches roughly that scale.
    bbox = expand_bbox(geometry_to_bbox(geometry), buffer_deg=0.0005)
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    datetime_str = f"{start.strftime('%Y-%m-%d')}/{end.strftime('%Y-%m-%d')}"

    logger.info('landsat_thermal_started', bbox=bbox, window=datetime_str)

    items = search_with_retry(
        catalog,
        collections=[LANDSAT_COLLECTION],
        bbox=bbox,
        datetime=datetime_str,
        # Pre-filter: cloud cover < 70 (some clouds OK, qa_pixel will refine)
        query={'eo:cloud_cover': {'lt': 70}},
        limit=12,
    )
    if items is None:
        logger.warning('landsat_search_failed', bbox=bbox)
        return None
    if not items:
        logger.info('landsat_no_items', bbox=bbox, window=datetime_str)
        return None

    logger.info('landsat_items_found', count=len(items))

    try:
        ds = stac_load(
            items,
            bands=[LANDSAT_THERMAL_BAND, LANDSAT_QA_BAND],
            bbox=bbox,
            chunks={},
            resolution=0.0003,  # ~30 m at the equator
            crs='EPSG:4326',
        )
    except Exception as e:
        logger.warning('landsat_stac_load_failed', error=str(e))
        return None

    lwir = ds[LANDSAT_THERMAL_BAND]
    qa = ds[LANDSAT_QA_BAND]

    # Per-scene aggregation: for each timestep produce a scalar LST °C.
    times = lwir['time'].values
    if not len(times):
        return None

    per_scene: list[tuple[datetime, float, int]] = []  # (date, lstC, n_valid_pixels)
    spatial_dims = [d for d in lwir.dims if d != 'time']

    for t_idx in range(len(times)):
        try:
            scene_lwir = lwir.isel(time=t_idx)
            scene_qa = qa.isel(time=t_idx)
            qa_arr = scene_qa.values.astype(np.uint16)
            lwir_arr = scene_lwir.values.astype(np.float32)

            # Mask: discard fill (DN==0) and any QA-bad bit
            valid = (lwir_arr > 0) & ~_qa_is_bad(qa_arr)
            n_valid = int(valid.sum())
            if n_valid < 3:
                continue

            kelvin = lwir_arr[valid] * LST_SCALE + LST_OFFSET
            celsius = kelvin + KELVIN_TO_CELSIUS
            # Sanity: discard any wildly out-of-range values (sea ice, extreme bug)
            celsius = celsius[(celsius > -20) & (celsius < 70)]
            if celsius.size == 0:
                continue
            mean_c = float(np.mean(celsius))
            scene_date = np.datetime64(times[t_idx]).astype('datetime64[s]').astype(datetime)
            per_scene.append((scene_date, mean_c, n_valid))
        except Exception as e:
            logger.warning('landsat_scene_skipped', t_idx=t_idx, error=str(e))
            continue

    if not per_scene:
        logger.info('landsat_no_valid_scenes', bbox=bbox)
        return None

    # Weighted composite by valid pixel count
    total_weight = sum(n for _, _, n in per_scene)
    weighted_sum = sum(c * n for _, c, n in per_scene)
    lst_c = round(weighted_sum / total_weight, 1)
    last_date = max(d for d, _, _ in per_scene)

    delta = round(lst_c - air_temp_c, 1) if air_temp_c is not None else None

    result = {
        'source': LANDSAT_COLLECTION,
        'fetched': datetime.now(timezone.utc),
        'days': days,
        'lstC': lst_c,
        'airTempC': air_temp_c,
        'lstDeltaAirC': delta,
        'scenesUsed': len(per_scene),
        'lastDate': last_date,
    }

    logger.info(
        'landsat_thermal_built',
        lst_c=lst_c,
        delta_air_c=delta,
        scenes=len(per_scene),
        last=last_date.isoformat() if last_date else None,
    )

    return result
