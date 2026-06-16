"""
SANDBOX · Modelo de cosecha · Paso 4-bis: EL MOTOR (harness + backtesting).

Valida la MAQUINARIA del modelo predictivo ANTES de tener el target del fondo.
Genera un dataset SINTÉTICO pero realista (N parcelas × M campañas) cuyo
rendimiento se construye con drivers CONOCIDOS:

    · agua de primavera        → efecto POSITIVO (saturante)
    · días de calor extremo    → efecto NEGATIVO
    · VECERÍA (añada/contraañada) → la carga del año N-1 BAJA la del año N

Luego entrena Gradient Boosting y valida con leave-one-year-out y
leave-one-parcel-out (CV agrupada, honesta con N pequeño). El test clave:
¿la importancia de variables RECUPERA los drivers verdaderos?

Si la maquinaria recupera lo que metimos, el día que el fondo entregue su serie
de kg/parcela/campaña, se enchufa y sale el primer modelo REAL. Aquí NO se
afirma nada sobre el rendimiento real de Encineño: esto prueba el motor, no el
cultivo. Los rangos de las variables se anclan a los datos reales de Encineño.

Uso:
    python model_backtest.py
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

RNG = np.random.default_rng(42)

FEATURES = [
    "lluvia_primavera", "lluvia_verano", "gdd_total", "dias_calor35",
    "flor_ndvi", "ndvi_integral", "verano_ndmi_min", "rinde_previo", "vec_estado",
]
TARGET = "rinde_real"


def make_synthetic(n_parcels=50, years=range(2017, 2026)) -> pd.DataFrame:
    """Dataset sintético con drivers conocidos. Rangos anclados a Encineño real."""
    years = list(years)
    # Clima regional por campaña (rangos reales: primavera 80-420mm, calor 60-82 días).
    spring = {y: RNG.uniform(80, 420) for y in years}
    heat = {y: RNG.uniform(60, 82) for y in years}
    gdd = {y: RNG.uniform(3300, 3700) for y in years}
    intrinsic = RNG.normal(1.0, 0.08, n_parcels).clip(0.6, None)  # productividad de parcela (poco dispersa)

    rows = []
    for i in range(n_parcels):
        rinde_previo = None
        load = RNG.uniform(0.4, 0.6)  # estado de vecería inicial
        for y in years:
            sr = spring[y] * RNG.normal(1.0, 0.06)   # microclima por parcela
            hd = heat[y] * RNG.normal(1.0, 0.04)
            f_water = sr / (sr + 120.0)                       # saturante 0..1
            f_heat = 1.0 - 0.010 * max(0.0, hd - 70.0)        # penaliza calor >70 días
            # VECERÍA: carga de este año baja si la del año pasado fue alta.
            load = float(np.clip(
                0.55 - 0.75 * (load - 0.5) + 0.20 * (f_water - 0.5) + RNG.normal(0, 0.05),
                0.05, 1.2))
            # Rendimiento latente (lo que el fondo mediría en kg).
            rinde = max(100.0 * intrinsic[i] * f_water * f_heat * load + RNG.normal(0, 5), 0.0)
            # Variables OBSERVADAS (proxies con ruido — lo que el modelo ve).
            flor_ndvi = float(np.clip(0.16 + 0.18 * (0.55 * load + 0.45 * f_water) + RNG.normal(0, 0.02), 0.05, 0.6))
            ndvi_integral = 8.0 + 12.0 * (0.6 * f_water + 0.4 * (intrinsic[i] - 0.5)) + RNG.normal(0, 0.8)
            ndmi_min = -0.05 - 0.12 * (1 - f_water) + RNG.normal(0, 0.02)
            rows.append({
                "parcela": i, "campaña": y,
                "lluvia_primavera": round(sr, 1),
                "lluvia_verano": round(RNG.uniform(0, 55), 1),
                "gdd_total": round(gdd[y], 0),
                "dias_calor35": round(hd, 0),
                "flor_ndvi": round(flor_ndvi, 4),
                "ndvi_integral": round(ndvi_integral, 2),
                "verano_ndmi_min": round(ndmi_min, 4),
                "rinde_previo": rinde_previo,
                "rinde_real": round(rinde, 1),
            })
            rinde_previo = round(rinde, 1)
    df = pd.DataFrame(rows).sort_values(["parcela", "campaña"]).reset_index(drop=True)
    # VECERÍA bien codificada: desviación del rinde previo respecto al historial de la
    # PROPIA parcela (solo años anteriores, sin fuga). >0 = el año pasado fue añada
    # para esta parcela → este año tiende a contraañada. Aísla la oscilación del nivel base.
    base = df.groupby("parcela")["rinde_real"].transform(lambda s: s.shift(1).expanding().mean())
    df["vec_estado"] = df["rinde_previo"] - base
    return df.dropna(subset=["rinde_previo", "vec_estado"]).reset_index(drop=True)


def gb():
    return GradientBoostingRegressor(
        n_estimators=350, max_depth=3, learning_rate=0.05, subsample=0.9, random_state=0)


def grouped_oof(df: pd.DataFrame, feats: list, group: str):
    """Predicciones out-of-fold con leave-one-group-out. Honesto: el grupo de test
    nunca se vio en entrenamiento."""
    logo = LeaveOneGroupOut()
    X, y, g = df[feats].values, df[TARGET].values, df[group].values
    pred = np.zeros(len(y))
    for tr, te in logo.split(X, y, g):
        m = gb()
        m.fit(X[tr], y[tr])
        pred[te] = m.predict(X[te])
    return y, pred


def report(name: str, y, pred) -> None:
    print(f"  {name:32s}  R²={r2_score(y, pred):.3f}   MAE={mean_absolute_error(y, pred):.1f} kg")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out_plot", default="encineno_backtest.png")
    ap.add_argument("--real_csv", default="encineno_features_multimodal.csv")
    args = ap.parse_args()

    df = make_synthetic()
    print(f"Dataset SINTÉTICO: {df['parcela'].nunique()} parcelas × "
          f"{df['campaña'].nunique()} campañas = {len(df)} muestras (1er año fuera por el lag)")
    print("Drivers verdaderos inyectados: agua(+saturante) · calor(−) · vecería vía rinde_previo(−)\n")

    print("BACKTESTING (CV agrupada, out-of-fold):")
    y_y, p_y = grouped_oof(df, FEATURES, "campaña")
    report("Modelo completo · LOyear-out", y_y, p_y)
    y_p, p_p = grouped_oof(df, FEATURES, "parcela")
    report("Modelo completo · LOparcela-out", y_p, p_p)
    # Baselines honestos
    report("Baseline · media global", df[TARGET].values,
           np.full(len(df), df[TARGET].mean()))
    y_v, p_v = grouped_oof(df, ["rinde_previo"], "campaña")
    report("Solo rinde_previo (absoluto)", y_v, p_v)
    y_e, p_e = grouped_oof(df, ["vec_estado"], "campaña")
    report("Solo vecería bien codificada", y_e, p_e)
    y_s, p_s = grouped_oof(df, ["flor_ndvi", "ndvi_integral", "verano_ndmi_min"], "campaña")
    report("Solo satélite (sin clima ni lag)", y_s, p_s)

    # Importancia por permutación, medida FUERA de muestra (últimas 2 campañas como test).
    yrs = sorted(df["campaña"].unique())
    tr = df[df["campaña"] <= yrs[-3]]
    te = df[df["campaña"] >= yrs[-2]]
    m = gb().fit(tr[FEATURES].values, tr[TARGET].values)
    pi = permutation_importance(m, te[FEATURES].values, te[TARGET].values,
                                n_repeats=30, random_state=0)
    imp = (pd.DataFrame({"variable": FEATURES, "importancia": pi.importances_mean})
           .sort_values("importancia", ascending=False).reset_index(drop=True))
    print("\nIMPORTANCIA DE VARIABLES (permutación, fuera de muestra):")
    print(imp.to_string(index=False))

    # Plot: predicho vs real + importancia.
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(13, 5.4))
    a1.scatter(y_y, p_y, s=22, color="#46632e", alpha=0.6, edgecolor="none")
    lim = [min(y_y.min(), p_y.min()), max(y_y.max(), p_y.max())]
    a1.plot(lim, lim, "--", color="#6B6B5C", lw=1)
    a1.set_xlabel("Rendimiento real (kg)"); a1.set_ylabel("Predicho por el modelo (kg)")
    a1.set_title(f"Predicho vs real · leave-one-year-out\nR² = {r2_score(y_y, p_y):.2f}  (datos SINTÉTICOS)")
    a1.grid(alpha=0.3)
    a2.barh(imp["variable"][::-1], imp["importancia"][::-1], color="#E07A3C")
    a2.set_title("Importancia de variables (permutación)")
    a2.set_xlabel("caída de R² al permutar")
    fig.suptitle("Encineño · motor del modelo de cosecha — validación de la maquinaria", fontsize=13)
    fig.tight_layout()
    fig.savefig(args.out_plot, dpi=120)
    print(f"\n→ {args.out_plot}")

    # ¿El motor lee las variables REALES de Encineño? (plumbing check)
    try:
        real = pd.read_csv(args.real_csv)
        cols = [c for c in FEATURES if c in real.columns]
        print(f"\nPlumbing real: {args.real_csv} aporta {len(cols)}/{len(FEATURES)} variables "
              f"del modelo: {cols}")
        print("  Falta 'rinde_previo' y el TARGET (kg/campaña) — los pone el fondo. "
              f"N real = {len(real)} campañas (insuficiente para entrenar; el motor ya está listo).")
    except FileNotFoundError:
        print("\n(Plumbing real omitido: no se encontró el CSV de features reales.)")


if __name__ == "__main__":
    main()
