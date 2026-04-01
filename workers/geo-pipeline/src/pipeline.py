"""
Main pipeline runner - orchestrates the full Sentinel-2 → NDVI → Alert flow.
Runs as a cron job every 5 days.

Processing strategy (Sprint GEE):
  Primary:  openEO cloud processing — sends process graph to CDSE, receives a
            small GeoTIFF in memory. No 500MB downloads, no disk I/O.
  Fallback: OData download — legacy path, used when USE_OPENEO=false or when
            openEO is unavailable (quota, network, credentials issue).
"""
import os
import shutil
import structlog
from datetime import datetime, timedelta
from pymongo import MongoClient
from typing import Optional

from .config import (
    MONGODB_URI, CLOUD_COVER_MAX, DOWNLOAD_DIR,
    USE_OPENEO, NDVI_GRID_ENABLED, NDVI_GRID_RESOLUTION,
)
from .ingestion.copernicus import CopernicusClient
from .ingestion.openeo_client import OpenEOClient
from .processing.ndvi import (
    NdviResult, extract_bands_from_safe, compute_ndvi, compute_parcel_stats,
)
from .alerting.ml_detector import get_detector

logger = structlog.get_logger(__name__)


def get_parcel_bbox(geometry: dict) -> tuple[float, float, float, float]:
    """Extract bounding box from GeoJSON Polygon."""
    coords = geometry['coordinates'][0]
    lngs = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return (min(lngs), min(lats), max(lngs), max(lats))


def _process_parcel_openeo(
    openeo_client: OpenEOClient,
    parcel: dict,
    start_date: datetime,
    end_date: datetime,
) -> Optional[tuple[NdviResult, str, Optional[bytes]]]:
    """
    Compute NDVI for a parcel using openEO cloud processing.
    Returns (NdviResult, scene_id, ndvi_raw_bytes) or None if no imagery found.
    ndvi_raw_bytes is the raw GeoTIFF bytes for intra-parcel grid generation.
    """
    result = openeo_client.compute_ndvi_stats(
        geometry=parcel['geometry'],
        start_date=start_date,
        end_date=end_date,
        max_cloud_cover=CLOUD_COVER_MAX,
    )
    if result is None:
        return None
    ndvi_stats, ndvi_raw_bytes = result
    scene_id = f"openeo_{end_date.strftime('%Y%m%d')}"
    return ndvi_stats, scene_id, ndvi_raw_bytes


def _process_parcel_odata(
    copernicus: CopernicusClient,
    parcel: dict,
    start_date: datetime,
    end_date: datetime,
) -> Optional[tuple[NdviResult, str]]:
    """
    Compute NDVI for a parcel using OData download (legacy fallback).
    Downloads a 500MB SAFE ZIP, extracts bands, clips to parcel, cleans up.
    Returns (NdviResult, scene_id) or None if no imagery found.
    """
    bbox = get_parcel_bbox(parcel['geometry'])
    products = copernicus.search_sentinel2(
        bbox=bbox,
        start_date=start_date,
        end_date=end_date,
        max_cloud_cover=CLOUD_COVER_MAX,
    )
    if not products:
        return None

    product = products[0]
    product_id = product.get('Id', '')
    scene_id = product.get('Name', 'unknown')

    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    zip_path = os.path.join(DOWNLOAD_DIR, f'{scene_id}.zip')

    try:
        copernicus.download_product(product_id, zip_path)
        nir, red = extract_bands_from_safe(zip_path, parcel['geometry'], DOWNLOAD_DIR)
        ndvi_array = compute_ndvi(nir, red)
        stats = compute_parcel_stats(ndvi_array)
        return stats, scene_id
    finally:
        if os.path.exists(zip_path):
            os.remove(zip_path)
        for entry in os.listdir(DOWNLOAD_DIR):
            entry_path = os.path.join(DOWNLOAD_DIR, entry)
            if entry.endswith('.SAFE') and os.path.isdir(entry_path):
                shutil.rmtree(entry_path)


