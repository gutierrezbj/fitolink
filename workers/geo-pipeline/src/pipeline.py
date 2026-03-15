"""
Main pipeline runner - orchestrates the full Sentinel-2 → NDVI → Alert flow.
Runs as a cron job every 5 days.
"""
import os
import shutil
import structlog
from datetime import datetime, timedelta
from pymongo import MongoClient

from .config import MONGODB_URI, CLOUD_COVER_MAX, DOWNLOAD_DIR
from .ingestion.copernicus import CopernicusClient
from .processing.ndvi import extract_bands_from_safe, compute_ndvi, compute_parcel_stats
from .alerting.detector import detect_anomaly

logger = structlog.get_logger(__name__)


def get_parcel_bbox(geometry: dict) -> tuple[float, float, float, float]:
    """Extract bounding box from GeoJSON Polygon."""
    coords = geometry['coordinates'][0]
    lngs = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return (min(lngs), min(lats), max(lngs), max(lats))


def run_pipeline() -> None:
    """
    Main pipeline execution:
    1. Get all active parcels from MongoDB
    2. For each parcel, search recent Sentinel-2 imagery
    3. Compute NDVI statistics
    4. Run anomaly detection
    5. Store results and create alerts if needed
    """
    logger.info('pipeline_started')

    client = MongoClient(MONGODB_URI)
    db = client.get_default_database()

    # Get all active parcels
    parcels = list(db.parcels.find({'isActive': True}))
    logger.info('parcels_found', count=len(parcels))

    if not parcels:
        logger.info('no_parcels_to_process')
        return

    copernicus = CopernicusClient()
    processed = 0
    alerts_created = 0

    for parcel in parcels:
        parcel_id = str(parcel['_id'])
        parcel_name = parcel.get('name', 'Unknown')

        try:
            bbox = get_parcel_bbox(parcel['geometry'])
            end_date = datetime.now()
            start_date = end_date - timedelta(days=10)

            # Search for recent Sentinel-2 images
            products = copernicus.search_sentinel2(
                bbox=bbox,
                start_date=start_date,
                end_date=end_date,
                max_cloud_cover=CLOUD_COVER_MAX,
            )

            if not products:
                logger.info('no_imagery_found', parcel=parcel_name)
                continue

            product = products[0]
            product_id = product.get('Id', '')
            scene_id = product.get('Name', 'unknown')

            # Download Sentinel-2 product
            os.makedirs(DOWNLOAD_DIR, exist_ok=True)
            zip_path = os.path.join(DOWNLOAD_DIR, f'{scene_id}.zip')

            try:
                copernicus.download_product(product_id, zip_path)

                # Extract B04+B08, clip to parcel geometry, compute NDVI
                nir, red = extract_bands_from_safe(zip_path, parcel['geometry'], DOWNLOAD_DIR)
                ndvi_array = compute_ndvi(nir, red)
                stats = compute_parcel_stats(ndvi_array)

                current_mean = stats.mean

                # Store NDVI reading in parcel history
                new_reading = {
                    'date': datetime.now(),
                    'mean': stats.mean,
                    'min': stats.min_val,
                    'max': stats.max_val,
                    'anomalyDetected': False,
                    'source': 'sentinel2',
                }
                db.parcels.update_one(
                    {'_id': parcel['_id']},
                    {'$push': {'ndviHistory': new_reading}},
                )
                logger.info('ndvi_computed', parcel=parcel_name, mean=stats.mean, pixels=stats.pixel_count)

            finally:
                # Cleanup downloaded/extracted files
                if os.path.exists(zip_path):
                    os.remove(zip_path)
                for entry in os.listdir(DOWNLOAD_DIR):
                    entry_path = os.path.join(DOWNLOAD_DIR, entry)
                    if entry.endswith('.SAFE') and os.path.isdir(entry_path):
                        shutil.rmtree(entry_path)

            # Run anomaly detection
            ndvi_history = parcel.get('ndviHistory', [])
            previous_means = [r['mean'] for r in ndvi_history[-5:]]
            result = detect_anomaly(current_mean, previous_means)

            if result.is_anomaly:
                # Mark the reading as anomaly
                db.parcels.update_one(
                    {'_id': parcel['_id']},
                    {'$set': {'ndviHistory.$[last].anomalyDetected': True}},
                    array_filters=[{'last.date': new_reading['date']}],
                )

                # Create alert in MongoDB
                alert = {
                    'parcelId': parcel['_id'],
                    'type': result.alert_type,
                    'severity': result.severity,
                    'ndviValue': current_mean,
                    'ndviDelta': result.ndvi_delta,
                    'detectedAt': datetime.now(),
                    'status': 'new',
                    'aiConfidence': result.confidence,
                    'imagery': {'sentinelScene': scene_id},
                    'createdAt': datetime.now(),
                    'updatedAt': datetime.now(),
                }
                db.alerts.insert_one(alert)
                alerts_created += 1
                logger.info(
                    'alert_created',
                    parcel=parcel_name,
                    severity=result.severity,
                    ndvi=current_mean,
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
    )

    client.close()


if __name__ == '__main__':
    run_pipeline()
