"""
SANDBOX · Modelo de cosecha · DRON · Esquema del censo por árbol.

Espejo HONESTO del patrón que YA existe en producción para LA LUPA
(intra-parcela): geo-pipeline `build_grid_snapshot()` → colección
`ndvi_snapshots` → modelo Mongoose `NdviSnapshot` → `ndviSnapshotService`
→ ruta GET /ndvi-snapshot → heatmap.

El censo de dron es el MISMO patrón, una resolución más fina:
    LA LUPA:  parcela → celdas (zonal mean de píxeles Sentinel)
    CENSO:    parcela → ÁRBOLES (un punto = una copa detectada)

Por eso esto NO se inventa de cero: se clona la tubería probada cambiando
"celda" por "árbol". Aquí definimos solo el CONTRATO de datos (el documento
que viajaría a Mongo). NO hay vuelo real; este finde se valida el esquema
y la ingesta con un ejemplo sintético (ver build_example.py).

Una fila/punto por árbol:
    tree_id      identificador estable dentro de la parcela (índice del centroide)
    lat, lng     centroide de la copa (WGS84) — igual unidad que INdviPoint
    crown_area   área de copa proyectada en m² (proxy de tamaño/vigor estructural)
    crown_ndvi   NDVI medio de los píxeles dron DENTRO de la máscara de copa
    load_index   índice de carga 0..1 (proxy de fruto) — ver nota de honestidad
    confidence   confianza de la detección/segmentación 0..1

Honestidad (CRITICAL_no_inventar):
  - `load_index` NO es kg. Es un PROXY relativo de carga (color/textura del
    fruto sobre la copa, o densidad de blobs de fruto). Se reporta como
    índice 0..1, NUNCA como rendimiento absoluto, hasta que el TARGET del
    fondo (kg/campaña) calibre la relación (Paso 4 del README padre).
  - En jun-2026 (fruto verde) `load_index` mide carga estructural/fruto verde.
    La señal de fruto MADURO/color llega en envero (sep-nov). La FLOR es 2027.
  - Oclusión del olivo: una copa densa esconde fruto interior. El dron ve la
    SUPERFICIE de la copa, no el interior. Por eso `load_index` es un proxy
    de superficie iluminada, y por eso el Bloque B (validación de campo)
    NO promete contar el fruto exacto, sino correlacionar el proxy con el
    conteo manual y reportar el error.
"""
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Optional


@dataclass
class TreePoint:
    """Un árbol detectado. Espejo de INdviPoint, con campos de copa/fruto."""
    tree_id: int
    lat: float
    lng: float
    crown_area_m2: float
    crown_ndvi: float
    load_index: float          # 0..1, proxy de carga — NO kg
    confidence: float          # 0..1

    def to_doc(self) -> dict:
        return {
            "treeId": self.tree_id,
            "lat": round(self.lat, 7),
            "lng": round(self.lng, 7),
            "crownAreaM2": round(self.crown_area_m2, 2),
            "crownNdvi": round(self.crown_ndvi, 4),
            "loadIndex": round(self.load_index, 4),
            "confidence": round(self.confidence, 3),
        }


@dataclass
class TreeCensus:
    """
    Documento de censo por parcela y vuelo. Hermano de `ndvi_snapshots`,
    pensado para una colección `tree_census` y un modelo Mongoose
    `TreeCensus` calcado de `NdviSnapshot`.
    """
    parcel_id: str
    flight_date: datetime
    sensor: str                # "mavic3e_rgb" | "mavic3m_multispec"
    gsd_cm: float              # ground sample distance real del vuelo
    trees: list[TreePoint]
    bbox: list[float]          # [west, south, east, north] — igual que NdviSnapshot
    model_version: str         # versión del modelo CV (trazabilidad)

    # ── Agregados a nivel parcela (lo que consumen los motores) ──
    # Se derivan de `trees`; se persisten para no recalcular en cada lectura.
    def parcel_aggregates(self) -> dict:
        n = len(self.trees)
        if n == 0:
            return {"treeCount": 0}
        loads = [t.load_index for t in self.trees]
        crowns = [t.crown_area_m2 for t in self.trees]
        ndvis = [t.crown_ndvi for t in self.trees]
        loads_sorted = sorted(loads)
        # cuartil bajo de carga = % de árboles flojos (lo accionable para el agricultor)
        q25_idx = max(0, int(0.25 * (n - 1)))
        low_load_threshold = loads_sorted[q25_idx]
        pct_low_load = sum(1 for x in loads if x <= low_load_threshold) / n
        return {
            "treeCount": n,
            "loadIndexMean": round(sum(loads) / n, 4),
            "loadIndexP25": round(low_load_threshold, 4),
            "pctLowLoadTrees": round(pct_low_load, 3),
            "crownAreaMeanM2": round(sum(crowns) / n, 2),
            "crownNdviMean": round(sum(ndvis) / n, 4),
            "treesPerHa": None,  # lo rellena quien conoce el área de la parcela
        }

    def to_doc(self) -> dict:
        """Documento listo para db.tree_census.insert_one()."""
        return {
            "parcelId": self.parcel_id,
            "flightDate": self.flight_date,
            "sensor": self.sensor,
            "gsdCm": self.gsd_cm,
            "modelVersion": self.model_version,
            "trees": [t.to_doc() for t in self.trees],
            "aggregates": self.parcel_aggregates(),
            "bbox": [round(b, 7) for b in self.bbox],
            "treeCount": len(self.trees),
            "createdAt": datetime.now(timezone.utc),
        }
