"""
Main pipeline runner - orchestrates the full Sentinel-2 → NDVI → Alert flow.
Runs as a cron job every 5 days.
"""
import structlog
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson import ObjectId

from .config import MONGODB_URI, CLOUD_COVER_MAX
from .ingestion.copernicus import CopernicusClient
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

            # For MVP: simulate NDVI computation from product metadata
            # In production: download bands, compute NDVI with rasterio
            product = products[0]
            scene_id = product.get('Name', 'unknown')

            # TODO: Replace with actual rasterio-based NDVI computation
            # For now, we use the existing ndviHistory to simulate
            ndvi_history = parcel.get('ndviHistory', [])
            previous_means = [r['mean'] for r in ndvi_history[-5:]]

            if not previous_means:
                logger.info('no_ndvi_history', parcel=parcel_name)
                continue

            # Simulate current reading (in production: computed from bands)
            # For MVP demo, we check the last reading for anomalies
            current_mean = previous_means[-1] if previous_means else 0.5

            # Run anomaly detection on latest reading
            previous_for_detection = previous_means[:-1] if len(previous_means) > 1 else []
            result = detect_anomaly(current_mean, list(reversed(previous_for_detection)))

            if result.is_anomaly:
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
