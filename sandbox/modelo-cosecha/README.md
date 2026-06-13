# Sandbox · Modelo predictivo de cosecha (olivar)

Entorno de experimentación para el modelo predictivo. **Se construye con lo que
tenemos hoy** (Encineño, ya cargado) y se enchufan los datos del fondo cuando
lleguen. No esperamos a nadie para avanzar — tenemos algo que enseñar.

Corre en **local / Mac mini**, NUNCA en el VPS (el VPS solo sirve).

## Qué hay
- `encineno.geojson` — el polígono real de la finca (70 vértices, extraído del seed).
- `ingest_sentinel.py` — **Paso 1**: baja la serie temporal Sentinel-2 (NDVI/NDRE/NDMI) vía Microsoft Planetary Computer, a 10 m, recortada al polígono, con máscara de nubes → CSV.
- `analyze.py` — **Paso 2-3**: lee la serie y deriva **features por campaña** (pico de NDVI y su día, integral, amplitud, y la **pendiente de NDRE en otoño = proxy del envero**) + gráfico de la curva plurianual. Lógica verificada con datos sintéticos (capta fenología + envero correctamente).
- `requirements.txt` — dependencias.

## Cómo arrancar
```bash
cd sandbox/modelo-cosecha
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python ingest_sentinel.py --years 4 --cloud 40 --out encineno_s2_series.csv
```
Sale un CSV con una fila por escena: `date, ndvi, ndre, ndmi, valid_px`. Esa es la
**caracterización del comportamiento** de la finca — algo que ya se puede enseñar.

## Plan de pasos (cada uno entra cuando el anterior funciona)
- [x] **Paso 0** — geometría real de Encineño en el sandbox.
- [ ] **Paso 1** — ingesta Sentinel-2 (serie NDVI/NDRE/NDMI). *Script listo, a correr en local.*
- [x] **Paso 2-3** — `analyze.py`: features por campaña (pico, integral, **pendiente de NDRE en otoño = envero**) + gráfico de la serie. Lógica verificada con sintéticos. *(Sub-pasos siguientes: GDD con ERA5, y variabilidad por zona desde el grid del heatmap.)*
- [ ] **Paso 4** — *cuando llegue el TARGET del fondo* (kg/campaña): correlación señal ↔ rendimiento → primer modelo de yield + backtesting.
- [ ] **Paso 5** — vuelos de dron (censo de árboles + NDVI por copa + fruto) como ground-truth de alta resolución.

## Criterios fijados (ver cuaderno Notion "🧠 Modelo Predictivo")
- **Resolución por factibilidad**, no por coste: 10 m (capta la copa) + dron. MODIS 250 m diluye el olivo en el suelo del secano → no sirve aquí.
- **Premium de pago**: el cliente paga por la inteligencia, no por los datos.
- **Mini-piloto** acotado por **variabilidad + target**, no por superficie. A nivel árbol, 20-50 ha = miles de muestras.

## Qué NO bloquea el avance
No tener todavía el target del fondo NO para los Pasos 1-3 (caracterización + pipeline + visualización). El target se enchufa en el Paso 4. Construimos el andamiaje ahora; el dato del cliente entra después.
