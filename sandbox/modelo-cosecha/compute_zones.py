"""
SANDBOX · Zonas de manejo de Encineño (la lupa → sectores).

Compuesto temporal ROBUSTO: mediana por píxel de MUCHAS escenas Sentinel-2 (vía
MPC) → el patrón de vigor ESTABLE de la finca (no una foto suelta, que sería
ruido de un día). Luego rejilla (binning O(n)) → KMeans en N zonas de manejo,
ordenadas por vigor. Cero invento: celda sin píxeles reales NO aparece.

Salida: encineno_zones.json (celdas + zonas con área).
Uso: .venv/bin/python compute_zones.py --months 12 --cloud 35 --resolution 28 --zones 3
"""
import argparse
import json
from datetime import datetime, timedelta, timezone

import numpy as np
import planetary_computer
import pystac_client
from odc.stac import load as odc_load
from pyproj import Transformer
from rasterio.features import geometry_mask
from rasterio.warp import transform_geom
from shapely.geometry import Point, shape
from sklearn.cluster import KMeans

MPC_STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION = "sentinel-2-l2a"
SCL_DISCARD = {0, 1, 3, 8, 9, 10, 11}  # nodata, saturado, sombra, nubes, cirro, nieve


def zonal_grid(samples, geometry, resolution):
    """Binning O(n) — misma lógica que workers/geo-pipeline ndvi_grid.zonal_grid."""
    if len(samples) < 4:
        return []
    polygon = shape(geometry)
    coords = geometry["coordinates"][0]
    min_lng, max_lng = min(c[0] for c in coords), max(c[0] for c in coords)
    min_lat, max_lat = min(c[1] for c in coords), max(c[1] for c in coords)
    lng_span, lat_span = max_lng - min_lng, max_lat - min_lat
    if lng_span <= 0 or lat_span <= 0:
        return []
    lats = np.array([s[0] for s in samples])
    lngs = np.array([s[1] for s in samples])
    nd = np.array([s[2] for s in samples])
    col = np.clip(((lngs - min_lng) / lng_span * resolution).astype(int), 0, resolution - 1)
    row = np.clip(((lats - min_lat) / lat_span * resolution).astype(int), 0, resolution - 1)
    cid = row * resolution + col
    n = resolution * resolution
    sums = np.bincount(cid, weights=nd, minlength=n)
    cnt = np.bincount(cid, minlength=n)
    cell_lng = min_lng + (np.arange(resolution) + 0.5) / resolution * lng_span
    cell_lat = min_lat + (np.arange(resolution) + 0.5) / resolution * lat_span
    out = []
    for idx in range(n):
        if cnt[idx] == 0:
            continue
        r, c = idx // resolution, idx % resolution
        lat, lng = float(cell_lat[r]), float(cell_lng[c])
        if not polygon.contains(Point(lng, lat)):
            continue
        out.append({"lat": round(lat, 6), "lng": round(lng, 6), "ndvi": round(float(sums[idx] / cnt[idx]), 4)})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--geojson", default="encineno.geojson")
    ap.add_argument("--months", type=int, default=12)
    ap.add_argument("--cloud", type=float, default=35.0)
    ap.add_argument("--resolution", type=int, default=28)
    ap.add_argument("--zones", type=int, default=3)
    ap.add_argument("--area-ha", type=float, default=407.7)
    ap.add_argument("--out", default="encineno_zones.json")
    args = ap.parse_args()

    with open(args.geojson) as f:
        gj = json.load(f)
    geom = gj.get("geometry", gj)
    poly = shape(geom)
    minx, miny, maxx, maxy = poly.bounds

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=int(30.4 * args.months))
    dtr = f"{start:%Y-%m-%d}/{end:%Y-%m-%d}"

    cat = pystac_client.Client.open(MPC_STAC, modifier=planetary_computer.sign_inplace)
    # Búsqueda SIN filtro server-side (el query eo:cloud_cover cuelga el STAC de
    # MPC) → filtramos nubes en local. Con reintentos: el search de MPC da
    # timeouts por-petición de forma transitoria.
    import time as _t
    all_items = None
    n_try = 30
    for attempt in range(n_try):
        try:
            all_items = list(cat.search(
                collections=[COLLECTION], bbox=[minx, miny, maxx, maxy], datetime=dtr,
                max_items=80, limit=40,
            ).items())
            break
        except Exception as e:
            if attempt == n_try - 1:
                print(f"MPC STAC sigue con timeout tras {n_try} intentos ({type(e).__name__}). Es de su lado; reintentar más tarde.")
                return
            wait = min(30, 6 * (attempt + 1))
            print(f"  MPC search timeout — reintento {attempt + 1}/{n_try} en {wait}s…", flush=True)
            _t.sleep(wait)
    items = [it for it in all_items if (it.properties.get("eo:cloud_cover") or 100) < args.cloud]
    print(f"{len(items)}/{len(all_items)} escenas con nubes <{args.cloud}% ({dtr})")
    if len(items) < 3:
        print("Pocas escenas — sube --cloud o --months.")
        return

    ds = odc_load(items, bands=["B04", "B08", "SCL"], bbox=[minx, miny, maxx, maxy],
                  resolution=10, groupby="solar_day", chunks={})
    gb = ds.odc.geobox
    epsg = gb.crs.to_epsg()
    dst_crs = f"EPSG:{epsg}" if epsg else gb.crs.to_wkt()
    geom_utm = transform_geom("EPSG:4326", dst_crs, geom)
    pmask = geometry_mask([geom_utm], out_shape=gb.shape, transform=gb.transform, invert=True)

    valid = (~ds["SCL"].isin(list(SCL_DISCARD))) & pmask
    red, nir = ds["B04"], ds["B08"]
    ndvi = ((nir - red) / (nir + red)).where(valid)

    # COMPUESTO ROBUSTO: mediana por píxel sobre todas las escenas válidas.
    comp = ndvi.median(dim="time", skipna=True).compute()

    xs, ys = comp.x.values, comp.y.values
    arr = comp.values  # (y, x)
    rr, cc = np.where(np.isfinite(arr))
    if len(rr) == 0:
        print("Sin píxeles válidos.")
        return
    tr = Transformer.from_crs(dst_crs, "EPSG:4326", always_xy=True)
    lng, lat = tr.transform(xs[cc], ys[rr])
    vals = arr[rr, cc]
    samples = list(zip(lat.tolist(), lng.tolist(), vals.tolist()))
    print(f"{len(samples)} píxeles válidos en el compuesto (≈{len(samples) / 100:.0f} ha a 10 m)")

    cells = zonal_grid(samples, geom, args.resolution)
    print(f"{len(cells)} celdas en la rejilla {args.resolution}×{args.resolution}")
    if len(cells) < args.zones:
        print("Pocas celdas para clusterizar.")
        return

    cv = np.array([c["ndvi"] for c in cells]).reshape(-1, 1)
    km = KMeans(n_clusters=args.zones, n_init=10, random_state=0).fit(cv)
    order = np.argsort(km.cluster_centers_.ravel())  # 0 = menor vigor
    remap = {old: new for new, old in enumerate(order)}
    labels = [remap[int(l)] for l in km.labels_]
    names = ({0: "Vigor bajo", 1: "Vigor medio", 2: "Vigor alto"}
             if args.zones == 3 else {i: f"Zona {i + 1}" for i in range(args.zones)})
    for c, l in zip(cells, labels):
        c["zone"] = int(l)

    total = len(cells)
    zones = []
    for z in range(args.zones):
        zc = [c for c, l in zip(cells, labels) if l == z]
        if not zc:
            continue
        zones.append({
            "id": z, "label": names.get(z, f"Zona {z + 1}"),
            "cells": len(zc), "areaPct": round(100 * len(zc) / total, 1),
            "areaHa": round(args.area_ha * len(zc) / total, 1),
            "meanNdvi": round(float(np.mean([c["ndvi"] for c in zc])), 4),
        })

    out = {
        "crop": "olivo", "dateRange": dtr, "scenes": len(items), "resolution": args.resolution,
        "bbox": [round(minx, 6), round(miny, 6), round(maxx, 6), round(maxy, 6)],
        "pixelCount": len(samples), "cells": cells, "zones": zones,
    }
    with open(args.out, "w") as f:
        json.dump(out, f)
    print(f"\n✅ {args.out} · {len(cells)} celdas · {args.zones} zonas (mediana de {len(items)} escenas):")
    for z in zones:
        print(f"  {z['label']:12s} · NDVI {z['meanNdvi']:.3f} · {z['areaHa']:6.1f} ha ({z['areaPct']:.0f}%)")


if __name__ == "__main__":
    main()
