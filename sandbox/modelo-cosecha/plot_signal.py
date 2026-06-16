"""
SANDBOX · Modelo de cosecha · señal agua → vigor (evidencia real Encineño).

Visualiza la relación lluvia de primavera ↔ vigor acumulado (integral NDVI) por
campaña. Es la premisa del modelo de cosecha del olivar de secano: el agua manda.
Campañas completas (2023-25) en relleno; parciales (2022, 2026) huecas.

Honesto: n=3 campañas completas. Es señal, NO validación estadística.
"""
import argparse

import matplotlib
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--csv", default="encineno_features_multimodal.csv")
ap.add_argument("--out", default="encineno_senal_agua_vigor.png")
args = ap.parse_args()

df = pd.read_csv(args.csv).dropna(subset=["lluvia_primavera", "ndvi_integral"])
full = {2023, 2024, 2025}

fig, ax = plt.subplots(figsize=(9, 6))
for _, r in df.iterrows():
    y = int(r["campaña"])
    es_full = y in full
    ax.scatter(
        r["lluvia_primavera"], r["ndvi_integral"],
        s=260 if es_full else 160,
        color="#46632e" if es_full else "none",
        edgecolor="#46632e", linewidth=2.2,
        zorder=3,
    )
    ax.annotate(
        f" {y}" + ("" if es_full else " (parcial)"),
        (r["lluvia_primavera"], r["ndvi_integral"]),
        fontsize=11, va="center", color="#0F2A22",
        fontweight="bold" if es_full else "normal",
    )

# línea de tendencia solo con las 3 campañas completas (honesto)
f = df[df["campaña"].isin(full)].sort_values("lluvia_primavera")
ax.plot(f["lluvia_primavera"], f["ndvi_integral"], "--", color="#9b6dbf", lw=1.8, zorder=2)

ax.set_xlabel("Lluvia de primavera (mar–may), mm", fontsize=12)
ax.set_ylabel("Vigor acumulado de la campaña (integral NDVI)", fontsize=12)
ax.set_title("Encineño · el agua de primavera manda el vigor\nseñal real · n=3 campañas completas (no es validación)", fontsize=13)
ax.grid(alpha=0.3)
fig.tight_layout()
fig.savefig(args.out, dpi=120)
print(f"→ {args.out}")
