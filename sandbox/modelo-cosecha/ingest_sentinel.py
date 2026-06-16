"""
SANDBOX · Modelo predictivo de cosecha · Paso 1: ingesta Sentinel-2 histórico.

Baja la SERIE TEMPORAL de NDVI/NDRE de una parcela (Encineño) vía Microsoft
Planetary Computer — a 10 m, recortada al polígono real, con máscara de nubes.
Salida: un CSV con una fila por escena (fecha, ndvi, ndre, ndmi, píxeles válidos).

POR QUÉ 10 m y no MODIS 250 m (decisión cuaderno 13-jun): el modelo de cosecha
necesita leer la COPA del olivo. En secano disperso, 250 m diluye el árbol en el
suelo desnudo → no capta la señal. 10 m sí la capta. La resolución la manda la
FACTIBILIDAD, no el coste.

Vía MPC (no openEO) para esquivar la cuota de procesamiento de CDSE: aquí el
cómputo lo hacemos nosotros sobre los COG firmados, sin límite de créditos.

Uso:
    pip install -r requirements.txt
    python ingest_sentinel.py --years 4 --cloud 40 --out encineno_s2_series.csv

Es el punto de partida del sandbox. NO ejecutado aún — se itera en local (Mac
mini). Si algo peta, suele ser versión de odc-stac / rioxarray; ajustar y seguir.
"""
import argparse
import json
from datetime import datetime, timedelta, timezone

import pandas as pd
import planetary_computer
import pystac_client
import xarray as xr
from odc.stac import load as odc_load
from rasterio.features import geometry_mask
from rasterio.warp import transform_geom
from shapely.geometry import shape

MPC_STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION = "sentinel-2-l2a"
# Clases SCL a descartar: nodata, saturado, sombra, nube media/alta, cirro, nieve.
SCL_DISCARD = {0, 1, 3, 8, 9, 10, 11}


def load_geometry(path: str) -> dict:
    with open(path) as f:
        gj = json.load(f)
    return gj.get("geometry", gj)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--geojson", default="encineno.geojson")
    ap.add_argument("--years", type=int, default=4, help="años hacia atrás (el target del fondo marcará el definitivo)")
    ap.add_argument("--cloud", type=float, default=40.0, help="máx cloud_cover %% de escena")
    ap.add_argument("--out", default="encineno_s2_series.csv")
    args = ap.parse_args()

    geom = load_geometry(args.geojson)
    poly = shape(geom)
    minx, miny, maxx, maxy = poly.bounds

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=int(365.25 * args.years))
    dt_range = f"{start:%Y-%m-%d}/{end:%Y-%m-%d}"

    catalog = pystac_client.Client.open(MPC_STAC, modifier=planetary_computer.sign_inplace)
    items = list(
        catalog.search(
            collections=[COLLECTION],
            bbox=[minx, miny, maxx, maxy],
            datetime=dt_range,
            query={"eo:cloud_cover": {"lt": args.cloud}},
        ).items()
    )
    print(f"{len(items)} escenas Sentinel-2 ({dt_range}, nubes <{args.cloud}%)")
    if not items:
        print("Sin escenas. Sube --cloud o amplía --years.")
        return

    # Cargar a 10 m, recortado al bbox, agrupado por día solar.
    ds = odc_load(
        items,
        bands=["B04", "B08", "B05", "B11", "SCL"],
        bbox=[minx, miny, maxx, maxy],
        resolution=10,
        groupby="solar_day",
        chunks={},
    )

    # Máscara del polígono REAL sobre la grilla cargada — reproyectada al CRS
    # del ráster (Sentinel viene en UTM/metros; el geojson, en grados WGS84).
    gb = ds.odc.geobox
    epsg = gb.crs.to_epsg()
    dst_crs = f"EPSG:{epsg}" if epsg else gb.crs.to_wkt()
    geom_utm = transform_geom("EPSG:4326", dst_crs, geom)
    poly_mask = geometry_mask(
        [geom_utm], out_shape=gb.shape, transform=gb.transform, invert=True
    )

    scl = ds["SCL"]
    valid = (~scl.isin(list(SCL_DISCARD))) & poly_mask  # nubes fuera + dentro del polígono

    red, nir, re, swir = ds["B04"], ds["B08"], ds["B05"], ds["B11"]
    ndvi = ((nir - red) / (nir + red)).where(valid)
    ndre = ((nir - re) / (nir + re)).where(valid)
    ndmi = ((nir - swir) / (nir + swir)).where(valid)

    # Serie temporal: media espacial sobre píxeles válidos, en UNA pasada dask
    # (cada banda se lee una vez · evita los miles de .compute() por escena).
    series = xr.Dataset(
        {
            "ndvi": ndvi.mean(dim=("y", "x")),
            "ndre": ndre.mean(dim=("y", "x")),
            "ndmi": ndmi.mean(dim=("y", "x")),
            "valid_px": valid.sum(dim=("y", "x")),
        }
    ).compute()

    rows = []
    for t in series.time.values:
        npx = int(series["valid_px"].sel(time=t))
        if npx < 10:  # escena casi toda nublada sobre la finca → saltar
            continue
        rows.append(
            {
                "date": pd.Timestamp(t).strftime("%Y-%m-%d"),
                "ndvi": round(float(series["ndvi"].sel(time=t)), 4),
                "ndre": round(float(series["ndre"].sel(time=t)), 4),
                "ndmi": round(float(series["ndmi"].sel(time=t)), 4),
                "valid_px": npx,
            }
        )

    df = pd.DataFrame(rows).dropna().sort_values("date").reset_index(drop=True)
    df.to_csv(args.out, index=False)
    print(f"\n✅ Serie guardada: {args.out} · {len(df)} fechas válidas")
    print(df.tail(12).to_string(index=False))


if __name__ == "__main__":
    main()
