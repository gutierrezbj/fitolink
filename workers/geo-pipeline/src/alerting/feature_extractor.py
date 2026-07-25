"""
NDVI time series feature extraction for ML anomaly detection.

Converts a raw NDVI history (list of floats, most recent last) into a
fixed-length feature vector that a classifier can consume.

Features are designed to capture:
- Absolute stress level (current NDVI)
- Short-term change (delta vs last reading)
- Medium-term trend (slope over 3-5 readings = 15-25 days)
- Pattern type (sudden drop vs sustained decline)
- Seasonality: expected NDVI for this crop type and month
- Data quality (how many historical readings available)
"""
import math
from dataclasses import dataclass
from typing import Optional

import numpy as np

# ── Seasonal NDVI baselines per crop type ─────────────────────────────────────
# (min_normal, max_normal) per month group — values below min are "dormant normal"
# Crops grouped by phenological behaviour:
#   - olive:       olivo (secano · banda BAJA propia, separado desde 25-jul-2026)
#   - evergreen:   citrico, almendro (semi)
#   - deciduous:   vinedo, frutal
#   - winter_annual: cereal, leguminosa, remolacha, patata
#   - summer_annual: girasol, maiz, algodon, arroz
#   - other:       hortaliza, otro

_SEASONAL: dict[str, dict[int, tuple[float, float]]] = {
    'evergreen': {
        1: (0.32, 0.62), 2: (0.33, 0.63), 3: (0.35, 0.65),
        4: (0.38, 0.68), 5: (0.40, 0.70), 6: (0.38, 0.68),
        7: (0.35, 0.65), 8: (0.33, 0.63), 9: (0.34, 0.64),
        10: (0.34, 0.64), 11: (0.32, 0.62), 12: (0.31, 0.61),
    },
    'deciduous': {
        # Mar-Apr: early bud break — real satellite values 0.08-0.20 are normal
        1: (0.08, 0.25), 2: (0.08, 0.28), 3: (0.08, 0.35),
        4: (0.08, 0.48), 5: (0.38, 0.65), 6: (0.48, 0.72),
        7: (0.52, 0.75), 8: (0.50, 0.73), 9: (0.42, 0.68),
        10: (0.28, 0.58), 11: (0.12, 0.35), 12: (0.08, 0.26),
    },
    'winter_annual': {
        1: (0.22, 0.50), 2: (0.30, 0.58), 3: (0.40, 0.68),
        4: (0.45, 0.72), 5: (0.30, 0.62), 6: (0.12, 0.30),
        7: (0.10, 0.22), 8: (0.10, 0.20), 9: (0.12, 0.25),
        10: (0.15, 0.32), 11: (0.18, 0.40), 12: (0.20, 0.46),
    },
    'summer_annual': {
        1: (0.08, 0.20), 2: (0.08, 0.20), 3: (0.10, 0.22),
        4: (0.12, 0.30), 5: (0.22, 0.48), 6: (0.40, 0.65),
        7: (0.48, 0.72), 8: (0.45, 0.70), 9: (0.30, 0.60),
        10: (0.12, 0.30), 11: (0.08, 0.22), 12: (0.08, 0.20),
    },
    # Olivar SEPARADO del perenne de regadío (25-jul-2026 · cierra el PENDIENTE
    # que dejó escrito predictiveInsightService.ts en junio). El olivar
    # tradicional de secano —mayoritario en España y en nuestra cartera— vive
    # estructuralmente BAJO: árboles dispersos, mucho suelo desnudo entre ellos
    # y caída fuerte en sequía estival. Compartir umbral con el cítrico de
    # regadío (0.38-0.70 en abril-mayo) hacía que un olivar sano a 0.35 NO se
    # suprimiera y llegase al modelo como candidato a anomalía. Valores en
    # sync con packages/shared/src/cropContext.ts (grupo 'olive').
    'olive': {
        1: (0.22, 0.48), 2: (0.24, 0.50), 3: (0.28, 0.54),
        4: (0.30, 0.56), 5: (0.30, 0.56), 6: (0.25, 0.52),
        7: (0.22, 0.48), 8: (0.22, 0.46), 9: (0.24, 0.48),
        10: (0.28, 0.52), 11: (0.28, 0.52), 12: (0.25, 0.50),
    },
    'other': {  # conservative — treat as evergreen
        m: (0.20, 0.70) for m in range(1, 13)
    },
}

_CROP_TO_GROUP: dict[str, str] = {
    'olivo': 'olive',
    'citrico': 'evergreen',
    'almendro': 'deciduous',
    'pistacho': 'deciduous',
    'vinedo': 'deciduous',
    'frutal': 'deciduous',
    'cereal': 'winter_annual',
    'leguminosa': 'winter_annual',
    'remolacha': 'winter_annual',
    'patata': 'winter_annual',
    'girasol': 'summer_annual',
    'maiz': 'summer_annual',
    'algodon': 'summer_annual',
    'arroz': 'summer_annual',
    'hortaliza': 'other',
    'otro': 'other',
}

