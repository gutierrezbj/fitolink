# Migración del satélite a MPC · runbook

> 3-ago-2026. Sustituye CDSE/openEO por **Microsoft Planetary Computer (MPC)**
> como proveedor del Sentinel-2 en vivo del pipeline. Motivo: CDSE nos dejó
> tirados **dos veces con CERO clientes de pago** — 402 (sin créditos) el 17-jul
> y 401 (cuenta bloqueada) la noche del 3-ago con 10000 créditos "activos". El
> modelo de CDSE ("procesa en su nube, paga créditos por trabajo") no escala.

## Qué cambia

- **Dato idéntico, sin cupo.** MPC sirve el MISMO Sentinel-2 L2A como datos
  abiertos y gratuitos. Descargamos las bandas y calculamos el NDVI nosotros
  (rasterio ya era dependencia; ya usábamos MPC para histórico y clima).
- **Más rápido.** En el spike, MPC resolvió una parcela en ~1-2 min; openEO ni
  terminó (colgado +15 min) y luego bloqueó la cuenta.
- **Sin "error de cuenta".** MPC es público: un fallo afecta a UNA parcela, no
  aborta la corrida como el 401 de CDSE.

## Cómo se activa

Flag de entorno `SATELLITE_SOURCE` (en `config.py`), leído por `pipeline.py`:

| Valor | Comportamiento |
|---|---|
| `mpc` (**default**) | MPC primario y **único** proveedor. Corte limpio de CDSE. Si MPC falla en una parcela, se salta y el siguiente run reintenta. |
| `openeo` | Legacy: openEO primario + OData de respaldo (misma cuenta CDSE de pago). |

Rollback = poner `SATELLITE_SOURCE=openeo` en el `.env` del VPS y relanzar. Sin
tocar código.

## Ficheros

- `src/ingestion/mpc_sentinel2.py` — `MpcSentinel2Client.compute_ndvi_stats()`,
  reemplazo drop-in de `OpenEOClient` (misma firma y retorno).
- `src/config.py` — `SATELLITE_SOURCE`.
- `src/pipeline.py` — init por modo + rama del bucle + `_process_parcel_mpc`.

## El método es idéntico a openEO (para que el dato no cambie)

Máscara de nubes por SCL {0,1,3,8,9,10,11} · reflectancia = (DN − 1000)/10000
(harmonización BOA baseline ≥04.00, que MPC no aplica) · MAX composite temporal
por píxel · recorte al polígono · mismos 5 índices (NDVI/NDRE/NDMI/EVI/SAVI).

**Validación (spike 3-ago, Olivar Los Toros):** min/max NDVI **IDÉNTICOS**
openEO vs MPC (0.1139 / 0.6574); media 0.2882 vs 0.2955 (0.007, efecto bbox vs
polígono). El match exacto de min/max prueba que leen el mismo dato con la misma
harmonización. Piloto real: las 13 parcelas de aguacate de RD servidas 100% con
MPC (NDVI 0.42–0.71).

## Riesgos y límites (de producción, no del dato)

- **CPU del VPS (1 core).** El cómputo NDVI se mueve a nuestra máquina. Para
  parcelas pequeñas es ligero (se lee solo la ventana del COG), pero con muchas
  parcelas grandes hay que vigilar la carga. La optimización ×15 encaja aquí.
- **Throttling de MPC** bajo carga anónima: `search_with_retry` ya reintenta con
  backoff. Una `PC_SDK_SUBSCRIPTION_KEY` gratuita reduce el límite — registrar en
  planetarycomputer.microsoft.com y añadirla al `.env` si aparecen 429.
- **Harmonización:** se aplica offset −1000 uniforme. Correcto para toda escena
  L2A desde 2022-01-25 (baseline ≥04.00). Para históricos < 2022 habría que
  condicionar el offset por `s2:processing_baseline`.

## Revisión adversarial (14 agentes, pre-commit)

Un panel de 5 dimensiones × verificación encontró **5 defectos reales**, todos
corregidos antes de comitear:
1. **[alta]** El GeoTIFF del grid intra-parcela no se recortaba al polígono (openEO
   sí con `filter_spatial`) → las celdas de borde promediaban NDVI de terreno
   vecino. Fix: exportar con `valid_mask` (paridad con openEO) + `all_touched`.
2. **[alta]** `SATELLITE_SOURCE` no llegaba al contenedor geo (compose no lo
   reenviaba) → el rollback por `.env` era inoperante. Fix: cableado en
   `docker-compose.prod.yml` (+ `PC_SDK_SUBSCRIPTION_KEY`).
3. **[media]** `SATELLITE_SOURCE` sin `.strip()`: un espacio/`\r` revertía a CDSE.
4. **[media]** EVI/SAVI cambian de escala (openEO los calculaba mal, en 0-10000;
   MPC bien, en 0-1) → la ficha pintaría una caída roja falsa en la escena de
   corte. Fix: suprimido el delta de EVI/SAVI (ratios NDVI/NDRE/NDMI intactos) +
   `satSource` en la lectura para trazar el corte.
5. **[baja]** `geometry_mask` sin `all_touched` perdía parcelas finas.

## Despliegue

1. Push (lo hace JuanCho — classifier). El cambio toca la imagen **geo**.
2. Actions verde → `bash deploy-ghcr.sh` (pull de la imagen geo nueva).
3. El siguiente run del cron ya usa MPC (`SATELLITE_SOURCE` default `mpc`).
   No hace falta tocar el `.env` salvo para rollback.
