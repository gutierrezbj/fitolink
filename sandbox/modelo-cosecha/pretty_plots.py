"""Versiones BONITAS (marca AgroM) de los gráficos de DATOS REALES — para demo/deck.
No toca los modelos: solo re-renderiza, con estilo, lo que ya está en los CSV.
"""
import agrom_style as A

A.apply()

import pandas as pd  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402


def eyebrow(ax, text):
    """Etiqueta editorial tipo eyebrow sobre el eje."""
    ax.text(0, 1.06, text, transform=ax.transAxes, color=A.MUTED,
            fontsize=8.5, fontweight="bold", letterspacing=2 if False else None)


# ── 1) Serie de 4 años (el comportamiento de la finca) ──
s = pd.read_csv("encineno_s2_series.csv", parse_dates=["date"]).sort_values("date")
fig, ax = plt.subplots(figsize=(12, 4.8))
ax.fill_between(s["date"], s["ndvi"], color=A.DEEP, alpha=0.07, zorder=1)
ax.plot(s["date"], s["ndvi"], "-", lw=1.7, color=A.DEEP, label="Vigor (NDVI)", zorder=3)
ax.plot(s["date"], s["ndre"], "-", lw=1.3, color=A.PURPLE, alpha=0.9, label="Clorofila (NDRE)", zorder=2)
ax.set_title("ENCINEÑO · CUATRO AÑOS DE COMPORTAMIENTO · SENTINEL-2", loc="left")
ax.set_ylabel("índice de vegetación")
ax.legend(loc="upper left", ncol=2)
ax.margins(x=0.01)
ax.set_ylim(0, None)
fig.tight_layout()
fig.savefig("pretty_serie.png")
print("→ pretty_serie.png")

# ── 2) Agua → vigor (la señal real) ──
f = pd.read_csv("encineno_features_multimodal.csv").dropna(subset=["lluvia_primavera", "ndvi_integral"])
full = {2023, 2024, 2025}
fig, ax = plt.subplots(figsize=(8.6, 5.6))
ft = f[f["campaña"].isin(full)].sort_values("lluvia_primavera")
ax.plot(ft["lluvia_primavera"], ft["ndvi_integral"], "--", color=A.TERRA, lw=1.6, zorder=2)
for _, r in f.iterrows():
    yr = int(r["campaña"]); es = yr in full
    ax.scatter(r["lluvia_primavera"], r["ndvi_integral"], s=300 if es else 170,
               color=A.DEEP if es else "none", edgecolor=A.DEEP, linewidth=2.2, zorder=4)
    ax.annotate(f"{yr}" + ("" if es else " ·parcial"), (r["lluvia_primavera"], r["ndvi_integral"]),
                xytext=(11, 0), textcoords="offset points",
                color=A.INK, fontsize=10.5, va="center", fontweight="bold" if es else "normal")
ax.set_title("EL AGUA DE PRIMAVERA MANDA EL VIGOR · ENCINEÑO", loc="left")
ax.set_xlabel("lluvia de primavera (mar–may), mm")
ax.set_ylabel("vigor acumulado de la campaña")
ax.margins(x=0.16, y=0.12)
fig.tight_layout()
fig.savefig("pretty_agua_vigor.png")
print("→ pretty_agua_vigor.png")

# ── 3) Envero de otoño (la señal del CUÁNDO) ──
s["year"] = s["date"].dt.year
s["doy"] = s["date"].dt.dayofyear
autumn = s[(s["date"].dt.month >= 9) & (s["date"].dt.month <= 12)]
fig, ax = plt.subplots(figsize=(9.5, 5.2))
cycle = [A.SAND, A.PURPLE, A.DEEP, A.TERRA, A.SLATE]
for k, (yr, g) in enumerate(autumn.groupby("year")):
    if len(g) >= 3:
        g = g.sort_values("doy")
        ax.plot(g["doy"], g["ndre"], "-o", ms=3.5, lw=1.6, color=cycle[k % len(cycle)], label=str(yr))
ax.set_title("MADURACIÓN DE OTOÑO (NDRE) · LA SEÑAL DEL «CUÁNDO»", loc="left")
ax.set_xlabel("día del año (otoño: sep a dic)")
ax.set_ylabel("NDRE (envero / maduración)")
ax.legend(title="campaña", loc="upper left", ncol=2)
fig.tight_layout()
fig.savefig("pretty_envero.png")
print("→ pretty_envero.png")
