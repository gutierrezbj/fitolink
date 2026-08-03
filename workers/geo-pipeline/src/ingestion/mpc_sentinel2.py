"""
MPC Sentinel-2 client — reemplazo de openEO/CDSE para el NDVI en vivo.

Por qué existe (3-ago-2026): CDSE nos dejó tirados dos veces con CERO clientes
de pago — 402 (sin créditos) el 17-jul y 401 (cuenta bloqueada) esta noche, con
10000 créditos "activos". El modelo de CDSE es "procesa en nuestra nube y paga
créditos por trabajo", y no escala. Microsoft Planetary Computer sirve el MISMO
Sentinel-2 L2A como datos abiertos, SIN cupo ni créditos: descargamos las bandas
y calculamos el NDVI nosotros (rasterio ya es dependencia).

Este cliente reproduce EXACTAMENTE el método de OpenEOClient.compute_ndvi_stats
(mismo contrato de entrada/salida, drop-in): máscara de nubes por SCL, offset de
harmonización, MAX composite temporal, recorte al polígono, y los mismos cinco
índices. Validado en spike 3-ago contra openEO en Olivar Los Toros: min/max NDVI
IDÉNTICOS (0.1139 / 0.6574), media a 0.007 (efecto bbox vs polígono). Ver
docs/migracion-mpc.md.

Sin concepto de "error de cuenta": MPC es público y gratuito, así que un fallo
afecta a UNA parcela (no aborta la corrida como el 401 de CDSE).
"""
from __future__ import annotations

import io
from datetime import datetime
from typing import Optional

import numpy as np
import structlog

from ..config import CLOUD_COVER_MAX
from ..processing.ndvi import NdviResult
from .planetary_computer import open_catalog, search_with_retry, geometry_to_bbox

logger = structlog.get_logger(__name__)

MPC_COLLECTION = 'sentinel-2-l2a'
# SCL a enmascarar — IDÉNTICO a openeo_client._SCL_CLOUD_VALUES:
# 0=no data 1=saturated 3=cloud shadow 8=cloud med 9=cloud high 10=cirrus 11=snow
_SCL_CLOUD_VALUES = [0, 1, 3, 8, 9, 10, 11]
# Resolución de carga en grados (~10 m). Sentinel-2 es 10 m en las bandas RGB/NIR.
_RESOLUTION_DEG = 0.0001
# Offset de harmonización BOA. Todas las escenas L2A con baseline de proceso
# ≥ 04.00 (desde 2022-01-25) llevan BOA_ADD_OFFSET = -1000; MPC sirve el DN sin
# aplicarlo. reflectancia = (DN + offset) / 10000. Para 2026 SIEMPRE aplica.
_HARMONIZE_OFFSET = -1000.0
_REFL_SCALE = 10000.0


