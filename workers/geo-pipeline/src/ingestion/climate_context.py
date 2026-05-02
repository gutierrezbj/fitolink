"""
Climate context per parcel — Sprint MPC.

Two complementary data sources:

1. MPC TerraClimate (`terraclimate` collection)
   - 1958-2021 monthly climatology, ~4km resolution, global
   - Used to build a per-parcel climatic baseline:
     monthly normals for precipitation, temperature, PDSI (drought index)
   - One-shot per parcel, cached in MongoDB

2. Open-Meteo Free Historical API (open-meteo.com)
   - ECMWF-backed (uses ERA5 + IFS), free, no key, global
   - Used to fetch CURRENT 30-day rolling climate:
     last 30 days of temp, precipitation, evapotranspiration
   - Refreshed every pipeline run

Why two sources:
- TerraClimate gives us "what's normal here in March" → indestructible baseline
- Open-Meteo gives us "what actually happened these last 30 days" → real-time
- Together: "March rainfall was 8mm vs 42mm normal → -81% drought signal"

Both calls are wrapped in try/except — failures here NEVER break the
Sentinel-2 pipeline. A parcel with no climate data still gets full NDVI
processing.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
import requests
import structlog

from .planetary_computer import (
    open_catalog,
    geometry_centroid,
    geometry_to_bbox,
    expand_bbox,
)

logger = structlog.get_logger(__name__)

TERRACLIMATE_COLLECTION = 'terraclimate'
TERRACLIMATE_BANDS = {
    'ppt': 'precipitation_mm',     # mm/month
    'tmax': 'tmax_celsius',        # °C
    'tmin': 'tmin_celsius',        # °C
    'pdsi': 'pdsi',                # Palmer Drought Severity Index
    'pet':  'potential_et_mm',     # mm/month — atmospheric water demand
    'aet':  'actual_et_mm',        # mm/month
}

OPEN_METEO_ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'
OPEN_METEO_TIMEOUT_S = 15


# ──────────────────────────────────────────────────────────────────────────
# 1. TerraClimate baseline — monthly normals from 1991-2020 (30-yr period)
# ──────────────────────────────────────────────────────────────────────────

def build_climate_baseline(
    geometry: dict,
    start_year: int = 1991,
    end_year: int = 2020,
) -> Optional[dict]:
    """
    Build a 12-month climatic baseline from TerraClimate via MPC.

    Computes monthly means over the reference period (default 1991-2020,
    the WMO standard climatological normal) for:
        - precipitation (mm/month)
        - tmax / tmin (°C)
        - PDSI (drought severity, -10..+10, negative = dry)
        - PET (potential evapotranspiration, mm/month)

    Returns:
        {
            'source': 'terraclimate',
            'period': '1991-2020',
            'computed': datetime,
            'months': [
                {'month': 1, 'precip': 45.2, 'tmax': 11.3, 'tmin': 2.1,
                 'pdsi': 0.4, 'pet': 28.0},
                ...
            ],
            'annual_precip': 412.5,
            'annual_pet': 988.2,
            'aridity_index': 0.42,      # P/PET — Köppen-like
        }
        or None if MPC unavailable.
    """
    catalog = open_catalog()
    if catalog is None:
        return None

    bbox = expand_bbox(geometry_to_bbox(geometry), buffer_deg=0.05)
    datetime_str = f"{start_year}-01-01/{end_year}-12-31"

    logger.info('terraclimate_baseline_started', bbox=bbox, period=datetime_str)

    try:
        search = catalog.search(
            collections=[TERRACLIMATE_COLLECTION],
            bbox=bbox,
            datetime=datetime_str,
        )
        items = list(search.items())
    except Exception as e:
        logger.warning('terraclimate_search_failed', error=str(e))
        return None

    if not items:
        logger.info('terraclimate_no_items', bbox=bbox)
        return None

    try:
        from odc.stac import stac_load
    except ImportError:
        logger.warning('odc_stac_not_installed')
        return None

    bands = ['ppt', 'tmax', 'tmin', 'pdsi', 'pet']
    try:
        ds = stac_load(
            items,
            bands=bands,
            bbox=bbox,
            chunks={},
            resolution=0.04,  # ~4km matches native
            crs='EPSG:4326',
        )
    except Exception as e:
        logger.warning('terraclimate_stac_load_failed', error=str(e))
        return None

    # Spatial mean across the (small) parcel bbox → time series per band
    spatial_dims = [d for d in ds.dims if d != 'time']
    try:
        per_date = ds.mean(dim=spatial_dims, skipna=True).compute()
    except Exception as e:
        logger.warning('terraclimate_aggregate_failed', error=str(e))
        return None

    times = per_date['time'].values
    months_idx = (np.array([np.datetime64(t).astype('datetime64[M]').astype(int)
                            for t in times]) % 12 + 1)

    monthly: dict[int, dict[str, list[float]]] = {
        m: {b: [] for b in bands} for m in range(1, 13)
    }

    for i, m in enumerate(months_idx):
        for band in bands:
            v = per_date[band].values[i]
            if v is None:
                continue
            v_f = float(v)
            if np.isfinite(v_f):
                monthly[int(m)][band].append(v_f)

    months_out = []
    annual_precip = 0.0
    annual_pet = 0.0
    for m in range(1, 13):
        if not monthly[m]['ppt']:
            continue
        entry = {
            'month': m,
            'precip': round(float(np.mean(monthly[m]['ppt'])), 1),
            'tmax':   round(float(np.mean(monthly[m]['tmax'])), 1),
            'tmin':   round(float(np.mean(monthly[m]['tmin'])), 1),
            'pdsi':   round(float(np.mean(monthly[m]['pdsi'])), 2)
                       if monthly[m]['pdsi'] else None,
            'pet':    round(float(np.mean(monthly[m]['pet'])), 1)
                       if monthly[m]['pet'] else None,
        }
        months_out.append(entry)
        annual_precip += entry['precip']
        if entry['pet']:
            annual_pet += entry['pet']

    if not months_out:
        return None

    aridity = round(annual_precip / annual_pet, 3) if annual_pet > 0 else None

    result = {
        'source': TERRACLIMATE_COLLECTION,
        'period': f'{start_year}-{end_year}',
        'computed': datetime.now(timezone.utc),
        'months': months_out,
        'annual_precip': round(annual_precip, 1),
        'annual_pet': round(annual_pet, 1) if annual_pet > 0 else None,
        'aridity_index': aridity,
    }

    logger.info(
        'terraclimate_baseline_built',
        months=len(months_out),
        annual_precip=result['annual_precip'],
        aridity_index=aridity,
    )

    return result


def lookup_monthly_climate(baseline: Optional[dict], month: int) -> Optional[dict]:
    """Get the climate normal for a given month, or None if missing."""
    if not baseline or 'months' not in baseline:
        return None
    for entry in baseline['months']:
        if entry.get('month') == month:
            return entry
    return None


# ──────────────────────────────────────────────────────────────────────────
# 2. Open-Meteo current conditions — last 30 days actual weather
# ──────────────────────────────────────────────────────────────────────────

def fetch_recent_climate(
    geometry: dict,
    days: int = 30,
) -> Optional[dict]:
    """
    Fetch the last N days of actual weather for a parcel via Open-Meteo
    archive API (free, no key, ERA5-backed).

    Returns:
        {
            'source': 'open-meteo-era5',
            'days': 30,
            'fetched': datetime,
            'precip_total_mm': 12.4,
            'temp_mean_c': 18.3,
            'temp_max_c': 28.1,
            'temp_min_c': 9.2,
            'et0_total_mm': 95.6,    # FAO reference evapotranspiration
            'days_with_rain': 4,
            'last_rain_days_ago': 7,
        }
        or None on failure.
    """
    lng, lat = geometry_centroid(geometry)
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days)

    params = {
        'latitude': round(lat, 4),
        'longitude': round(lng, 4),
        'start_date': start.isoformat(),
        'end_date': end.isoformat(),
        'daily': 'temperature_2m_mean,temperature_2m_max,temperature_2m_min,'
                 'precipitation_sum,et0_fao_evapotranspiration',
        'timezone': 'UTC',
    }

    logger.info('open_meteo_fetch_started', lat=lat, lng=lng, days=days)

    try:
        resp = requests.get(
            OPEN_METEO_ARCHIVE_URL, params=params, timeout=OPEN_METEO_TIMEOUT_S,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.warning('open_meteo_fetch_failed', error=str(e))
        return None

    daily = data.get('daily') or {}
    times = daily.get('time') or []
    if not times:
        return None

    def _safe(arr):
        return [v for v in (arr or []) if v is not None]

    precip = _safe(daily.get('precipitation_sum'))
    tmean = _safe(daily.get('temperature_2m_mean'))
    tmax = _safe(daily.get('temperature_2m_max'))
    tmin = _safe(daily.get('temperature_2m_min'))
    et0 = _safe(daily.get('et0_fao_evapotranspiration'))

    if not precip:
        return None

    days_with_rain = sum(1 for v in precip if v >= 1.0)
    last_rain_days_ago = None
    for i, v in enumerate(reversed(precip)):
        if v >= 1.0:
            last_rain_days_ago = i
            break

    result = {
        'source': 'open-meteo-era5',
        'days': len(precip),
        'fetched': datetime.now(timezone.utc),
        'precip_total_mm': round(float(sum(precip)), 1),
        'temp_mean_c': round(float(np.mean(tmean)), 1) if tmean else None,
        'temp_max_c':  round(float(max(tmax)), 1) if tmax else None,
        'temp_min_c':  round(float(min(tmin)), 1) if tmin else None,
        'et0_total_mm': round(float(sum(et0)), 1) if et0 else None,
        'days_with_rain': days_with_rain,
        'last_rain_days_ago': last_rain_days_ago,
    }

    logger.info(
        'open_meteo_fetched',
        precip=result['precip_total_mm'],
        tmean=result['temp_mean_c'],
        days_with_rain=days_with_rain,
    )

    return result


# ──────────────────────────────────────────────────────────────────────────
# 3. Combined climate snapshot — recent vs baseline
# ──────────────────────────────────────────────────────────────────────────

def compute_climate_anomaly(
    recent: Optional[dict],
    baseline: Optional[dict],
    month: int,
) -> Optional[dict]:
    """
    Compare 30-day actual weather against the climatological normal for
    this month — produces the "drought signal" used by the alert engine.

    Returns:
        {
            'precip_pct_of_normal': 19,    # 19% of normal → severe deficit
            'precip_anomaly_mm': -34,      # 34mm below normal
            'temp_anomaly_c': 2.1,         # 2.1°C above normal
            'drought_flag': 'severe',      # none|mild|moderate|severe
        }
        or None if data missing.
    """
    if not recent or not baseline:
        return None

    monthly = lookup_monthly_climate(baseline, month)
    if not monthly:
        return None

    normal_precip = monthly.get('precip')
    normal_tmean = (monthly.get('tmax', 0) + monthly.get('tmin', 0)) / 2.0 \
        if monthly.get('tmax') is not None and monthly.get('tmin') is not None \
        else None

    pct = None
    precip_anomaly = None
    if normal_precip is not None and normal_precip > 0:
        pct = round(100 * recent['precip_total_mm'] / normal_precip, 0)
        precip_anomaly = round(recent['precip_total_mm'] - normal_precip, 1)

    temp_anomaly = None
    if normal_tmean is not None and recent.get('temp_mean_c') is not None:
        temp_anomaly = round(recent['temp_mean_c'] - normal_tmean, 1)

    if pct is None:
        drought = None
    elif pct < 25:
        drought = 'severe'
    elif pct < 50:
        drought = 'moderate'
    elif pct < 75:
        drought = 'mild'
    else:
        drought = 'none'

    return {
        'precip_pct_of_normal': pct,
        'precip_anomaly_mm': precip_anomaly,
        'temp_anomaly_c': temp_anomaly,
        'drought_flag': drought,
    }