# Integer ID per group for the feature vector.
#
# 'olive' comparte ID con 'evergreen' A PROPÓSITO (25-jul-2026): el modelo V2
# entrenado (anomaly_detector_v2.pkl) nunca ha visto un ID 5, así que inventarle
# uno nuevo cambiaría la distribución de esta feature para el cultivo mayoritario
# de la cartera sin reentrenar. Lo que SÍ queremos corregir —la banda estacional
# que usa la guarda de supresión— va por `_SEASONAL`/`seasonal_baseline`, que es
# independiente de este ID. Cuando se reentrene el modelo con el grupo separado,
# darle su propio ID (5) y bumpear `detectionModel`.
_GROUP_ID: dict[str, int] = {
    'evergreen': 0, 'olive': 0, 'deciduous': 1, 'winter_annual': 2, 'summer_annual': 3, 'other': 4
}


def seasonal_baseline(crop_type: str, month: int) -> tuple[float, float]:
    """Return (min_normal, max_normal) NDVI for this crop type and month."""
    group = _CROP_TO_GROUP.get(crop_type, 'other')
    return _SEASONAL[group][month]


def is_seasonally_normal(ndvi: float, crop_type: str, month: int) -> bool:
    """True when NDVI is within the expected seasonal range — not an anomaly."""
    lo, hi = seasonal_baseline(crop_type, month)
    return lo <= ndvi <= hi


@dataclass
class NdviFeatures:
    """Feature vector extracted from a parcel's NDVI time series."""

    # Absolute level
    current_ndvi: float
    below_critical: float       # 1.0 if NDVI < 0.30

    # Short-term delta
    delta_1: float

    # Medium-term deltas
    delta_3: float
    delta_5: float

    # Trend
    slope_3: float
    slope_5: float

    # Pattern
    drop_from_recent_max: float
    consecutive_drops: int
    volatility: float

    # NDRE
    ndre_delta_1: float

    # Seasonality (new)
    seasonal_deviation: float   # current_ndvi - seasonal_mid (negative = below expected)
    below_seasonal_min: float   # 1.0 if below seasonal minimum
    month_sin: float            # cyclical month encoding
    month_cos: float
    crop_group_id: float        # 0-4 integer group

    # Data quality
    history_length: int

    def to_array(self) -> np.ndarray:
        return np.array([
            self.current_ndvi,
            self.below_critical,
            self.delta_1,
            self.delta_3,
            self.delta_5,
            self.slope_3,
            self.slope_5,
            self.drop_from_recent_max,
            float(self.consecutive_drops),
            self.volatility,
            self.ndre_delta_1,
            self.seasonal_deviation,
            self.below_seasonal_min,
            self.month_sin,
            self.month_cos,
            self.crop_group_id,
            float(min(self.history_length, 10)),
        ], dtype=np.float32)

    @classmethod
    def feature_names(cls) -> list[str]:
        return [
            'current_ndvi', 'below_critical',
            'delta_1', 'delta_3', 'delta_5',
            'slope_3', 'slope_5',
            'drop_from_recent_max', 'consecutive_drops', 'volatility',
            'ndre_delta_1',
            'seasonal_deviation', 'below_seasonal_min', 'month_sin', 'month_cos',
            'crop_group_id', 'history_length',
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
    month: int = 6,
    crop_type: str = 'otro',
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

    # ── Seasonal features ────────────────────────────────────────────────────
    s_lo, s_hi = seasonal_baseline(crop_type, month)
    s_mid = (s_lo + s_hi) / 2.0
    seasonal_deviation = current_ndvi - s_mid
    below_seasonal_min = 1.0 if current_ndvi < s_lo else 0.0
    month_sin = math.sin(2 * math.pi * month / 12)
    month_cos = math.cos(2 * math.pi * month / 12)
    group = _CROP_TO_GROUP.get(crop_type, 'other')
    crop_group_id = float(_GROUP_ID[group])

    return NdviFeatures(
        current_ndvi=current_ndvi,
        below_critical=below_critical,
        delta_1=delta_1,
        delta_3=delta_3,
        delta_5=delta_5,
        slope_3=slope_3,
        slope_5=slope_5,
        drop_from_recent_max=drop_from_max,
        consecutive_drops=cons_drops,
        volatility=volatility,
        ndre_delta_1=ndre_delta_1,
        seasonal_deviation=seasonal_deviation,
        below_seasonal_min=below_seasonal_min,
        month_sin=month_sin,
        month_cos=month_cos,
        crop_group_id=crop_group_id,
        history_length=len(history),
    )
