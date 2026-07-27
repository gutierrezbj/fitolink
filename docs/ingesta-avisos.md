# Ingesta automática de avisos fitosanitarios · runbook

> Sprint Notificación de Plagas · 12-jul-2026. Primera fuente con scraper
> real: **RAIF Andalucía** (informe "Estado fitosanitario actual de Prays
> oleae"). El resto de fuentes (DARP/SAIF/SIAM/ITACYL) siguen en curación
> manual por seed — ver "Añadir fuentes" abajo.
>
> **Actualización 27-jul-2026** · segunda ingesta automática: el **boletín
> semanal provincial** del RAIF, multicultivo, 7 provincias. Multiplica el
> tablón de 10 avisos a ~147 por semana. Ver "Boletín semanal" más abajo.

## Qué hace

```
portal RAIF ──fetch+parse──▶ PestAdvisory (BD) ──fan-out──▶ Alert 'pest_advisory'
   (HTML)      fail-closed      tablón /avisos               AlertsPage · campanita
                gate por fecha  cards por parcela            pills dashboards coop/adv/regantes
                                sección digest               (email digest cuando se active)
```

1. **Scraper** (`apps/api/src/services/raifIngestService.ts`): descarga el
   informe Prays del portal RAIF y parsea fecha de publicación, cifras
   provinciales literales (% aceitunas con Prays vivo, adultos/trampa/día,
   % supervivencia larvas), fenología y el calificador del portal.
2. **Gate por fecha**: solo ingesta si el informe del portal es MÁS NUEVO
   que lo que hay en BD. Sin publicación nueva → no-op. Cero frescura
   fabricada (CRITICAL_no_inventar).
3. **Fan-out** (`pestAdvisoryService.fanOutAdvisoryAlerts`): una Alert
   `pest_advisory` por parcela activa que matchee cultivo + radio del
   aviso. Idempotente: dedupe por (parcela + fingerprint del aviso +
   alerta abierta) — re-ejecutar no duplica ni spamea.
4. **Fail-closed**: si el portal no responde o cambió su HTML y el parser
   no extrae fecha/cifras → exit 1, BD intacta, log con extracto del body.

## Primera puesta en marcha (bootstrap)

Tras el deploy + seed inicial, **correr el runner una vez a mano** (comando
de abajo) y verificar en logs `pest_alert_fanout_completed` con
`alertsCreated > 0`. No hace falta `--force`: el runner hace un **barrido
de fan-out en cada ejecución** (también cuando el portal no tiene
publicación nueva), sobre TODOS los avisos vigentes — eso cubre el
bootstrap, los avisos creados a mano, las parcelas dadas de alta después
de un aviso, y el reintento si un run anterior murió a medias. El barrido
es idempotente: en el caso normal crea 0 alertas nuevas.

## Operación

```bash
# Manual (en el VPS):
cd /opt/fitolink && docker compose -f docker-compose.prod.yml exec -T api \
  node apps/api/dist/ingest/ingestRaif.js

# Forzar re-ingesta aunque la fecha no sea más nueva (pruebas):
... node apps/api/dist/ingest/ingestRaif.js --force
```

### Crontab del host (semanal · lunes 07:30)

**No edites el crontab del VPS a mano.** La fuente de verdad es
[`ops/crontab`](../ops/crontab), versionada en el repo junto a la del pipeline
satelital. Para instalarla:

```bash
bash ops/install-crontab.sh           # simulación: enseña el diff, no toca nada
bash ops/install-crontab.sh --apply   # aplica (hace backup antes)
```

> ⚠️ Nunca uses `echo "..." | crontab -` para añadir una línea: **reemplaza el
> crontab entero** y se lleva por delante lo que hubiera (le pasó a este
> proyecto el 25-jul-2026). El instalador hace copia de seguridad y muestra el
> diff antes de aplicar.

### Señales en logs

| Log | Significado |
|-----|-------------|
| `raif_ingest_up_to_date` | Portal sin publicación nueva. Todo bien. |
| `raif_ingest_completed` | Informe nuevo ingerido (deleted/inserted). |
| `pest_alert_fanout_completed` | Alertas creadas/skipped por advisory. |
| `raif_fetch_http_error` / `raif_fetch_network_error` | Portal caído — reintenta el lunes siguiente. |
| `ingestRaif · PARSE ERROR` | **El HTML del portal cambió** → actualizar regexes en `parsePraysHtml()` (validarlos con `curl` + node contra el HTML real antes de tocar código). |

## Interacción con los seeds

- `seedPestAdvisories.ts` (Prays oct-2025) tiene un **guard**: si la BD ya
  tiene un informe Prays más nuevo (ingesta), el seed NO siembra — nunca
  pisa una ingesta más fresca.
- La ingesta reemplaza los Prays por **delete + reinsert** con fingerprint
  `polilla-olivo-RAIF-<Provincia>-<YYYY-MM>`.

## Boletín semanal provincial (27-jul-2026)

Segunda ingesta automática, independiente de la de Prays. Cada provincia
andaluza publica un PDF semanal multicultivo; de ahí sale un aviso por
(provincia · cultivo · plaga · semana).

```
índice provincial ──▶ PDF ──pdftotext──▶ parser puro ──▶ PestAdvisory
  (HTML, 7 prov.)          -layout + -raw   fail-closed     tablón /avisos
                           fecha INTERNA    por provincia
```

**Ficheros**: `ingest/pdfText.ts` (descarga + texto + fecha obligatoria),
`ingest/raifWeeklyParser.ts` (puro: texto → estructura),
`ingest/raifWeeklyIngest.ts` (una provincia → avisos),
`ingest/ingestRaifWeekly.ts` (runner).

```bash
# Ver qué publicaría, SIN tocar la BD — hazlo siempre antes de un cambio
docker compose -f docker-compose.prod.yml exec -T api node apps/api/dist/ingest/ingestRaifWeekly.js --dry-run
```

**Cuánto trae** (medido el 27-jul-2026, periodo "Del 20 al 24 de julio de
2026"): 147 avisos · 12 destacados por la propia fuente · por cultivo
olivo 42, cítrico 29, almendro 25, algodón 24, viñedo 17, arroz 8, pistacho 2.

**Qué llega a la campanita** — constante `FANOUT_POLICY` en
`raifWeeklyIngest.ts`. Por defecto `'destacados'`: los 147 van al tablón,
pero solo se convierten en alerta de parcela los que el boletín lista en
"Agentes destacados". Con `'todos'` serían ~80 alertas semanales en el
entorno demo (12 por socio de la cooperativa). El filtro no es nuestro: lo
decide la fuente.

La decisión se **congela en el documento** (`PestAdvisory.notifyParcels`), no
solo en esta constante. Tiene que ser así: el barrido idempotente de
`ingestRaif.js` recorre TODOS los avisos vigentes cada lunes, así que una
política que viviera solo en el ingester quedaría anulada dos días después de
aplicarse. Cambiar `FANOUT_POLICY` afecta a los boletines de semanas
siguientes, no a los ya publicados.

**Trampas encontradas, por si el parser deja de casar:**

- Los nombres de fichero son **fósiles**: `Informe_Fitosanitario_0603_0609-2.pdf`
  en la carpeta `uploads/2023/04` sirve el boletín de julio de 2026. La fecha
  se saca SIEMPRE del texto interno; sin fecha no se publica.
- La URL lleva el segmento repetido `informe-semanal/informe-semanal-<prov>/`.
  Sin el intermedio, la Junta responde 301 a `pd-web-wp-raif.apps.paas-pro…`,
  que no resuelve fuera de su red.
- Maquetación distinta por provincia: Granada fecha "de julio **/** 2026";
  Almería y Granada escriben "Agentes **más** destacados", Cádiz alterna.
- **Córdoba** no publica el informe general multicultivo (solo especiales por
  cultivo) → se salta con error. Cablearla es cablear ese otro formato.
- La imagen necesita `poppler-utils` (ya en `docker/Dockerfile.api`). Si falta,
  el error lo dice explícitamente.
- **Cultivos que el catálogo no tiene.** Málaga publica `TROPICALES (Aguacate)`
  y Huelva `FRUTOS ROJOS`; ninguno existe en `CROP_TYPES`. Esas secciones se
  descartan y salen nombradas en el log (`cultivos del boletín sin mapear`).
  Importante: la sección sin mapear igualmente CORTA la anterior. Antes no lo
  hacía y sus plagas se publicaban bajo el cultivo previo — las 4 del aguacate
  de Málaga salían como avisos de OLIVAR.
- **Una semana a caballo de dos meses** ("Del 29 de junio al 3 de julio") tiene
  su propio patrón de fecha. Sin él caía al fallback mensual, que devuelve el
  mes entero, deja el fin de periodo en el futuro y desarma el guard de
  frescura. Tres capas lo cubren ahora: el patrón, el rechazo de fechas
  futuras (`requireBulletinDate`) y la exigencia de que el periodo dure ≤10
  días (`MAX_WEEK_SPAN_DAYS`).
- El `sourceUrl` que se guarda es el **índice provincial**, no el PDF: la Junta
  sobrescribe el fichero cada semana y el aviso vive 10 días más que su
  periodo, así que el enlace al PDF acabaría sirviendo otra semana distinta de
  la que declara `sourceRef`.

## Añadir fuentes (F2)

Cada fuente nueva = un `<fuente>IngestService.ts` con su `parse<X>Html()`
(puro, testeable contra HTML descargado) + entrada en el runner. Candidatas
por scrapeabilidad verificada: ITACYL (plagas.itacyl.es, HTML semanal),
DARP Ruralcat. El fan-out y la UI ya son genéricos — solo hay que producir
`PestAdvisory` válidos.
