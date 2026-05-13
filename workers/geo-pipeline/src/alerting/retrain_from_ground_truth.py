"""
Retrain the V2 RandomForest detector with ground truth from resolved alerts.

Sprint feedback loop · paso 1 (Ola IA, 13-may-2026).

How it works
------------
1. Read all Alert documents where:
     · status='resolved'
     · resolvedBy in ('false_positive' | 'natural_recovery' | 'service')
     · detectionFeatures present (only V2 alerts; V1 doesn't compute features)
2. Convert each (features, resolvedBy + severity) → (X_row, y_label):
     · resolvedBy='false_positive'   → label 0 (healthy / model wrong)
     · resolvedBy='natural_recovery' → label 1 (mild anomaly, recovered alone)
     · resolvedBy='service' + severity='medium' → label 2 (real, needed action)
     · resolvedBy='service' + severity='high'    → label 2
     · resolvedBy='service' + severity='critical' → label 3
3. Combine real samples with the synthetic dataset (still useful as ballast
   while real data is scarce). Real samples get higher weight by repeating
   them in the training set.
4. Retrain RandomForest with the SAME hyperparameters as the original.
5. Backup the old model file (suffix .bak.YYYYMMDD-HHMMSS) and save the new.

Why this matters
----------------
The V2 detector ships trained ONLY on synthetic data because we couldn't
generate real labels before having a production. Now that the production
is acumulando alerts that humans resolve, those resolutions ARE the labels.
Each retrain run incorporates more reality and reduces the bias of the
synthetic seed.

Safety
------
- Idempotent: rerunning on the same Mongo state produces the same model.
- Reversible: old model is kept as `.bak.<timestamp>` next to the active one.
- Dry-run mode: load + count + report, but DON'T touch disk.
- If fewer than MIN_REAL_SAMPLES real alerts are available, exits without
  retraining (the synthetic-only model is better than a model overfit to
  10 alerts).

Run via
-------
  docker compose exec -T pipeline python -m src.alerting.retrain_from_ground_truth
  docker compose exec -T pipeline python -m src.alerting.retrain_from_ground_truth --dry-run
"""
import argparse
import os
import pickle
import shutil
from datetime import datetime
from typing import Optional

import numpy as np
import structlog
from pymongo import MongoClient

from .feature_extractor import NdviFeatures
from .ml_detector import (
    MODEL_PATH,
    _generate_synthetic_dataset,
)

logger = structlog.get_logger(__name__)

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:6040/fitolink')
MIN_REAL_SAMPLES = 20  # below this we don't retrain — synthetic-only is better
REAL_SAMPLE_WEIGHT = 3  # repeat each real sample N times so it dominates over synthetic


# ── Mapping resolvedBy + severity → label ────────────────────────────────

def _label_for(resolved_by: str, original_severity: Optional[str]) -> Optional[int]:
    """
    Map the farmer/asesor verdict back to a training label compatible with
    `_LABEL_TO_SEVERITY` in ml_detector.py:
        0 = healthy (no anomaly)
        1 = medium anomaly
        2 = high anomaly
        3 = critical anomaly
    """
    if resolved_by == 'false_positive':
        return 0
    if resolved_by == 'natural_recovery':
        return 1
    if resolved_by == 'service':
        if original_severity == 'critical':
            return 3
        if original_severity == 'high':
            return 2
        if original_severity == 'medium':
            return 2
        # severity 'low' resolvedBy 'service' is odd but classify as medium
        return 1
    return None


# ── Feature dict → np array (order matches NdviFeatures.to_array) ────────

def _features_to_array(d: dict) -> Optional[np.ndarray]:
    """
    Convert a stored feature dict into the same ordered float vector that
    `NdviFeatures.to_array()` produces. Returns None if any required field
    is missing (so the sample is dropped from training).
    """
    required = [
        'current_ndvi', 'below_critical', 'delta_1', 'delta_3', 'delta_5',
        'slope_3', 'slope_5', 'drop_from_recent_max', 'consecutive_drops',
        'volatility', 'ndre_delta_1', 'seasonal_deviation', 'below_seasonal_min',
        'month_sin', 'month_cos', 'crop_group_id', 'history_length',
    ]
    try:
        vec = [
            float(d['current_ndvi']),
            float(d['below_critical']),
            float(d['delta_1']),
            float(d['delta_3']),
            float(d['delta_5']),
            float(d['slope_3']),
            float(d['slope_5']),
            float(d['drop_from_recent_max']),
            float(d['consecutive_drops']),
            float(d['volatility']),
            float(d['ndre_delta_1']),
            float(d['seasonal_deviation']),
            float(d['below_seasonal_min']),
            float(d['month_sin']),
            float(d['month_cos']),
            float(d['crop_group_id']),
            float(min(int(d['history_length']), 10)),
        ]
        return np.array(vec, dtype=np.float32)
    except (KeyError, TypeError, ValueError):
        return None


