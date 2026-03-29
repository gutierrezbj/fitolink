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
from .feature_extractor import NdviFeatures, extract_features

logger = structlog.get_logger(__name__)

MODEL_PATH: str = os.getenv('ML_MODEL_PATH', '/app/models/anomaly_detector_v2.pkl')


# ── Synthetic training data generation ───────────────────────────────────────

def _make_healthy_series(length: int = 8) -> list[float]:
    """Healthy parcel: NDVI 0.45–0.65, gentle seasonal oscillation."""
    base = random.uniform(0.48, 0.62)
    return [base + random.uniform(-0.05, 0.05) for _ in range(length)]


def _make_sudden_drop(severity: str, length: int = 8) -> list[float]:
    """Sudden NDVI drop at the end: pest attack, hail, fire."""
    if severity == 'medium':
        base = random.uniform(0.50, 0.65)
        drop_target = random.uniform(0.35, 0.44)
    elif severity == 'high':
        base = random.uniform(0.50, 0.65)
        drop_target = random.uniform(0.30, 0.39)
    else:  # critical
        base = random.uniform(0.48, 0.65)
        drop_target = random.uniform(0.15, 0.29)

    stable = [base + random.uniform(-0.04, 0.04) for _ in range(length - 1)]
    stable.append(drop_target)
    return stable


def _make_sustained_decline(severity: str, length: int = 8) -> list[float]:
    """Gradual NDVI decline over multiple periods: drought, soil depletion."""
    if severity == 'medium':
        start = random.uniform(0.52, 0.65)
        end = random.uniform(0.38, 0.45)
    elif severity == 'high':
        start = random.uniform(0.52, 0.65)
        end = random.uniform(0.30, 0.38)
    else:  # critical
        start = random.uniform(0.50, 0.65)
        end = random.uniform(0.15, 0.29)

    step = (end - start) / (length - 1)
    return [start + step * i + random.uniform(-0.02, 0.02) for i in range(length)]


def _generate_synthetic_dataset() -> tuple[np.ndarray, np.ndarray]:
    """
    Generate synthetic training dataset.

    Returns:
        X: feature matrix (n_samples, n_features)
        y: label array (n_samples,) — 0=no anomaly, 1=medium, 2=high, 3=critical
    """
    random.seed(42)
    np.random.seed(42)

    samples: list[tuple[NdviFeatures, int]] = []

    # Healthy (label=0)
    for _ in range(80):
        series = _make_healthy_series()
        feat = extract_features(series[-1], series[:-1])
        samples.append((feat, 0))

    # Sudden drop — medium (label=1)
    for _ in range(45):
        series = _make_sudden_drop('medium')
        feat = extract_features(series[-1], series[:-1])
        samples.append((feat, 1))

    # Sudden drop — high (label=2)
    for _ in range(35):
        series = _make_sudden_drop('high')
        feat = extract_features(series[-1], series[:-1])
        samples.append((feat, 2))

    # Sudden drop — critical (label=3)
    for _ in range(25):
        series = _make_sudden_drop('critical')
        feat = extract_features(series[-1], series[:-1])
        samples.append((feat, 3))

    # Sustained decline — medium (label=1)
    for _ in range(35):
        series = _make_sustained_decline('medium')
        feat = extract_features(series[-1], series[:-1])
        samples.append((feat, 1))

    # Sustained decline — high (label=2)
    for _ in range(25):
        series = _make_sustained_decline('high')
        feat = extract_features(series[-1], series[:-1])
        samples.append((feat, 2))

    # Sustained decline — critical (label=3)
    for _ in range(20):
        series = _make_sustained_decline('critical')
        feat = extract_features(series[-1], series[:-1])
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
    ) -> AnomalyResult:
        """
        Detect anomalies using the ML model with V1 fallback.

        Args:
            current_ndvi: Latest NDVI reading.
            history: Previous NDVI readings, oldest → newest.
            current_ndre: Latest NDRE value if computed.
            prev_ndre: Previous NDRE value for delta.

        Returns:
            AnomalyResult compatible with V1 interface.
        """
        if self._model is None or len(history) < 1:
            # Fall back to V1
            return detect_anomaly_v1(current_ndvi, history)

        try:
            features = extract_features(current_ndvi, history, current_ndre, prev_ndre)
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
