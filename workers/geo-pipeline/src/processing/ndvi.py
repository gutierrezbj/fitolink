"""
NDVI/NDRE computation from Sentinel-2 bands.

NDVI = (NIR - RED) / (NIR + RED) = (B08 - B04) / (B08 + B04)
NDRE = (NIR - RED_EDGE) / (NIR + RED_EDGE) = (B08 - B05) / (B08 + B05)
"""
import os
import zipfile
import numpy as np
import rasterio
from rasterio.mask import mask as rio_mask
from shapely.geometry import shape
import structlog
from dataclasses import dataclass

logger = structlog.get_logger(__name__)


def extract_bands_from_safe(
    zip_path: str,
    parcel_geometry: dict,
    extract_dir: str | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Extract B04 (Red) and B08 (NIR) at 10m resolution from a Sentinel-2 SAFE ZIP,
    clipped to the parcel geometry.

    Returns (nir_array, red_array) clipped to parcel bounds.
    """
    if extract_dir is None:
        extract_dir = os.path.dirname(zip_path)

    # Extract ZIP
    with zipfile.ZipFile(zip_path, 'r') as zf:
        zf.extractall(extract_dir)

    # Find B04 and B08 at 10m resolution inside SAFE structure
    safe_dir = os.path.join(extract_dir, [
        d for d in os.listdir(extract_dir) if d.endswith('.SAFE')
    ][0])

    b04_path = None
    b08_path = None
    for root, _dirs, files in os.walk(safe_dir):
        for f in files:
            if 'R10m' in root or '_10m' in f:
                if '_B04_' in f and f.endswith('.jp2'):
                    b04_path = os.path.join(root, f)
                elif '_B08_' in f and f.endswith('.jp2'):
                    b08_path = os.path.join(root, f)

    if not b04_path or not b08_path:
        raise FileNotFoundError(f'B04 or B08 bands not found in {safe_dir}')

    logger.info('bands_found', b04=b04_path, b08=b08_path)

    # Build parcel shape for clipping
    parcel_shape = shape(parcel_geometry)

    # Read and clip B04 (Red)
    with rasterio.open(b04_path) as src:
        red_clipped, _ = rio_mask(src, [parcel_shape], crop=True, all_touched=True)
        red = red_clipped[0]  # First band

    # Read and clip B08 (NIR)
    with rasterio.open(b08_path) as src:
        nir_clipped, _ = rio_mask(src, [parcel_shape], crop=True, all_touched=True)
        nir = nir_clipped[0]

    logger.info('bands_extracted', red_shape=red.shape, nir_shape=nir.shape)
    return nir, red


@dataclass
class NdviResult:
    """Result of NDVI/NDRE computation for a parcel."""
    mean: float
    min_val: float
    max_val: float
    std: float
    pixel_count: int
    cloud_fraction: float
    ndre_mean: float | None = None  # NDRE mean (Sprint ML — None if B05 unavailable)


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
