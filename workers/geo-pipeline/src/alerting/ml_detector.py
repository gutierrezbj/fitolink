"""
ML Anomaly Detector V2 — Sprint ML.

Uses a RandomForest classifier trained on synthetic NDVI time series to
detect anomalies with higher accuracy and fewer false positives than the
V1 threshold-based approach.

Training data: synthetic patterns covering the main stress scenarios
observed in Mediterranean agriculture (olives, vineyards, cereals):
  - Healthy seasonal variation
  - Sudden drop (pest, hail, fire)
  - Sustained decline (drought, soil depletion)
  - Critical stress (severe drought, disease)

Model is saved to disk after training. On subsequent startups it is loaded
from disk (fast). Retrain by deleting the model file or calling train().

Falls back to V1 threshold detector automatically if:
  - scikit-learn is not installed
  - Model file is corrupt
  - Prediction raises an exception
"""
import os
import pickle
import random
import structlog
from typing import Optional

import numpy as np

from .detector import AnomalyResult, detect_anomaly as detect_anomaly_v1
from .feature_extractor import NdviFeatures, extract_features, seasonal_baseline, is_seasonally_normal

logger = structlog.get_logger(__name__)

MODEL_PATH: str = os.getenv('ML_MODEL_PATH', '/app/models/anomaly_detector_v2.pkl')


# ── Synthetic training data generation ───────────────────────────────────────

def _make_seasonal_healthy(crop_type: str, month: int, length: int = 8) -> list[float]:
    """Healthy series following the seasonal baseline for a given crop/month."""
    lo, hi = seasonal_baseline(crop_type, month)
    base = random.uniform(lo, hi)
    noise = (hi - lo) * 0.12
    return [max(0.05, base + random.uniform(-noise, noise)) for _ in range(length)]


def _make_sudden_drop(crop_type: str, month: int, severity: str, length: int = 8) -> list[float]:
    """Sudden NDVI drop at the end: pest attack, hail, fire."""
    lo, hi = seasonal_baseline(crop_type, month)
    base = random.uniform((lo + hi) / 2, hi)
    if severity == 'medium':
        drop_target = random.uniform(lo * 0.6, lo * 0.95)
    elif severity == 'high':
        drop_target = random.uniform(lo * 0.4, lo * 0.75)
    else:  # critical
        drop_target = random.uniform(0.05, lo * 0.6)

    noise = (hi - lo) * 0.08
    stable = [max(0.05, base + random.uniform(-noise, noise)) for _ in range(length - 1)]
    stable.append(max(0.05, drop_target))
    return stable


def _make_sustained_decline(crop_type: str, month: int, severity: str, length: int = 8) -> list[float]:
    """Gradual NDVI decline over multiple periods: drought, soil depletion."""
    lo, hi = seasonal_baseline(crop_type, month)
    start = random.uniform((lo + hi) / 2, hi)
    if severity == 'medium':
        end = random.uniform(lo * 0.6, lo * 0.9)
    elif severity == 'high':
        end = random.uniform(lo * 0.4, lo * 0.7)
    else:  # critical
        end = random.uniform(0.05, lo * 0.55)

    step = (end - start) / (length - 1)
    return [max(0.05, start + step * i + random.uniform(-0.02, 0.02)) for i in range(length)]


# Crop types to sample during training (covers all phenological groups)
_TRAINING_CROPS = [
    ('olivo', 4), ('olivo', 8), ('olivo', 1),
    ('vinedo', 4), ('vinedo', 7), ('vinedo', 1), ('vinedo', 2), ('vinedo', 11),
    ('cereal', 3), ('cereal', 5), ('cereal', 8), ('cereal', 11),
    ('girasol', 7), ('girasol', 1),
    ('almendro', 4), ('almendro', 1),
    ('otro', 6),
]


def _generate_synthetic_dataset() -> tuple[np.ndarray, np.ndarray]:
    """
    Generate synthetic training dataset with seasonal awareness.

    Returns:
        X: feature matrix (n_samples, n_features)
        y: label array — 0=healthy, 1=medium anomaly, 2=high, 3=critical
    """
    random.seed(42)
    np.random.seed(42)

    samples: list[tuple[NdviFeatures, int]] = []

    for crop, month in _TRAINING_CROPS:
        # Healthy — label 0
        for _ in range(6):
            series = _make_seasonal_healthy(crop, month)
            feat = extract_features(series[-1], series[:-1], month=month, crop_type=crop)
            samples.append((feat, 0))

        # Sudden drop medium — label 1
        for _ in range(4):
            series = _make_sudden_drop(crop, month, 'medium')
            feat = extract_features(series[-1], series[:-1], month=month, crop_type=crop)
            samples.append((feat, 1))

        # Sudden drop high — label 2
        for _ in range(3):
            series = _make_sudden_drop(crop, month, 'high')
            feat = extract_features(series[-1], series[:-1], month=month, crop_type=crop)
            samples.append((feat, 2))

        # Sudden drop critical — label 3
        for _ in range(2):
            series = _make_sudden_drop(crop, month, 'critical')
            feat = extract_features(series[-1], series[:-1], month=month, crop_type=crop)
            samples.append((feat, 3))

        # Sustained decline medium — label 1
        for _ in range(3):
            series = _make_sustained_decline(crop, month, 'medium')
            feat = extract_features(series[-1], series[:-1], month=month, crop_type=crop)
            samples.append((feat, 1))

        # Sustained decline critical — label 3
        for _ in range(2):
            series = _make_sustained_decline(crop, month, 'critical')
            feat = extract_features(series[-1], series[:-1], month=month, crop_type=crop)
            samples.append((feat, 3))

    random.shuffle(samples)
    X = np.array([s[0].to_array() for s in samples])
    y = np.array([s[1] for s in samples])
    return X, y


