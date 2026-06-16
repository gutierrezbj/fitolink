"""
SANDBOX · Modelo de cosecha · EL CUÁNDO — predicción de la FECHA ÓPTIMA de recogida.

Es el dolor nº1 del fondo (Guillermo: cosechar a tiempo vs tarde = 20-25% del
valor). A diferencia del "cuánto kilos", el "cuándo" se apoya en señales que YA
medimos: la MADURACIÓN (envero, vía caída de NDRE en otoño) + el CALOR acumulado
(GDD). Por eso es, probablemente, el más alcanzable — y el que abre la puerta.

Dos partes:
  A) MOTOR — valida la maquinaria con datos SINTÉTICOS de reglas conocidas:
     mira el estado a primeros de octubre (GDD acumulado + velocidad de envero)
     y predice el DÍA ÓPTIMO de cosecha. Backtesting leave-one-year-out.
  B) SEÑAL REAL — la trayectoria de envero (NDRE otoño) de Encineño, 4 años:
     lo que el modelo leería. Honesto: para predecir la fecha REAL hace falta el
     ground-truth del fondo (fechas históricas de cosecha + índice de madurez /
     contenido graso). Aquí mostramos la señal y validamos el motor, no el dato.

Uso:
    python timing_model.py
"""
import argparse

import matplotlib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import LeaveOneGroupOut

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

RNG = np.random.default_rng(7)
FEATURES = ["gdd_a_oct", "ndre_nivel_oct", "ndre_pendiente_otono", "variedad_offset"]
TARGET = "doy_optimo"


def doy_a_fecha(doy: float) -> str:
    base = pd.Timestamp("2025-01-01") + pd.to_timedelta(int(round(doy)) - 1, unit="D")
    return base.strftime("%d-%b")


def make_synthetic(n_parcels=45, years=range(2017, 2026)) -> pd.DataFrame:
    """Fecha óptima generada por reglas CONOCIDAS: otoño cálido + envero rápido →
    madura antes → se cosecha antes. Señales observadas a primeros de octubre."""
    years = list(years)
    # Calor del otoño por año (anomalía): + = otoño cálido → madura antes.
    otono_calor = {y: RNG.normal(0, 1.0) for y in years}
    variedad = RNG.normal(0, 6.0, n_parcels)  # offset por variedad/altitud (días)

    rows = []
    for i in range(n_parcels):
        for y in years:
            calor = otono_calor[y] + RNG.normal(0, 0.25)        # microclima
            gdd_oct = 1400 + 120 * calor + RNG.normal(0, 30)    # GDD acumulado a 1-oct
            envero_speed = 0.0009 + 0.0004 * calor + RNG.normal(0, 0.00012)  # velocidad de maduración
            # FECHA ÓPTIMA verdadera (DOY): base ~26-nov, antes si cálido/rápido.
            doy = (330.0
                   - 7.0 * calor                  # otoño cálido → antes
                   - 9000.0 * (envero_speed - 0.0009)  # envero rápido → antes
                   + variedad[i]
                   + RNG.normal(0, 3.5))
            # Señales OBSERVADAS a 1-oct (con ruido):
            ndre_nivel = 0.20 + 0.10 * (-calor * 0.3) + RNG.normal(0, 0.015)  # nivel NDRE
            ndre_pend = -envero_speed + RNG.normal(0, 0.00010)  # pendiente NDRE otoño (negativa)
            rows.append({
                "parcela": i, "campaña": y,
                "gdd_a_oct": round(gdd_oct, 0),
                "ndre_nivel_oct": round(ndre_nivel, 4),
                "ndre_pendiente_otono": round(ndre_pend, 6),
                "variedad_offset": round(variedad[i], 2),
                "doy_optimo": round(doy, 1),
            })
    return pd.DataFrame(rows)


