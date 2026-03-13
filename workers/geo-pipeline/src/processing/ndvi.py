"""
NDVI/NDRE computation from Sentinel-2 bands.

NDVI = (NIR - RED) / (NIR + RED) = (B08 - B04) / (B08 + B04)
NDRE = (NIR - RED_EDGE) / (NIR + RED_EDGE) = (B08 - B05) / (B08 + B05)
"""
import numpy as np
import structlog
from dataclasses import dataclass

logger = structlog.get_logger(__name__)


@dataclass
class NdviResult:
    """Result of NDVI/NDRE computation for a parcel."""
    mean: float
    min_val: float
    max_val: float
    std: float
    pixel_count: int
    cloud_fraction: float


def compute_ndvi(nir: np.ndarray, red: np.ndarray) -> np.ndarray:
    """
    Compute NDVI from NIR (B08) and RED (B04) bands.
    Returns array with values in [-1, 1].
    """
    with np.errstate(divide='ignore', invalid='ignore'):
        ndvi = (nir.astype(float) - red.astype(float)) / (nir.astype(float) + red.astype(float))
        ndvi = np.where(np.isfinite(ndvi), ndvi, 0.0)
    return ndvi


def compute_ndre(nir: np.ndarray, red_edge: np.ndarray) -> np.ndarray:
    """
    Compute NDRE from NIR (B08) and RED EDGE (B05) bands.
    Returns array with values in [-1, 1].
    """
    with np.errstate(divide='ignore', invalid='ignore'):
        ndre = (nir.astype(float) - red_edge.astype(float)) / (nir.astype(float) + red_edge.astype(float))
        ndre = np.where(np.isfinite(ndre), ndre, 0.0)
    return ndre


def compute_parcel_stats(
    ndvi_array: np.ndarray,
    mask: np.ndarray | None = None,
) -> NdviResult:
    """
    Compute NDVI statistics for a parcel (masked region).

    Args:
        ndvi_array: Full scene NDVI array
        mask: Boolean mask where True = parcel pixels
    """
    if mask is not None:
        pixels = ndvi_array[mask]
    else:
        pixels = ndvi_array.flatten()

    # Filter out no-data values
    valid = pixels[(pixels >= -1) & (pixels <= 1)]

    if len(valid) == 0:
        logger.warn('no_valid_ndvi_pixels')
        return NdviResult(mean=0.0, min_val=0.0, max_val=0.0, std=0.0, pixel_count=0, cloud_fraction=1.0)

    cloud_fraction = 1.0 - (len(valid) / max(len(pixels), 1))

    return NdviResult(
        mean=float(np.mean(valid)),
        min_val=float(np.min(valid)),
        max_val=float(np.max(valid)),
        std=float(np.std(valid)),
        pixel_count=int(len(valid)),
        cloud_fraction=cloud_fraction,
    )
