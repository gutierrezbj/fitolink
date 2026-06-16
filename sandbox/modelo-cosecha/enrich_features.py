"""
SANDBOX · Modelo de cosecha · Paso 2-bis: FEATURES MULTIMODALES por campaña.

La fenología del satélite (NDVI/NDRE/NDMI) sola NO predice la cosecha del olivar
de secano: el rendimiento lo mandan el AGUA y el CALOR en ventanas clave. Esta
pieza enriquece la serie Sentinel real (del Paso 1) con dos capas más, a nivel
de campaña, organizadas por la FENOLOGÍA del olivo:

  · Térmica   — GDD (grados-día, base 10 ºC) acumulados, días de calor (Tmáx>35).
  · Agua      — lluvia anual + de primavera (floración/cuajado) + de verano.
  · Fenología — vigor de floración (NDVI abr-may), profundidad del estrés hídrico
                de verano (NDMI mín jul-ago), dinámica de envero (NDRE sep-nov).

Meteo histórica: Open-Meteo Archive API (ERA5, GRATIS, sin clave). Centroide de
la parcela real de Encineño.

Honesto: son features CANDIDATAS, agronómicamente motivadas. Se VALIDAN cuando
llegue el TARGET del fondo (kg/campaña). Esto es el diseño del espacio de
entrada del modelo, aterrizado sobre datos reales.

Uso:
    python enrich_features.py --csv encineno_s2_series.csv
"""
import argparse
import json

import pandas as pd
import requests
from shapely.geometry import shape

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
GDD_BASE = 10.0       # ºC, base para grados-día del olivo (parámetro, ajustable)
HEAT_THRESHOLD = 35.0  # ºC, Tmáx que estresa floración/cuajado


def centroid_lonlat(geojson_path: str) -> tuple[float, float]:
    with open(geojson_path) as f:
        gj = json.load(f)
    geom = gj.get("geometry", gj)
    c = shape(geom).centroid
    return round(c.x, 4), round(c.y, 4)


def fetch_weather(lon: float, lat: float, start: str, end: str) -> pd.DataFrame:
    """Serie diaria ERA5 (Tmáx, Tmín, lluvia) vía Open-Meteo Archive."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start,
        "end_date": end,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "auto",
    }
    r = requests.get(ARCHIVE_URL, params=params, timeout=60)
    r.raise_for_status()
    d = r.json()["daily"]
    df = pd.DataFrame(
        {
            "date": pd.to_datetime(d["time"]),
            "tmax": d["temperature_2m_max"],
            "tmin": d["temperature_2m_min"],
            "precip": d["precipitation_sum"],
        }
    )
    df["tmean"] = (df["tmax"] + df["tmin"]) / 2.0
    df["gdd"] = (df["tmean"] - GDD_BASE).clip(lower=0)
    df["year"] = df["date"].dt.year
    df["month"] = df["date"].dt.month
    return df


def sat_window_features(g: pd.DataFrame) -> dict:
    """Features fenológicas del olivo desde la serie Sentinel de una campaña."""
    spring = g[(g["month"] >= 4) & (g["month"] <= 5)]   # floración
    summer = g[(g["month"] >= 7) & (g["month"] <= 8)]   # estrés hídrico máximo
    autumn = g[(g["month"] >= 9) & (g["month"] <= 11)]  # envero / maduración
    return {
        "flor_ndvi": round(float(spring["ndvi"].mean()), 4) if len(spring) else None,
        "verano_ndmi_min": round(float(summer["ndmi"].min()), 4) if len(summer) else None,
        "envero_ndre": round(float(autumn["ndre"].mean()), 4) if len(autumn) else None,
        "ndvi_pico": round(float(g["ndvi"].max()), 4),
        "ndvi_integral": round(float(g["ndvi"].sum()), 2),
    }


def weather_window_features(w: pd.DataFrame) -> dict:
    """Features térmicas y de agua por campaña, en ventanas del olivo."""
    spring = w[(w["month"] >= 3) & (w["month"] <= 5)]   # lluvia floración/cuajado
    summer = w[(w["month"] >= 6) & (w["month"] <= 8)]
    return {
        "gdd_total": round(float(w["gdd"].sum()), 0),
        "gdd_a_floracion": round(float(w[w["month"] <= 5]["gdd"].sum()), 0),
        "dias_calor35": int((w["tmax"] > HEAT_THRESHOLD).sum()),
        "lluvia_anual": round(float(w["precip"].sum()), 1),
        "lluvia_primavera": round(float(spring["precip"].sum()), 1),
        "lluvia_verano": round(float(summer["precip"].sum()), 1),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="encineno_s2_series.csv")
    ap.add_argument("--geojson", default="encineno.geojson")
    ap.add_argument("--out", default="encineno_features_multimodal.csv")
    args = ap.parse_args()

    sat = pd.read_csv(args.csv, parse_dates=["date"]).sort_values("date")
    sat["year"] = sat["date"].dt.year
    sat["month"] = sat["date"].dt.month

    lon, lat = centroid_lonlat(args.geojson)
    start = f"{int(sat['year'].min())}-01-01"
    end = sat["date"].max().strftime("%Y-%m-%d")
    print(f"Centroide Encineño: lon {lon}, lat {lat}  ·  meteo {start} → {end}")
    wx = fetch_weather(lon, lat, start, end)
    print(f"Meteo ERA5: {len(wx)} días\n")

    rows = []
    for year, g in sat.groupby("year"):
        w = wx[wx["year"] == year]
        if w.empty:
            continue
        row = {"campaña": int(year), "n_escenas": int(len(g))}
        row.update(sat_window_features(g))
        row.update(weather_window_features(w))
        rows.append(row)

    feats = pd.DataFrame(rows)
    feats.to_csv(args.out, index=False)
    print("FEATURES MULTIMODALES por campaña (satélite + térmica + agua):")
    print("(candidatas · se validan con el kg/campaña del fondo)\n")
    print(feats.to_string(index=False))
    print(f"\n→ {args.out}")


if __name__ == "__main__":
    main()
