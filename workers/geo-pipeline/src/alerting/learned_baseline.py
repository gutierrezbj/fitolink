"""
Learned baseline per parcel — Ola 1.2 (pattern from OverWatch v2 §5.2).

Each parcel develops its own "normal" pattern over time. A NDVI of 0.45 in
a high-vigor olive grove may be a real drop, while the same 0.45 in a
sparser plot may be perfectly healthy. The crop-type-and-month seasonal
baseline (feature_extractor.seasonal_baseline) is generic. The MODIS 5-yr
baseline (Sprint MPC) is parcel-specific but coarse (250m, monthly mean).

This module adds a third lens: the parcel's *own* recent Sentinel-2 history
as a learned baseline. Same parcel, same sensor, same processing — the
tightest possible reference for "is this reading abnormal for THIS plot?"

Used as a post-hoc override on the V2 classifier (same pattern as the MODIS
override already in ml_detector.detect):
  - Z-score within ±1σ of the learned baseline AND quality≥0.5 → suppress
    anomaly verdict (probably within this parcel's natural variance).
  - Z-score below -2.5σ AND quality≥0.5 → escalate, even if RF said
    "healthy" (this reading is unusual specifically for THIS parcel).

No retraining required. Quality score caps the influence when there is
too little history to trust the learned baseline.
"""
from dataclasses import dataclass
from typing import Optional

import numpy as np
import structlog

logger = structlog.get_logger(__name__)

# Minimum history points before we trust a learned baseline at all.
MIN_HISTORY_FOR_BASELINE = 6   # ~30 days of Sentinel-2 readings

# Quality reaches 1.0 at this much history (or more).
FULL_QUALITY_HISTORY = 18      # ~3 months of readings

# Suppression / escalation thresholds, in standard deviations.
SUPPRESS_Z_MAX = 1.0           # |z| < this → within normal range, suppress
ESCALATE_Z_MIN = 2.5           # z < -this → strongly abnormal, escalate

# Minimum quality required for an override to fire.
OVERRIDE_QUALITY_FLOOR = 0.5


@dataclass
class LearnedBaseline:
    """Statistical summary of a parcel's own NDVI history."""

    mean: float           # arithmetic mean of recent NDVI history
    std: float            # standard deviation (always > 0 to avoid div-by-zero)
    n: int                # number of points used
    quality: float        # 0.0 = no data, 1.0 = enough history to fully trust

    def z_score(self, ndvi: float) -> float:
        """How many standard deviations current NDVI is from the parcel mean."""
        if self.std <= 1e-6:
            return 0.0
        return (ndvi - self.mean) / self.std

    def is_trustworthy(self) -> bool:
        return self.quality >= OVERRIDE_QUALITY_FLOOR


def compute_baseline(history: list[float]) -> Optional[LearnedBaseline]:
    """
    Compute a parcel's learned baseline from its own Sentinel-2 NDVI history.

    Args:
        history: NDVI readings ordered oldest → newest. Should NOT include
                 the current reading we're trying to evaluate.

    Returns:
        LearnedBaseline if there are enough points, else None.
    """
    if not history or len(history) < MIN_HISTORY_FOR_BASELINE:
        return None

    # Use up to the last FULL_QUALITY_HISTORY points — older readings dilute
    # the signal because the parcel's "normal" may have shifted (rotation,
    # replanting, irrigation upgrade).
    window = history[-FULL_QUALITY_HISTORY:]
    arr = np.asarray(window, dtype=float)
    mean = float(arr.mean())
    # ddof=1 → unbiased estimator. Add tiny floor so z-scores stay finite for
    # extremely stable parcels.
    std = float(arr.std(ddof=1)) if len(arr) > 1 else 0.0
    std = max(std, 0.01)
    quality = min(1.0, len(window) / FULL_QUALITY_HISTORY)

    return LearnedBaseline(mean=mean, std=std, n=len(window), quality=quality)


@dataclass
class OverrideResult:
    """Outcome of applying the learned-baseline override to a verdict."""

    is_anomaly: bool
    severity: str
    reason_fragment: Optional[str]   # extra text to append to the alert reason
    applied: bool                    # whether the override actually fired


def apply_learned_override(
    current_ndvi: float,
    initial_is_anomaly: bool,
    initial_severity: str,
    baseline: Optional[LearnedBaseline],
) -> OverrideResult:
    """
    Apply the learned-baseline override on top of the V2 classifier verdict.

    Args:
        current_ndvi: The most recent NDVI reading.
        initial_is_anomaly: What the RF model said.
        initial_severity: Severity the RF model assigned.
        baseline: Parcel's learned baseline, or None if insufficient history.

    Returns:
        OverrideResult with possibly modified verdict + reason fragment.
    """
    # No baseline → cannot override either direction.
    if baseline is None or not baseline.is_trustworthy():
        return OverrideResult(
            is_anomaly=initial_is_anomaly,
            severity=initial_severity,
            reason_fragment=None,
            applied=False,
        )

    z = baseline.z_score(current_ndvi)

    # Case 1 — RF said anomaly but reading is well within parcel's own range.
    # Likely seasonal noise the generic model couldn't distinguish.
    if initial_is_anomaly and abs(z) < SUPPRESS_Z_MAX:
        logger.info(
            'learned_baseline_suppress',
            ndvi=current_ndvi,
            baseline_mean=round(baseline.mean, 3),
            baseline_std=round(baseline.std, 3),
            z_score=round(z, 2),
            n=baseline.n,
        )
        return OverrideResult(
            is_anomaly=False,
            severity='low',
            reason_fragment=(
                f'suprimida por baseline aprendido parcela '
                f'(media {baseline.mean:.2f} ± {baseline.std:.2f}, z={z:+.1f}, n={baseline.n})'
            ),
            applied=True,
        )

    # Case 2 — RF missed it: reading is well below this parcel's own pattern.
    # Escalate to at least 'high' (or keep critical if already there).
    if not initial_is_anomaly and z < -ESCALATE_Z_MIN:
        escalated = 'high' if initial_severity in ('low', 'medium') else initial_severity
        logger.info(
            'learned_baseline_escalate',
            ndvi=current_ndvi,
            baseline_mean=round(baseline.mean, 3),
            baseline_std=round(baseline.std, 3),
            z_score=round(z, 2),
            n=baseline.n,
        )
        return OverrideResult(
            is_anomaly=True,
            severity=escalated,
            reason_fragment=(
                f'escalada por baseline aprendido parcela: '
                f'NDVI {current_ndvi:.2f} vs media {baseline.mean:.2f} '
                f'± {baseline.std:.2f} (z={z:+.1f}, n={baseline.n})'
            ),
            applied=True,
        )

    # Otherwise the learned baseline agrees with the RF; just attach context.
    return OverrideResult(
        is_anomaly=initial_is_anomaly,
        severity=initial_severity,
        reason_fragment=(
            f'baseline aprendido parcela: media {baseline.mean:.2f} '
            f'± {baseline.std:.2f}, z={z:+.1f}, n={baseline.n}'
        ),
        applied=False,
    )
