"""
Microsoft Planetary Computer client — Sprint MPC.

Provides read-only access to the public STAC catalog at
https://planetarycomputer.microsoft.com — used as a complement to CDSE.

Why MPC alongside CDSE:
- CDSE = authoritative, near-real-time Sentinel-2 (current state)
- MPC  = MODIS 25-year history + ERA5 climate (long-term context)

The free public catalog requires NO authentication for data access. Asset
URLs are signed transparently via `planetary_computer.sign_inplace`. An
optional subscription key (env var PC_SDK_SUBSCRIPTION_KEY) reduces
throttling — register free at planetarycomputer.microsoft.com.

This module is intentionally self-contained: failures here MUST NOT break
the main Sentinel-2 pipeline. Every public function returns Optional
results and logs warnings rather than raising.
"""
from __future__ import annotations

import os
from typing import Optional

import structlog

logger = structlog.get_logger(__name__)

PC_STAC_URL = 'https://planetarycomputer.microsoft.com/api/stac/v1'
PC_SUBSCRIPTION_KEY_ENV = 'PC_SDK_SUBSCRIPTION_KEY'


def _set_subscription_key() -> None:
    """Apply optional subscription key from env to reduce rate limiting."""
    key = os.getenv(PC_SUBSCRIPTION_KEY_ENV)
    if key:
        try:
            import planetary_computer as pc
            pc.set_subscription_key(key)
            logger.info('mpc_subscription_key_set')
        except Exception as e:  # pragma: no cover — defensive
            logger.warning('mpc_subscription_key_failed', error=str(e))


def open_catalog():
    """
    Open the MPC STAC catalog with auto-signing enabled.

    Returns the pystac Client or None if SDK is unavailable. Callers MUST
    handle None and degrade gracefully — MPC is never on the critical path.
    """
    try:
        import planetary_computer as pc
        from pystac_client import Client
    except ImportError:
        logger.warning('mpc_sdk_not_installed')
        return None

    _set_subscription_key()

    try:
        catalog = Client.open(PC_STAC_URL, modifier=pc.sign_inplace)
        return catalog
    except Exception as e:
        logger.warning('mpc_catalog_open_failed', error=str(e))
        return None


def is_available() -> bool:
    """Quick health check — true if the SDK is installed and catalog opens."""
    return open_catalog() is not None


def geometry_to_bbox(geometry: dict) -> tuple[float, float, float, float]:
    """Extract (west, south, east, north) bbox from a GeoJSON Polygon."""
    coords = geometry['coordinates'][0]
    lngs = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return (min(lngs), min(lats), max(lngs), max(lats))


def geometry_centroid(geometry: dict) -> tuple[float, float]:
    """Approximate centroid (lon, lat) of a GeoJSON Polygon."""
    coords = geometry['coordinates'][0]
    lng = sum(c[0] for c in coords) / len(coords)
    lat = sum(c[1] for c in coords) / len(coords)
    return (lng, lat)


def search_with_retry(catalog, *, max_attempts: int = 3, **search_kwargs):
    """
    Run a STAC search with one retry pass when MPC's server-side timeout
    fires ("The request exceeded the maximum allowed time"). MPC is
    notoriously bursty under anonymous load — a brief backoff usually
    succeeds.

    Returns a list of pystac items (possibly empty), or None on hard fail.
    """
    import time
    last_err: Optional[str] = None
    for attempt in range(1, max_attempts + 1):
        try:
            search = catalog.search(**search_kwargs)
            return list(search.items())
        except Exception as e:
            last_err = str(e)
            if 'maximum allowed time' not in last_err and 'timeout' not in last_err.lower():
                # not a timeout — fail fast
                logger.warning('stac_search_failed', error=last_err)
                return None
            if attempt < max_attempts:
                wait = 2 ** attempt
                logger.info('stac_search_retry', attempt=attempt, wait_s=wait)
                time.sleep(wait)
    logger.warning('stac_search_exhausted', error=last_err)
    return None


def expand_bbox(bbox: tuple[float, float, float, float], buffer_deg: float = 0.01
                ) -> tuple[float, float, float, float]:
    """
    Expand a bbox by `buffer_deg` degrees on each side.

    Useful for MODIS (250m pixels = ~0.0025deg): a small parcel may not
    intersect any MODIS pixel centroids without padding.
    """
    w, s, e, n = bbox
    return (w - buffer_deg, s - buffer_deg, e + buffer_deg, n + buffer_deg)
