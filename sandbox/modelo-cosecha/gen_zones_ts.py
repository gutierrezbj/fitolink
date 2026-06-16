"""
Convierte encineno_zones.json (salida de compute_zones.py) en el módulo TS que
consume el frontend: apps/web/src/features/prediction/encinenoZonesRef.ts.

Igual que gen_ndvi_history_ts.py para la serie. Cero invento: solo vuelca lo que
compute_zones.py calculó del satélite. Si no existe el JSON, no hace nada.

Uso: .venv/bin/python gen_zones_ts.py
"""
import json
import os

SRC = "encineno_zones.json"
DST = "../../apps/web/src/features/prediction/encinenoZonesRef.ts"


def main():
    if not os.path.exists(SRC):
        print(f"No existe {SRC} — corre compute_zones.py primero.")
        return
    with open(SRC) as f:
        data = json.load(f)

    zones = data.get("zones", [])
    meta = {"dateRange": data.get("dateRange", ""), "scenes": data.get("scenes", 0),
            "resolution": data.get("resolution", 0)}

    lines = [
        "/**",
        " * Zonas de manejo de Encineño — GENERADO por sandbox/modelo-cosecha/gen_zones_ts.py",
        " * desde el compuesto temporal Sentinel-2 (mediana de varias escenas vía MPC).",
        " * Cero invento: solo vigor real por zona; las ventanas de recogida siguen",
        " * pendientes del modelo (histórico del fondo + dron). NO editar a mano.",
        " */",
        "export interface ManagementZone {",
        "  id: number; label: string; areaHa: number; areaPct: number; meanNdvi: number; cells: number;",
        "}",
        "export interface ZonesMeta { dateRange: string; scenes: number; resolution: number; }",
        "",
        f"export const ZONES_META: ZonesMeta = {json.dumps(meta)};",
        "",
        "export const ENCINENO_ZONES: ManagementZone[] = [",
    ]
    for z in zones:
        lines.append(
            f"  {{ id: {z['id']}, label: {json.dumps(z['label'])}, areaHa: {z['areaHa']}, "
            f"areaPct: {z['areaPct']}, meanNdvi: {z['meanNdvi']}, cells: {z['cells']} }},"
        )
    lines.append("];")
    lines.append("")

    # Celdas de la rejilla (para pintar las zonas sobre el mapa).
    cells = data.get("cells", [])
    lines.append("export interface ZoneCell { lat: number; lng: number; zone: number; ndvi: number; }")
    lines.append("export const ENCINENO_ZONE_CELLS: ZoneCell[] = [")
    for c in cells:
        lines.append(f"  {{ lat: {c['lat']}, lng: {c['lng']}, zone: {c.get('zone', 0)}, ndvi: {c['ndvi']} }},")
    lines.append("];")
    lines.append("")

    with open(DST, "w") as f:
        f.write("\n".join(lines))
    print(f"✅ {DST} · {len(zones)} zonas escritas (mediana de {meta['scenes']} escenas).")


if __name__ == "__main__":
    main()