def grouped_oof(df, feats, group):
    logo = LeaveOneGroupOut()
    X, y, g = df[feats].values, df[TARGET].values, df[group].values
    pred = np.zeros(len(y))
    for tr, te in logo.split(X, y, g):
        m = GradientBoostingRegressor(n_estimators=300, max_depth=3, learning_rate=0.05, random_state=0)
        m.fit(X[tr], y[tr])
        pred[te] = m.predict(X[te])
    return y, pred


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--serie", default="encineno_s2_series.csv")
    ap.add_argument("--out_plot", default="encineno_timing.png")
    args = ap.parse_args()

    # ── PARTE A · MOTOR (sintético) ──
    df = make_synthetic()
    print(f"PARTE A · MOTOR (sintético): {df['parcela'].nunique()} parcelas × "
          f"{df['campaña'].nunique()} años = {len(df)} muestras")
    print("Regla verdadera: otoño cálido (GDD) + envero rápido (NDRE) → madura ANTES.\n")

    y, p = grouped_oof(df, FEATURES, "campaña")
    mae = mean_absolute_error(y, p)
    print("BACKTESTING (leave-one-year-out, predecir el DÍA ÓPTIMO):")
    print(f"  Error medio = {mae:.1f} DÍAS   ·   R² = {r2_score(y, p):.3f}")
    print(f"  Baseline (predecir la fecha media siempre): "
          f"{mean_absolute_error(y, np.full(len(y), y.mean())):.1f} días\n")

    # importancia fuera de muestra
    yrs = sorted(df["campaña"].unique())
    tr = df[df["campaña"] <= yrs[-3]]; te = df[df["campaña"] >= yrs[-2]]
    m = GradientBoostingRegressor(n_estimators=300, max_depth=3, learning_rate=0.05, random_state=0)
    m.fit(tr[FEATURES].values, tr[TARGET].values)
    pi = permutation_importance(m, te[FEATURES].values, te[TARGET].values, n_repeats=30, random_state=0)
    imp = pd.DataFrame({"variable": FEATURES, "importancia": pi.importances_mean}).sort_values("importancia", ascending=False)
    print("IMPORTANCIA (qué usa para decidir la fecha):")
    print(imp.to_string(index=False))
    print(f"\nEjemplo de lectura: óptimo medio sintético ≈ DOY {y.mean():.0f} ({doy_a_fecha(y.mean())}), "
          f"y el motor lo clava a ±{mae:.0f} días.\n")

    # ── PARTE B · SEÑAL REAL (envero de Encineño) ──
    print("PARTE B · SEÑAL REAL: trayectoria de envero (NDRE otoño) de Encineño")
    s = pd.read_csv(args.serie, parse_dates=["date"])
    s["year"] = s["date"].dt.year
    s["doy"] = s["date"].dt.dayofyear
    autumn = s[(s["date"].dt.month >= 9) & (s["date"].dt.month <= 12)]
    for yr, g in autumn.groupby("year"):
        if len(g) >= 3:
            print(f"  {yr}: {len(g)} escenas otoño · NDRE {g['ndre'].iloc[0]:.3f} → {g['ndre'].iloc[-1]:.3f}")

    # ── PLOT ──
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(13.5, 5.4))
    a1.scatter(y, p, s=18, color="#46632e", alpha=0.55, edgecolor="none")
    lim = [min(y.min(), p.min()), max(y.max(), p.max())]
    a1.plot(lim, lim, "--", color="#6B6B5C", lw=1)
    a1.set_xlabel("Día óptimo REAL (DOY)"); a1.set_ylabel("Día óptimo PREDICHO (DOY)")
    a1.set_title(f"A · El motor predice la FECHA óptima\nerror {mae:.0f} días (datos SINTÉTICOS)")
    a1.grid(alpha=0.3)

    colors = ["#c2b280", "#9b6dbf", "#46632e", "#E07A3C", "#3c7ab0"]
    for k, (yr, g) in enumerate(autumn.groupby("year")):
        if len(g) >= 3:
            g = g.sort_values("doy")
            a2.plot(g["doy"], g["ndre"], "-o", ms=3, color=colors[k % len(colors)], label=str(yr))
    a2.set_xlabel("Día del año (otoño: sep → dic)"); a2.set_ylabel("NDRE (maduración / envero)")
    a2.set_title("B · Señal real de envero · Encineño\n(lo que el modelo leería)")
    a2.grid(alpha=0.3); a2.legend(title="campaña", fontsize=8)
    fig.suptitle("Encineño · modelo del CUÁNDO (fecha óptima de cosecha)", fontsize=13)
    fig.tight_layout()
    fig.savefig(args.out_plot, dpi=120)
    print(f"\n→ {args.out_plot}")
    print("\nHONESTO: el motor está validado con reglas conocidas. La fecha REAL de "
          "Encineño necesita el ground-truth del fondo (fechas históricas de cosecha "
          "+ índice de madurez/contenido graso). Aquí mostramos la señal y el motor, no el dato.")


if __name__ == "__main__":
    main()
