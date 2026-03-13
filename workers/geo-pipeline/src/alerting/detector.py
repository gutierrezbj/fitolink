"""
Anomaly detection for NDVI timeseries.
V1: Static threshold-based detection.
V2 (future): CNN-based temporal pattern analysis.
"""
import structlog
from dataclasses import dataclass
from typing import Literal

from ..config import NDVI_ANOMALY_DROP_THRESHOLD, NDVI_CRITICAL_THRESHOLD, NDVI_HIGH_THRESHOLD

logger = structlog.get_logger(__name__)

Severity = Literal['low', 'medium', 'high', 'critical']
AlertType = Literal['ndvi_drop', 'ndre_anomaly', 'stress_pattern']


@dataclass
class AnomalyResult:
    """Result of anomaly detection for a single parcel reading."""
    is_anomaly: bool
    alert_type: AlertType
    severity: Severity
    confidence: float
    ndvi_delta: float
    reason: str


def detect_anomaly(
    current_ndvi: float,
    previous_readings: list[float],
) -> AnomalyResult:
    """
    Detect anomalies in NDVI values using static thresholds.

    Logic:
    1. If NDVI drops more than threshold from previous reading → anomaly
    2. Severity based on absolute NDVI value and drop magnitude
    3. Confidence is higher when more historical data confirms the pattern

    Args:
        current_ndvi: Current NDVI mean for the parcel
        previous_readings: List of previous NDVI mean values (most recent first)
    """
    if not previous_readings:
        return AnomalyResult(
            is_anomaly=False,
            alert_type='ndvi_drop',
            severity='low',
            confidence=0.0,
            ndvi_delta=0.0,
            reason='No hay lecturas previas para comparar',
        )

    prev = previous_readings[0]
    delta = current_ndvi - prev

    # Check for significant drop
    if delta >= -NDVI_ANOMALY_DROP_THRESHOLD:
        return AnomalyResult(
            is_anomaly=False,
            alert_type='ndvi_drop',
            severity='low',
            confidence=0.0,
            ndvi_delta=delta,
            reason='NDVI estable o mejorando',
        )

    # Determine severity
    severity: Severity
    if current_ndvi < NDVI_CRITICAL_THRESHOLD:
        severity = 'critical'
    elif current_ndvi < NDVI_HIGH_THRESHOLD:
        severity = 'high'
    elif abs(delta) > NDVI_ANOMALY_DROP_THRESHOLD * 2:
        severity = 'high'
    else:
        severity = 'medium'

    # Determine alert type
    alert_type: AlertType = 'ndvi_drop'
    if len(previous_readings) >= 3:
        # Check for sustained decline (stress pattern)
        recent_3 = previous_readings[:3]
        if all(r > current_ndvi for r in recent_3):
            alert_type = 'stress_pattern'

    # Calculate confidence based on data quality
    base_confidence = min(abs(delta) / 0.3, 1.0)  # Normalize by max expected drop
    data_quality_bonus = min(len(previous_readings) / 5, 0.2)  # More history = more confidence
    confidence = min(base_confidence + data_quality_bonus, 1.0)

    reason = f'Caida de NDVI de {abs(delta):.3f} (de {prev:.3f} a {current_ndvi:.3f})'

    logger.info(
        'anomaly_detected',
        severity=severity,
        alert_type=alert_type,
        delta=delta,
        confidence=confidence,
    )

    return AnomalyResult(
        is_anomaly=True,
        alert_type=alert_type,
        severity=severity,
        confidence=round(confidence, 2),
        ndvi_delta=round(delta, 4),
        reason=reason,
    )
