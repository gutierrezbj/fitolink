"""
One-shot baseline builder — Sprint MPC.

Builds historical NDVI + climate baselines from Microsoft Planetary
Computer for every parcel that does not yet have them. Idempotent: safe
to run multiple times.

Run modes:
  python -m src.build_mpc_baselines              # missing parcels only
  python -m src.build_mpc_baselines --refresh    # force rebuild for all
  python -m src.build_mpc_baselines --parcel ID  # one parcel by ObjectId

Failures on individual parcels are logged and skipped — never aborts the
whole batch. The main NDVI pipeline never depends on this script having
succeeded.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

import structlog
from bson import ObjectId
from pymongo import MongoClient

from .config import MONGODB_URI
from .ingestion.modis_baseline import build_parcel_baseline
from .ingestion.climate_context import build_climate_baseline

logger = structlog.get_logger(__name__)


def _camel_modis(b: dict) -> dict:
    """snake_case from worker → camelCase for Mongoose schema."""
    return {
        'source': b['source'],
        'years': b['years'],
        'computed': b['computed'],
        'months': b['months'],
        'allTimeMean': b['all_time_mean'],
        'observationCount': b['observation_count'],
    }


def _camel_climate(b: dict) -> dict:
    return {
        'source': b['source'],
        'period': b['period'],
        'computed': b['computed'],
        'months': b['months'],
        'annualPrecip': b['annual_precip'],
        'annualPet': b.get('annual_pet'),
        'aridityIndex': b.get('aridity_index'),
    }


def process_parcel(db, parcel: dict, refresh: bool) -> dict:
    """Build (or rebuild) baselines for one parcel. Returns a status dict."""
    pid = parcel['_id']
    name = parcel.get('name', 'unknown')
    geometry = parcel['geometry']

    status = {'parcel': name, 'modis': 'skipped', 'climate': 'skipped'}

    # ── MODIS NDVI baseline ───────────────────────────────────────────────
    if refresh or not parcel.get('modisBaseline'):
        try:
            modis = build_parcel_baseline(geometry, years=5)
            if modis:
                db.parcels.update_one(
                    {'_id': pid},
                    {'$set': {'modisBaseline': _camel_modis(modis)}},
                )
                status['modis'] = 'built'
            else:
                status['modis'] = 'no_data'
        except Exception as e:
            logger.warning('modis_baseline_error', parcel=name, error=str(e))
            status['modis'] = f'error: {str(e)[:80]}'

    # ── TerraClimate baseline ─────────────────────────────────────────────
    if refresh or not parcel.get('climateBaseline'):
        try:
            climate = build_climate_baseline(geometry)
            if climate:
                db.parcels.update_one(
                    {'_id': pid},
                    {'$set': {'climateBaseline': _camel_climate(climate)}},
                )
                status['climate'] = 'built'
            else:
                status['climate'] = 'no_data'
        except Exception as e:
            logger.warning('climate_baseline_error', parcel=name, error=str(e))
            status['climate'] = f'error: {str(e)[:80]}'

    return status


def main() -> int:
    ap = argparse.ArgumentParser(description='Build MPC baselines for parcels')
    ap.add_argument('--refresh', action='store_true',
                    help='rebuild even if baseline already exists')
    ap.add_argument('--parcel', type=str, default=None,
                    help='build for a single parcel by ObjectId')
    args = ap.parse_args()

    client = MongoClient(MONGODB_URI)
    db = client.get_default_database()

    # Sprint Demo Aula Jaén · 18-may-2026: skip parcelas pedagógicas
    # sintéticas. Su MPC baseline viene hand-crafted desde el seed.
    query: dict = {'isActive': True, 'isSyntheticDemo': {'$ne': True}}
    if args.parcel:
        query['_id'] = ObjectId(args.parcel)
        # Override del filtro synthetic si se pide explicit por ObjectId
        query.pop('isSyntheticDemo', None)

    parcels = list(db.parcels.find(query))
    if not parcels:
        logger.info('no_parcels_to_process', query=str(query))
        client.close()
        return 0

    logger.info(
        'mpc_baseline_batch_started',
        parcels=len(parcels),
        refresh=args.refresh,
        started_at=datetime.now(timezone.utc).isoformat(),
    )

    summary = {'built': 0, 'skipped': 0, 'no_data': 0, 'error': 0}

    import time as _time
    for idx, parcel in enumerate(parcels):
        status = process_parcel(db, parcel, refresh=args.refresh)
        logger.info('parcel_processed', **status)
        for key in ('modis', 'climate'):
            v = status[key]
            if v == 'built':
                summary['built'] += 1
            elif v == 'skipped':
                summary['skipped'] += 1
            elif v == 'no_data':
                summary['no_data'] += 1
            elif v.startswith('error'):
                summary['error'] += 1
        # Polite pacing — Open-Meteo and MPC anonymous tiers throttle bursts.
        if idx < len(parcels) - 1:
            _time.sleep(2)

    logger.info('mpc_baseline_batch_completed', **summary)
    client.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