# ── Collect (X, y) from Mongo ────────────────────────────────────────────

def _collect_real_samples(db) -> tuple[np.ndarray, np.ndarray, dict]:
    """Walk resolved alerts with detectionFeatures and build (X, y)."""
    samples_X: list[np.ndarray] = []
    samples_y: list[int] = []
    skipped = {
        'no_features': 0,
        'unknown_resolution': 0,
        'malformed_features': 0,
    }
    class_dist = {0: 0, 1: 0, 2: 0, 3: 0}

    query = {
        'status': 'resolved',
        'resolvedBy': {'$in': ['false_positive', 'natural_recovery', 'service']},
    }
    cursor = db.alerts.find(query)
    total_resolved = 0

    for alert in cursor:
        total_resolved += 1
        feats = alert.get('detectionFeatures')
        if not feats:
            skipped['no_features'] += 1
            continue
        label = _label_for(alert['resolvedBy'], alert.get('severity'))
        if label is None:
            skipped['unknown_resolution'] += 1
            continue
        vec = _features_to_array(feats)
        if vec is None:
            skipped['malformed_features'] += 1
            continue
        samples_X.append(vec)
        samples_y.append(label)
        class_dist[label] = class_dist.get(label, 0) + 1

    report = {
        'total_resolved': total_resolved,
        'usable_samples': len(samples_X),
        'class_distribution': class_dist,
        'skipped': skipped,
    }

    if not samples_X:
        return np.empty((0, 17), dtype=np.float32), np.empty((0,), dtype=int), report

    X = np.stack(samples_X)
    y = np.array(samples_y, dtype=int)
    return X, y, report


# ── Combine + retrain ────────────────────────────────────────────────────

def _retrain(X_real: np.ndarray, y_real: np.ndarray, weight: int):
    """Combine real + synthetic, retrain RandomForest, return fitted model."""
    from sklearn.ensemble import RandomForestClassifier

    # Synthetic ballast — same generator the V0 model used. Reduces variance
    # while we accumulate enough real samples to stand alone.
    X_syn, y_syn = _generate_synthetic_dataset()

    # Repeat real samples `weight` times to bias the model towards reality.
    X_real_rep = np.tile(X_real, (weight, 1)) if len(X_real) > 0 else X_real
    y_real_rep = np.tile(y_real, weight) if len(y_real) > 0 else y_real

    X = np.concatenate([X_syn, X_real_rep], axis=0) if len(X_real_rep) > 0 else X_syn
    y = np.concatenate([y_syn, y_real_rep], axis=0) if len(y_real_rep) > 0 else y_syn

    model = RandomForestClassifier(
        n_estimators=150,
        max_depth=8,
        min_samples_leaf=3,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X, y)

    return model, len(X_syn), len(X_real_rep)


# ── Main ─────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description='Retrain V2 detector with resolved-alert ground truth')
    parser.add_argument('--dry-run', action='store_true', help='Cosecha + report, NO toca disco')
    parser.add_argument('--min-samples', type=int, default=MIN_REAL_SAMPLES,
                        help=f'Mínimo de muestras reales para retrain (default {MIN_REAL_SAMPLES})')
    parser.add_argument('--real-weight', type=int, default=REAL_SAMPLE_WEIGHT,
                        help=f'Peso de cada muestra real (repeticiones) — default {REAL_SAMPLE_WEIGHT}')
    args = parser.parse_args()

    logger.info('retrain_started', uri=MONGODB_URI, dry_run=args.dry_run)

    client = MongoClient(MONGODB_URI)
    db = client.get_default_database()
    try:
        X_real, y_real, report = _collect_real_samples(db)
        logger.info('ground_truth_collected', **report)

        if len(X_real) < args.min_samples:
            logger.warning(
                'not_enough_real_samples_skipping_retrain',
                have=len(X_real),
                need=args.min_samples,
                hint='Espera a que el cron+farmers acumulen más resoluciones de Alert',
            )
            return 0

        model, n_syn, n_real_rep = _retrain(X_real, y_real, args.real_weight)
        logger.info(
            'model_retrained',
            n_synthetic=n_syn,
            n_real_repeated=n_real_rep,
            unique_real=len(X_real),
        )

        if args.dry_run:
            logger.info('dry_run_no_disk_write')
            return 0

        # Backup + save
        if os.path.exists(MODEL_PATH):
            timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
            backup_path = f'{MODEL_PATH}.bak.{timestamp}'
            shutil.copy2(MODEL_PATH, backup_path)
            logger.info('model_backup_created', path=backup_path)

        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump(model, f)
        logger.info('model_saved', path=MODEL_PATH)

        return 0
    finally:
        client.close()


if __name__ == '__main__':
    raise SystemExit(main())