def run_pipeline() -> None:
    """
    Main pipeline execution:
    1. Get all active parcels from MongoDB
    2. For each parcel, compute NDVI via openEO (or OData fallback)
    3. Run anomaly detection
    4. Store NDVI reading + create alerts when anomalies are detected
    """
    logger.info('pipeline_started', mode='openeo' if USE_OPENEO else 'odata_download')

    client = MongoClient(MONGODB_URI)
    db = client.get_default_database()

    parcels = list(db.parcels.find({'isActive': True}))
    logger.info('parcels_found', count=len(parcels))

    if not parcels:
        logger.info('no_parcels_to_process')
        client.close()
        return

    # Initialise clients
    openeo_client: Optional[OpenEOClient] = None
    copernicus_client: Optional[CopernicusClient] = None

    if USE_OPENEO:
        try:
            openeo_client = OpenEOClient()
            openeo_client.connect()
        except Exception as e:
            logger.warning('openeo_init_failed_using_fallback', error=str(e))
            openeo_client = None

    if openeo_client is None:
        copernicus_client = CopernicusClient()

    # Initialise ML detector (V2) once — loads/trains model on first call
    detector = get_detector()

    processed = 0
    alerts_created = 0
    openeo_used = 0
    odata_used = 0

    for parcel in parcels:
        parcel_id = str(parcel['_id'])
        parcel_name = parcel.get('name', 'Unknown')

        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=10)
            stats: Optional[NdviResult] = None
            scene_id = 'unknown'
            ndvi_raw_bytes: Optional[bytes] = None

            # Primary: openEO cloud processing
            if openeo_client is not None:
                try:
                    result = _process_parcel_openeo(openeo_client, parcel, start_date, end_date)
                    if result is not None:
                        stats, scene_id, ndvi_raw_bytes = result
                        openeo_used += 1
                    else:
                        logger.info('openeo_no_imagery', parcel=parcel_name)
                except Exception as e:
                    logger.warning(
                        'openeo_parcel_failed_using_fallback',
                        parcel=parcel_name,
                        error=str(e),
                    )

            # Fallback: OData download (also used if openEO found no imagery)
            if stats is None and copernicus_client is not None:
                try:
                    result = _process_parcel_odata(copernicus_client, parcel, start_date, end_date)
                    if result is not None:
                        stats, scene_id = result
                        odata_used += 1
                    else:
                        logger.info('odata_no_imagery', parcel=parcel_name)
                except Exception as e:
                    logger.error('odata_parcel_failed', parcel=parcel_name, error=str(e))

            # Fallback path when openEO is primary but OData client wasn't initialized
            if stats is None and openeo_client is not None and copernicus_client is None:
                try:
                    copernicus_client = CopernicusClient()
                    result = _process_parcel_odata(copernicus_client, parcel, start_date, end_date)
                    if result is not None:
                        stats, scene_id = result
                        odata_used += 1
                except Exception as e:
                    logger.error('fallback_odata_init_failed', parcel=parcel_name, error=str(e))

            if stats is None:
                logger.info('no_imagery_found', parcel=parcel_name)
                continue

            # Store NDVI reading (cloud_fraction + ndreValue from Sprint ML)
            new_reading = {
                'date': datetime.now(),
                'mean': stats.mean,
                'min': stats.min_val,
                'max': stats.max_val,
                'cloudFraction': stats.cloud_fraction,
                'anomalyDetected': False,
                'source': 'sentinel2',
            }
            if stats.ndre_mean is not None:
                new_reading['ndreValue'] = stats.ndre_mean

            db.parcels.update_one(
                {'_id': parcel['_id']},
                {'$push': {'ndviHistory': new_reading}},
            )

            # Intra-parcel NDVI grid snapshot (openEO path only — has GeoTIFF bytes)
            if NDVI_GRID_ENABLED and ndvi_raw_bytes is not None:
                try:
                    from .processing.ndvi_grid import build_grid_snapshot
                    snapshot = build_grid_snapshot(
                        geotiff_bytes=ndvi_raw_bytes,
                        geometry=parcel['geometry'],
                        parcel_id=parcel_id,
                        date=new_reading['date'],
                        resolution=NDVI_GRID_RESOLUTION,
                    )
                    if snapshot is not None:
                        db.ndvi_snapshots.insert_one(snapshot)
                        db.ndvi_snapshots.create_index(
                            [('parcelId', 1), ('date', -1)], background=True
                        )
                        logger.info('ndvi_grid_saved', parcel=parcel_name, points=len(snapshot['points']))
                except Exception as e:
                    logger.warning('ndvi_grid_failed', parcel=parcel_name, error=str(e))

            logger.info(
                'ndvi_stored',
                parcel=parcel_name,
                mean=stats.mean,
                ndre=stats.ndre_mean,
                pixels=stats.pixel_count,
                scene=scene_id,
            )

            # Anomaly detection V2 (ML) with V1 fallback
            ndvi_history = parcel.get('ndviHistory', [])
            previous_means = [r['mean'] for r in ndvi_history[-5:]]
            prev_ndre = ndvi_history[-1].get('ndreValue') if ndvi_history else None
            anomaly = detector.detect(
                current_ndvi=stats.mean,
                history=previous_means,
                current_ndre=stats.ndre_mean,
                prev_ndre=prev_ndre,
            )

            if anomaly.is_anomaly:
                db.parcels.update_one(
                    {'_id': parcel['_id']},
                    {'$set': {'ndviHistory.$[last].anomalyDetected': True}},
                    array_filters=[{'last.date': new_reading['date']}],
                )
                alert_doc = {
                    'parcelId': parcel['_id'],
                    'type': anomaly.alert_type,
                    'severity': anomaly.severity,
                    'ndviValue': stats.mean,
                    'ndviDelta': anomaly.ndvi_delta,
                    'detectedAt': datetime.now(),
                    'status': 'new',
                    'aiConfidence': anomaly.confidence,
                    'imagery': {'sentinelScene': scene_id},
                    'createdAt': datetime.now(),
                    'updatedAt': datetime.now(),
                }
                db.alerts.insert_one(alert_doc)
                alerts_created += 1
                logger.info(
                    'alert_created',
                    parcel=parcel_name,
                    severity=anomaly.severity,
                    ndvi=stats.mean,
                    reason=anomaly.reason,
                )

            processed += 1

        except Exception as e:
            logger.error('parcel_processing_error', parcel=parcel_name, error=str(e))
            continue

    logger.info(
        'pipeline_completed',
        parcels_processed=processed,
        alerts_created=alerts_created,
        total_parcels=len(parcels),
        openeo_used=openeo_used,
        odata_fallback_used=odata_used,
    )
    client.close()


if __name__ == '__main__':
    run_pipeline()