class MpcSentinel2Client:
    """
    Cliente Sentinel-2 sobre Microsoft Planetary Computer.

    Uso (mismo patrón que OpenEOClient):
        client = MpcSentinel2Client()
        client.connect()
        result = client.compute_ndvi_stats(geometry, start_date, end_date)
    """

    def __init__(self) -> None:
        self._catalog = None

    def connect(self) -> None:
        """Abre el catálogo STAC de MPC (auto-firma de assets)."""
        self._catalog = open_catalog()
        if self._catalog is None:
            raise RuntimeError('No se pudo abrir el catálogo de Planetary Computer (SDK ausente o fallo de red)')
        logger.info('mpc_connected', collection=MPC_COLLECTION)

    def compute_ndvi_stats(
        self,
        geometry: dict,
        start_date: datetime,
        end_date: datetime,
        max_cloud_cover: float = CLOUD_COVER_MAX,
    ) -> Optional[tuple[NdviResult, bytes]]:
        """
        Calcula NDVI + NDRE + NDMI + EVI + SAVI para una parcela desde MPC.

        Método (idéntico a openEO):
          1. STAC search sentinel-2-l2a por bbox + ventana + max_cloud_cover
          2. Carga B02,B04,B05,B08,B11,SCL (odc-stac, assets auto-firmados)
          3. Máscara de nubes por SCL
          4. Reflectancia = (DN - 1000) / 10000  (harmonización + escala)
          5. Índices por escena, luego MAX composite temporal por píxel
          6. Recorte al polígono de la parcela
          7. Estadísticos (media/min/max/std/px) + GeoTIFF NDVI para el grid

        Devuelve (NdviResult, ndvi_geotiff_bytes) o None si no hay imagen válida.
        """
        if self._catalog is None:
            raise RuntimeError('Llama a connect() antes de compute_ndvi_stats()')

        try:
            from odc.stac import stac_load
        except ImportError:
            raise RuntimeError('odc-stac es necesario para el cliente MPC (odc-stac>=0.3.10)')
        import rasterio
        import rasterio.features
        from rasterio.io import MemoryFile

        bbox = list(geometry_to_bbox(geometry))
        start_str = start_date.strftime('%Y-%m-%d')
        end_str = end_date.strftime('%Y-%m-%d')

        logger.info('mpc_processing_started', bbox=tuple(bbox), start=start_str, end=end_str, max_cloud=max_cloud_cover)

        items = search_with_retry(
            self._catalog,
            collections=[MPC_COLLECTION],
            bbox=bbox,
            datetime=f'{start_str}/{end_str}',
            query={'eo:cloud_cover': {'lt': max_cloud_cover}},
            limit=25,
        )
        if not items:
            logger.info('mpc_no_items', bbox=tuple(bbox))
            return None

        try:
            ds = stac_load(
                items,
                bands=['B02', 'B04', 'B05', 'B08', 'B11', 'SCL'],
                bbox=bbox,
                chunks={},
                resolution=_RESOLUTION_DEG,
                crs='EPSG:4326',
            )
        except Exception as e:
            logger.warning('mpc_stac_load_failed', error=str(e), bbox=tuple(bbox))
            return None

        # Reflectancia harmonizada + máscara de nubes SCL
        cloud = ds['SCL'].isin(_SCL_CLOUD_VALUES)

        def refl(band: str):
            # (DN + offset) / escala, recortado a >= 0, y NaN en píxeles nubosos
            r = (ds[band].astype('float32') + _HARMONIZE_OFFSET) / _REFL_SCALE
            return r.clip(min=0.0).where(~cloud)

        b02, b04, b05, b08, b11 = refl('B02'), refl('B04'), refl('B05'), refl('B08'), refl('B11')

        def norm_diff(a, b):
            d = a + b
            return (a - b) / np.where(d == 0, np.nan, d)

        ndvi = norm_diff(b08, b04)
        ndre = norm_diff(b08, b05)
        ndmi = norm_diff(b08, b11)
        evi = 2.5 * (b08 - b04) / (b08 + 6.0 * b04 - 7.5 * b02 + 1.0)
        savi = 1.5 * (b08 - b04) / (b08 + b04 + 0.5)

        # MAX composite temporal (píxel más claro/verde de la ventana) — idéntico
        # a reduce_temporal('max') de openEO.
        ndvi_c = ndvi.max('time')
        ndre_c = ndre.max('time')
        ndmi_c = ndmi.max('time')
        evi_c = evi.max('time')
        savi_c = savi.max('time')

        # Máscara del polígono (recorte espacial, como filter_spatial de openEO)
        gb = ndvi_c.odc.geobox
        try:
            # all_touched=True: incluye todo píxel que TOQUE el polígono, no solo
            # aquellos cuyo centro cae dentro. Paridad con el rio_mask de la ruta
            # legacy (processing/ndvi.py) y evita perder parcelas finas/pequeñas.
            poly_mask = rasterio.features.geometry_mask(
                [geometry], out_shape=gb.shape, transform=gb.transform,
                invert=True, all_touched=True,
            )
        except Exception as e:
            logger.warning('mpc_geometry_mask_failed', error=str(e))
            return None

        ndvi_arr = ndvi_c.values
        valid_mask = poly_mask & np.isfinite(ndvi_arr)
        ndvi_valid = np.clip(ndvi_arr[valid_mask], -1.0, 1.0)
        if ndvi_valid.size == 0:
            logger.info('mpc_no_valid_pixels', bbox=tuple(bbox))
            return None

        poly_px = int(np.count_nonzero(poly_mask))
        cloud_fraction = round(1.0 - (ndvi_valid.size / max(poly_px, 1)), 3)

        def index_mean(arr, lo: float, hi: float) -> Optional[float]:
            v = arr[poly_mask & np.isfinite(arr)]
            if v.size == 0:
                return None
            return round(float(np.mean(np.clip(v, lo, hi))), 4)

        result = NdviResult(
            mean=round(float(np.mean(ndvi_valid)), 4),
            min_val=round(float(np.min(ndvi_valid)), 4),
            max_val=round(float(np.max(ndvi_valid)), 4),
            std=round(float(np.std(ndvi_valid)), 4),
            pixel_count=int(ndvi_valid.size),
            cloud_fraction=max(0.0, cloud_fraction),
            ndre_mean=index_mean(ndre_c.values, -1.0, 1.0),
            ndmi_mean=index_mean(ndmi_c.values, -1.0, 1.0),
            evi_mean=index_mean(evi_c.values, -1.5, 1.5),
            savi_mean=index_mean(savi_c.values, -1.5, 1.5),
        )

        # GeoTIFF del NDVI composite (EPSG:4326) para el grid intra-parcela.
        # extract_pixel_samples lee band 1 + nodata y reproyecta si hace falta;
        # al ir en geográficas, lo toma tal cual.
        nodata = -9999.0
        # Recorte al polígono (paridad con filter_spatial de openEO): los píxeles
        # del bbox que caen FUERA del polígono salen como nodata. Sin esto, el
        # grid intra-parcela (lupa) promediaría NDVI de caminos/parcelas vecinas
        # en las celdas de borde — dato de fuera de la parcela. valid_mask ya es
        # poly_mask & isfinite (calculado arriba para los estadísticos).
        out = np.where(valid_mask, ndvi_arr, nodata).astype('float32')
        with MemoryFile() as mem:
            with mem.open(
                driver='GTiff', height=out.shape[0], width=out.shape[1], count=1,
                dtype='float32', crs='EPSG:4326', transform=gb.transform, nodata=nodata,
            ) as tif:
                tif.write(out, 1)
            ndvi_bytes = mem.read()

        logger.info(
            'mpc_processing_completed',
            ndvi=result.mean, ndre=result.ndre_mean, ndmi=result.ndmi_mean,
            evi=result.evi_mean, savi=result.savi_mean,
            min_val=result.min_val, max_val=result.max_val,
            pixels=result.pixel_count, scenes=len(items),
        )
        return result, ndvi_bytes
