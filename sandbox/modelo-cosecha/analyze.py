"""
SANDBOX · Modelo de cosecha · Paso 2-3: features por campaña + EDA visual.

Lee el CSV de la serie Sentinel (del Paso 1, ingest_sentinel.py) y deriva
features CANDIDATAS por campaña olivarera, más un gráfico de la curva plurianual.

Features por campaña (año natural): pico de NDVI y su día, integral (vigor
acumulado), amplitud, y la PENDIENTE DE NDRE en otoño (sep-nov) = proxy del
envero/maduración — la señal más prometedora para el momento de cosecha.

Honesto: son features CANDIDATAS. Se confirman/afinan cuando llegue el TARGET
del fondo (kg/campaña). Esto es caracterización del comportamiento, no validación.

Uso:
    python analyze.py --csv encineno_s2_series.csv
"""
import argparse

import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("Agg")  # sin display (servidor / SA97)
import matplotlib.pyplot as plt  # noqa: E402


def autumn_ndre_slope(g: pd.DataFrame) -> float:
    """Pendiente de NDRE en otoño (sep-nov), por día. Proxy del envero."""
    a = g[(g["month"] >= 9) & (g["month"] <= 11)].dropna(subset=["ndre"])
    if len(a) < 3:
        return np.nan
    x = (a["date"] - a["date"].min()).dt.days.to_numpy(dtype=float)
    y = a["ndre"].to_numpy(dtype=float)
    return float(np.polyfit(x, y, 1)[0])


def campaign_features(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for year, g in df.groupby("year"):
        g = g.sort_values("date")
        rows.append(
            {
                "campaign": int(year),
                "n_scenes": int(len(g)),
                "ndvi_max": round(float(g["ndvi"].max()), 4),
                "ndvi_min": round(float(g["ndvi"].min()), 4),
                "ndvi_mean": round(float(g["ndvi"].mean()), 4),
                "ndvi_peak_doy": int(g.loc[g["ndvi"].idxmax(), "date"].dayofyear),
                "ndvi_integral": round(float(g["ndvi"].sum()), 2),
                "ndvi_amplitude": round(float(g["ndvi"].max() - g["ndvi"].min()), 4),
                "ndre_autumn_slope": round(autumn_ndre_slope(g), 6),
            }
        )
    return pd.DataFrame(rows)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="encineno_s2_series.csv")
    ap.add_argument("--out_features", default="encineno_features.csv")
    ap.add_argument("--out_plot", default="encineno_serie.png")
    args = ap.parse_args()

    df = pd.read_csv(args.csv, parse_dates=["date"]).sort_values("date")
    df["year"] = df["date"].dt.year
    df["month"] = df["date"].dt.month

    feats = campaign_features(df)
    feats.to_csv(args.out_features, index=False)
    print("Features por campaña (candidatas · se validan con el target del fondo):\n")
    print(feats.to_string(index=False))

    fig, ax = plt.subplots(figsize=(12, 5))
    ax.plot(df["date"], df["ndvi"], "-o", ms=3, label="NDVI", color="#46632e")
    if df["ndre"].notna().any():
        ax.plot(df["date"], df["ndre"], "-o", ms=3, label="NDRE (clorofila)", color="#9b6dbf", alpha=0.75)
    ax.set_title("Encineño · serie Sentinel-2 · caracterización del comportamiento")
    ax.set_ylabel("índice")
    ax.grid(alpha=0.3)
    ax.legend()
    fig.tight_layout()
    fig.savefig(args.out_plot, dpi=110)
    print(f"\nGráfico → {args.out_plot}   ·   features → {args.out_features}")


if __name__ == "__main__":
    main()
