# Ingesta automática de avisos fitosanitarios · runbook

> Sprint Notificación de Plagas · 12-jul-2026. Primera fuente con scraper
> real: **RAIF Andalucía** (informe "Estado fitosanitario actual de Prays
> oleae"). El resto de fuentes (DARP/SAIF/SIAM/ITACYL) siguen en curación
> manual por seed — ver "Añadir fuentes" abajo.

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

Mismo patrón que el geo-pipeline (`crontab -e` como root en el VPS):

```cron
30 7 * * 1 cd /opt/fitolink && docker compose -f docker-compose.prod.yml exec -T api node apps/api/dist/ingest/ingestRaif.js >> /var/log/fitolink-ingest.log 2>&1
```

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

## Añadir fuentes (F2)

Cada fuente nueva = un `<fuente>IngestService.ts` con su `parse<X>Html()`
(puro, testeable contra HTML descargado) + entrada en el runner. Candidatas
por scrapeabilidad verificada: ITACYL (plagas.itacyl.es, HTML semanal),
DARP Ruralcat. El fan-out y la UI ya son genéricos — solo hay que producir
`PestAdvisory` válidos.
