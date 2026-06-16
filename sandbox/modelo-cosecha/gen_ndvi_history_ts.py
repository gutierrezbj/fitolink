"""Convierte la serie real Sentinel-2 de Encineño (CSV) en un módulo TS que el
seed de FitoLink importa. Datos REALES (vía MPC); min=max=mean (solo tenemos la
media zonal — no inventamos rango). Salida compila a dist/ sin leer ficheros.
"""
import csv
import os

SRC = "encineno_s2_series.csv"
OUT = "/Users/juanguti/dev/srs/fitolink/apps/api/src/seed/data/encinenoNdviHistory.ts"

rows = []
with open(SRC) as f:
    for r in csv.DictReader(f):
        rows.append(r)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
lines = [
    "// AUTO-GENERADO desde sandbox/modelo-cosecha/encineno_s2_series.csv — NO editar a mano.",
    "// Serie real Sentinel-2 de Encineño (4 años, vía Microsoft Planetary Computer, 10 m,",
    "// recortada al polígono real). min=max=mean: solo guardamos la media zonal de la parcela.",
    "export interface EncinenoNdviPoint {",
    "  date: string; mean: number; min: number; max: number; ndreValue: number; ndmiValue: number;",
    "}",
    f"export const ENCINENO_NDVI_HISTORY: EncinenoNdviPoint[] = [",
]
for r in rows:
    ndvi = float(r["ndvi"]); ndre = float(r["ndre"]); ndmi = float(r["ndmi"])
    lines.append(
        f'  {{ date: "{r["date"]}", mean: {ndvi}, min: {ndvi}, max: {ndvi}, '
        f'ndreValue: {ndre}, ndmiValue: {ndmi} }},'
    )
lines.append("];")
lines.append("")

with open(OUT, "w") as f:
    f.write("\n".join(lines))

print(f"→ {OUT}  ({len(rows)} lecturas reales)")
