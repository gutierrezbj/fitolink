"""
SANDBOX · Modelo de cosecha · DRON · Ejemplo de ingesta SIN VUELO REAL.

Qué hace este finde (honesto):
  - NO hay vuelo. NO hay ortomosaico. NO hay modelo CV entrenado.
  - SÍ deja la tubería de ingesta lista y la prueba de extremo a extremo
    con un censo SINTÉTICO sobre el polígono REAL de Encineño:
        polígono real → malla de árboles plausible (marco ~8x6 m de olivar)
        → cada árbol recibe crown_ndvi/crown_area/load_index sintéticos
        → TreeCensus.to_doc()  (el documento que iría a Mongo)
        → aggregates de parcela (lo que consumen los motores)
        → escribe tree_census_example.json + una fila de feature parcela.

  Cuando llegue el vuelo real, SOLO se sustituye `synthesize_trees()` por la
  salida del modelo CV sobre el ortomosaico. El resto de la tubería (doc,
  aggregates, persistencia) NO cambia: ese es el objetivo del andamiaje.

Uso:
    python build_example.py
"""
import json
import math
import random
from datetime import datetime, timezone
from pathlib import Path

from tree_census_schema import TreeCensus, TreePoint

HERE = Path(__file__).resolve().parent
GEOJSON = HERE.parent / "encineno.geojson"
ROW_SPACING_M = 8.0      # marco real típico de olivar de secano (8 x 6 m)
COL_SPACING_M = 6.0
SEED = 42


def load_polygon(path: Path):
    from shapely.geometry import shape
    gj = json.loads(path.read_text())
    geom = gj.get("geometry", gj)
    return shape(geom)


def synthesize_trees(polygon, rng: random.Random) -> list[TreePoint]:
    """
    PLACEHOLDER del modelo CV. Coloca árboles en un marco regular dentro del
    polígono y les asigna atributos sintéticos plausibles. Esto se BORRA y se
    reemplaza por la detección real (centroides de copa) cuando haya vuelo.
    """
    minx, miny, maxx, maxy = polygon.bounds
    # metros → grados (aprox, latitud media de Córdoba ~37.8º)
    lat_mid = (miny + maxy) / 2.0
    m_per_deg_lat = 111_320.0
    m_per_deg_lng = 111_320.0 * math.cos(math.radians(lat_mid))
    d_lat = ROW_SPACING_M / m_per_deg_lat
    d_lng = COL_SPACING_M / m_per_deg_lng

    from shapely.geometry import Point
    trees: list[TreePoint] = []
    tree_id = 0
    lat = miny
    while lat <= maxy:
        lng = minx
        while lng <= maxx:
            # jitter ±1 m para no parecer una rejilla perfecta de CAD
            jlat = lat + rng.uniform(-1, 1) / m_per_deg_lat
            jlng = lng + rng.uniform(-1, 1) / m_per_deg_lng
            if polygon.contains(Point(jlng, jlat)):
                # atributos sintéticos: vigor base + gradiente espacial + ruido
                grad = (jlat - miny) / max(1e-9, (maxy - miny))  # 0..1 norte-sur
                crown_ndvi = max(0.15, min(0.75, 0.40 + 0.15 * grad + rng.gauss(0, 0.05)))
                crown_area = max(2.0, 12.0 + 8.0 * grad + rng.gauss(0, 2.0))
                # load_index correlado con vigor estructural + ruido (proxy, NO kg)
                load_index = max(0.0, min(1.0, 0.35 + 0.45 * grad + rng.gauss(0, 0.08)))
                confidence = round(rng.uniform(0.82, 0.99), 3)
                trees.append(TreePoint(
                    tree_id=tree_id, lat=jlat, lng=jlng,
                    crown_area_m2=crown_area, crown_ndvi=crown_ndvi,
                    load_index=load_index, confidence=confidence,
                ))
                tree_id += 1
            lng += d_lng
        lat += d_lat
    return trees


def main() -> None:
    rng = random.Random(SEED)
    polygon = load_polygon(GEOJSON)

    # área de la parcela en ha (para treesPerHa)
    from shapely.ops import transform
    import pyproj
    project = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:25830", always_xy=True).transform
    area_ha = transform(project, polygon).area / 10_000.0

    trees = synthesize_trees(polygon, rng)
    minx, miny, maxx, maxy = polygon.bounds

    census = TreeCensus(
        parcel_id="000000000000000000encineno",  # placeholder ObjectId-like
        flight_date=datetime(2026, 6, 13, tzinfo=timezone.utc),
        sensor="mavic3e_rgb",
        gsd_cm=1.5,                 # objetivo a ~75 m de altura (ver Bloque A)
        trees=trees,
        bbox=[minx, miny, maxx, maxy],
        model_version="synthetic-placeholder-0.0",
    )

    doc = census.to_doc()
    doc["aggregates"]["treesPerHa"] = round(len(trees) / area_ha, 1) if area_ha else None

    out_doc = HERE / "tree_census_example.json"
    out_doc.write_text(json.dumps(doc, indent=2, default=str))

    agg = doc["aggregates"]
    print(f"Parcela Encineño · área ≈ {area_ha:.1f} ha")
    print(f"Árboles (sintéticos): {agg['treeCount']}  ·  {agg['treesPerHa']} árb/ha")
    print(f"loadIndex medio: {agg['loadIndexMean']}  ·  P25: {agg['loadIndexP25']}")
    print(f"% árboles de carga baja (cuartil): {agg['pctLowLoadTrees']*100:.0f}%")
    print(f"crownNdvi medio: {agg['crownNdviMean']}  ·  copa media: {agg['crownAreaMeanM2']} m²")
    print(f"\n→ documento de censo: {out_doc.name}")
    print("   (este es el JSON que iría a la colección tree_census, calcada de ndvi_snapshots)")

    # Fila de feature a nivel parcela — lo que se enchufa al modelo de cosecha
    # (Paso 4) y a predictiveInsightService como capa extra.
    feature_row = {
        "parcel": "encineno",
        "flightDate": "2026-06-13",
        "treeCount": agg["treeCount"],
        "treesPerHa": agg["treesPerHa"],
        "loadIndexMean": agg["loadIndexMean"],
        "pctLowLoadTrees": agg["pctLowLoadTrees"],
        "crownNdviMean": agg["crownNdviMean"],
        "crownAreaMeanM2": agg["crownAreaMeanM2"],
    }
    out_feat = HERE / "tree_census_parcel_feature.json"
    out_feat.write_text(json.dumps(feature_row, indent=2))
    print(f"→ feature de parcela: {out_feat.name}  (entra al modelo de cosecha · Paso 4)")


if __name__ == "__main__":
    main()
