"""
NDVI time series feature extraction for ML anomaly detection.

Converts a raw NDVI history (list of floats, most recent last) into a
fixed-length feature vector that a classifier can consume.

Features are designed to capture:
- Absolute stress level (current NDVI)
- Short-term change (delta vs last reading)
- Medium-term trend (slope over 3-5 readings = 15-25 days)
- Pattern type (sudden drop vs sustained decline)
- Data quality (how many historical readings available)
"""
from dataclasses import dataclass, field
from typing import Optional

import numpy as np


@dataclass
class NdviFeatures:
    """Feature vector extracted from a parcel's NDVI time series."""

    # Absolute level
    current_ndvi: float         # Current NDVI value
    below_critical: float       # 1.0 if NDVI < 0.30 (critical threshold)
    below_high: float           # 1.0 if NDVI < 0.40 (high concern threshold)

    # Short-term delta (vs 1 reading ago = ~5 days)
    delta_1: float              # current - prev (negative = drop)

    # Medium-term delta (vs N readings ago)
    delta_3: float              # current - reading 3 periods ago (~15 days)
    delta_5: float              # current - reading 5 periods ago (~25 days)

    # Trend (linear regression slope over recent readings)
    slope_3: float              # slope over last 3 readings (negative = declining)
    slope_5: float              # slope over last 5 readings

    # Pattern features
    drop_from_recent_max: float  # how far below recent peak (0.0 if at or above)
    consecutive_drops: int       # how many readings in a row declining
    volatility: float            # std dev of last 5 readings (high = stressed)

    # NDRE signal (chlorophyll stress, more sensitive than NDVI)
    ndre_delta_1: float          # NDRE delta (0.0 if NDRE unavailable)

    # Data quality
    history_length: int          # number of historical readings (capped at 10)

    def to_array(self) -> np.ndarray:
        """Convert to numpy array for scikit-learn input."""
        return np.array([
            self.current_ndvi,
            self.below_critical,
            self.below_high,
            self.delta_1,
            self.delta_3,
            self.delta_5,
            self.slope_3,
            self.slope_5,
            self.drop_from_recent_max,
            float(self.consecutive_drops),
            self.volatility,
            self.ndre_delta_1,
            float(min(self.history_length, 10)),
        ], dtype=np.float32)

    @classmethod
    def feature_names(cls) -> list[str]:
        return [
            'current_ndvi', 'below_critical', 'below_high',
            'delta_1', 'delta_3', 'delta_5',
            'slope_3', 'slope_5',
            'drop_from_recent_max', 'consecutive_drops', 'volatility',
            'ndre_delta_1', 'history_length',
        ]


def _linear_slope(values: list[float]) -> float:
    """Least-squares slope of a sequence. Negative = declining."""
    n = len(values)
    if n < 2:
        return 0.0
    x = np.arange(n, dtype=float)
    y = np.array(values, dtype=float)
    # slope = (n * Σxy - Σx * Σy) / (n * Σx² - (Σx)²)
    sx, sy = x.sum(), y.sum()
    sxy = (x * y).sum()
    sxx = (x * x).sum()
    denom = n * sxx - sx * sx
    return float((n * sxy - sx * sy) / denom) if denom != 0 else 0.0


def _count_consecutive_drops(history: list[float]) -> int:
    """Count how many consecutive periods the NDVI has been declining (most recent first)."""
    if len(history) < 2:
        return 0
    count = 0
    for i in range(len(history) - 1):
        if history[i] < history[i + 1]:  # history is oldest→newest
            break
        count += 1
    return count


def extract_features(
    current_ndvi: float,
    history: list[float],
    current_ndre: Optional[float] = None,
    prev_ndre: Optional[float] = None,
) -> NdviFeatures:
    """
    Extract ML features from a parcel's NDVI time series.

    Args:
        current_ndvi: The most recent NDVI reading (just computed).
        history: Previous NDVI mean values, ordered oldest → newest.
                 Does NOT include current_ndvi.
        current_ndre: Current NDRE value (if computed), else None.
        prev_ndre: Previous NDRE value (for delta), else None.

    Returns:
        NdviFeatures ready for .to_array() → classifier input.
    """
    # Build full sequence oldest → newest (including current)
    full = list(history) + [current_ndvi]
    n = len(full)

    # ── Absolute level ──────────────────────────────────────────────────────
    below_critical = 1.0 if current_ndvi < 0.30 else 0.0
    below_high = 1.0 if current_ndvi < 0.40 else 0.0

    # ── Deltas ──────────────────────────────────────────────────────────────
    delta_1 = current_ndvi - history[-1] if len(history) >= 1 else 0.0
    delta_3 = current_ndvi - history[-3] if len(history) >= 3 else delta_1
    delta_5 = current_ndvi - history[-5] if len(history) >= 5 else delta_1

    # ── Trends (linear slopes) ───────────────────────────────────────────────
    recent_3 = full[-3:]
    recent_5 = full[-5:]
    slope_3 = _linear_slope(recent_3)
    slope_5 = _linear_slope(recent_5)

    # ── Pattern features ─────────────────────────────────────────────────────
    recent_window = full[-6:-1]  # last 5 historical readings (before current)
    recent_max = max(recent_window) if recent_window else current_ndvi
    drop_from_max = max(0.0, recent_max - current_ndvi)

    # Consecutive drops: looking backwards from current
    reversed_full = list(reversed(full))
    cons_drops = _count_consecutive_drops(reversed_full)

    volatility = float(np.std(recent_5)) if len(recent_5) >= 2 else 0.0

    # ── NDRE delta ───────────────────────────────────────────────────────────
    ndre_delta_1 = 0.0
    if current_ndre is not None and prev_ndre is not None:
        ndre_delta_1 = current_ndre - prev_ndre

    return NdviFeatures(
        current_ndvi=current_ndvi,
        below_critical=below_critical,
        below_high=below_high,
        delta_1=delta_1,
        delta_3=delta_3,
        delta_5=delta_5,
        slope_3=slope_3,
        slope_5=slope_5,
        drop_from_recent_max=drop_from_max,
        consecutive_drops=cons_drops,
        volatility=volatility,
        ndre_delta_1=ndre_delta_1,
        history_length=len(history),
    )