# ── Label mapping ─────────────────────────────────────────────────────────────

_LABEL_TO_SEVERITY = {0: 'low', 1: 'medium', 2: 'high', 3: 'critical'}
_LABEL_TO_ALERT_TYPE = {
    0: 'ndvi_drop',    # no anomaly — won't be used
    1: 'ndvi_drop',
    2: 'ndvi_drop',
    3: 'ndvi_drop',
}


# ── Detector class ────────────────────────────────────────────────────────────

class MLAnomalyDetector:
    """
    V2 anomaly detector using RandomForestClassifier.

    Interface mirrors detect_anomaly() from detector.py so pipeline.py
    can swap V1 ↔ V2 with a single flag.
    """

    def __init__(self) -> None:
        self._model = None
        self._load_or_train()

    def _load_or_train(self) -> None:
        try:
            from sklearn.ensemble import RandomForestClassifier  # noqa: F401
        except ImportError:
            logger.warning('sklearn_not_installed_using_v1_detector')
            return

        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, 'rb') as f:
                    self._model = pickle.load(f)
                logger.info('ml_model_loaded', path=MODEL_PATH)
                return
            except Exception as e:
                logger.warning('ml_model_load_failed', error=str(e))

        # Train from scratch on synthetic data
        self._model = self._train()

    def _train(self):
        from sklearn.ensemble import RandomForestClassifier

        logger.info('ml_model_training_started')
        X, y = _generate_synthetic_dataset()

        model = RandomForestClassifier(
            n_estimators=150,
            max_depth=8,
            min_samples_leaf=3,
            class_weight='balanced',
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X, y)

        # Persist model
        try:
            os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
            with open(MODEL_PATH, 'wb') as f:
                pickle.dump(model, f)
            logger.info('ml_model_saved', path=MODEL_PATH)
        except Exception as e:
            logger.warning('ml_model_save_failed', error=str(e))

        logger.info(
            'ml_model_trained',
            n_samples=len(X),
            classes=list(np.unique(y)),
        )
        return model

    def detect(
        self,
        current_ndvi: float,
        history: list[float],
        current_ndre: Optional[float] = None,
        prev_ndre: Optional[float] = None,
        month: int = 6,
        crop_type: str = 'otro',
    ) -> AnomalyResult:
        """
        Detect anomalies using the ML model with V1 fallback.

        Args:
            current_ndvi: Latest NDVI reading.
            history: Previous NDVI readings, oldest → newest.
            current_ndre: Latest NDRE value if computed.
            prev_ndre: Previous NDRE value for delta.
            month: Calendar month (1-12) for seasonal context.
            crop_type: Parcel crop type for seasonal baseline.

        Returns:
            AnomalyResult compatible with V1 interface.
        """
        # Seasonal guard: if NDVI is within expected range for this crop/month → healthy
        if is_seasonally_normal(current_ndvi, crop_type, month):
            delta = (current_ndvi - history[-1]) if history else 0.0
            logger.info(
                'seasonally_normal',
                crop=crop_type, month=month, ndvi=current_ndvi,
            )
            return AnomalyResult(
                is_anomaly=False,
                alert_type='ndvi_drop',
                severity='low',
                confidence=0.0,
                ndvi_delta=round(delta, 4),
                reason=f'NDVI {current_ndvi:.2f} dentro del rango estacional normal para {crop_type} en mes {month}',
            )

        if self._model is None or len(history) < 1:
            return detect_anomaly_v1(current_ndvi, history)

        try:
            features = extract_features(current_ndvi, history, current_ndre, prev_ndre, month, crop_type)
            x = features.to_array().reshape(1, -1)

            label = int(self._model.predict(x)[0])
            proba = self._model.predict_proba(x)[0]

            is_anomaly = label > 0
            severity = _LABEL_TO_SEVERITY[label]
            confidence = round(float(proba[label]), 3)

            # Determine alert type: stress_pattern if sustained decline
            alert_type = 'ndvi_drop'
            if is_anomaly and features.consecutive_drops >= 3:
                alert_type = 'stress_pattern'
            elif is_anomaly and current_ndre is not None and (current_ndre - current_ndvi) > 0.08:
                # NDRE-NDVI gap indicates chlorophyll stress before visible NDVI drop
                alert_type = 'ndre_anomaly'

            delta = features.delta_1

            if not is_anomaly:
                return AnomalyResult(
                    is_anomaly=False,
                    alert_type='ndvi_drop',
                    severity='low',
                    confidence=confidence,
                    ndvi_delta=round(delta, 4),
                    reason='NDVI estable o mejorando (modelo V2)',
                )

            reason = (
                f'Caida de NDVI de {abs(delta):.3f} '
                f'(de {history[-1]:.3f} a {current_ndvi:.3f}) '
                f'— {alert_type}, confianza {confidence:.0%}'
            )
            if current_ndre is not None:
                reason += f' · NDRE={current_ndre:.3f}'

            logger.info(
                'ml_anomaly_detected',
                severity=severity,
                alert_type=alert_type,
                delta=delta,
                confidence=confidence,
                ndre=current_ndre,
            )

            return AnomalyResult(
                is_anomaly=True,
                alert_type=alert_type,
                severity=severity,
                confidence=confidence,
                ndvi_delta=round(delta, 4),
                reason=reason,
            )

        except Exception as e:
            logger.warning('ml_detect_failed_using_v1', error=str(e))
            return detect_anomaly_v1(current_ndvi, history)


# ── Module-level singleton ────────────────────────────────────────────────────

_detector: Optional[MLAnomalyDetector] = None


def get_detector() -> MLAnomalyDetector:
    """Return the singleton detector (lazy-init)."""
    global _detector
    if _detector is None:
        _detector = MLAnomalyDetector()
    return _detector
