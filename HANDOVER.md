# 🛸 HANDOVER · FitoLink

**Snapshot:** 2026-06-10 · 15:50 CEST · v1.8 (Sprint UX badges 100% cerrado mañana + Small Cards Cooperativa + tarde · Encineño 407 ha cliente real fondo de inversión cargada + pipeline manual ejecutado + datos Sentinel-2/Landsat reales para demo MS 12-jun)
**Owner:** JuanCho
**Para retomar:** lee este doc + `CLAUDE.md` (contexto estable) + `glossary.md` (vocabulario del proyecto).

> **TAGLINE OFICIAL AgroM** (capturado 9-jun-2026 cierre del día):
> *"AgroM va a ganar el campo español porque cree que ayudar es el camino."*
> Esta frase es la cláusula de misión fundacional · va al header de `/about` · al cierre del deck inversor · a la firma de email · a la bio LinkedIn. **NO parafrasear · frase verbatim canónica**.

---

## 1 · Identidad del proyecto

- **Nombre:** FitoLink (SaaS satélite + IA + alertas agrícolas)
- **Repo:** https://github.com/gutierrezbj/fitolink
- **Live:** https://fitolink.agrom.es
- **Owner:** JuanCho · empresa AgroM (SystemRapid SL)
- **Estado actual:** LIVE en producción · campaña 2026 abierta a Tipo A/B + Cooperativa + ADV + Regantes
- **Última versión:** commit `f21481f` en `main` (refactor Coop · CooperativeMembersPage filas → small cards grid · 10-jun-2026)
- **Documentación viva interna:** este `HANDOVER.md` + `CLAUDE.md` (contexto estable + sprint table) + `glossary.md` (vocabulario)
- **Documentación canónica externa (Notion):** [Bitácora 10-jun Sprint UX cierre + Small Cards](https://app.notion.com/p/37b7981f08ef81f88f25db79fe9531b2) · [Bitácora 9-jun triple monumental](https://app.notion.com/p/37a7981f08ef81c6bcdbe0743ed35858) · [Bitácora 5-jun monumental](https://app.notion.com/p/3767981f08ef812291c4d858a7b5d516) · [Bitácora 22-may→4-jun](https://app.notion.com/p/3757981f08ef81f3a7a0cda2890f1e19)
- **Material comercial:** `docs/comercial/microsoft-pitch-viernes/storyline.md` + `demo-guion.md` (universal · audience-agnostic) · `docs/comercial/visor-plagas-mock.html` (mock v2 standalone del 2º lead magnet)

## 2 · Stack y arquitectura

- **Frontend:** React 19 + Vite 6 + TypeScript + Tailwind + Zustand + React Router v7 + Leaflet + Recharts + Radix UI + TanStack Query
- **Backend:** Node 22 + Express + Mongoose + TypeScript
- **BD:** MongoDB 7
- **Pipeline geo:** Python 3.11 + GDAL + openEO CDSE (cron cada 5 días)
- **Monorepo:** npm workspaces · `apps/api/` · `apps/web/` · `packages/shared/` · `workers/geo-pipeline/`
- **Build local:** `npm run build` (todos workspaces) · `npm run build -w packages/shared` (primero)
- **Run local:** `npm run dev` (web 3040 + api 4040 en paralelo)
- **Tests:** `npm run test -w apps/api`
- **Patrones clave:**
  1. **CRITICAL_no_inventar** · regla #1 · verificar siempre contra código antes de cualquier copy comercial
  2. **Identity Ecosystem** · paleta brand-600 (#46632e verde topographic) + terra-500 (#d45220 naranja) + earth tones · tipografía Instrument Serif + DM Sans + IBM Plex Mono
  3. **Jerarquía marca** · AgroM = empresa, FitoLink = producto. En copy: empresa → AgroM, producto/dashboard → FitoLink
  4. **Separación productos** · FitoLink informa el QUÉ (estado cultivo, decisión riego, focos) · AgroOps (aparcado) cubrirá el CÓMO operativo
  5. **Cero invento** · 26 parcelas demo son SIGPAC catastral real, auditables desde visor MAPA
  6. **Logs con body** · servicios externos siempre capturan `body.slice(0,200)` antes del throw

## 3 · Infraestructura SRS

- **Servidor:** Servidor 2 (`100.110.52.22` Tailscale · IP pública `187.77.71.102`)
- **Path en servidor:** `/opt/fitolink/`
- **Puertos host:** Web `127.0.0.1:3040` · API `127.0.0.1:4040` · MongoDB `127.0.0.1:6040`
- **Containers:** `fitolink-web-1` (nginx:alpine · 3000) · `fitolink-api-1` (node:22-alpine · 4000) · `fitolink-mongo-1` (mongo:7 · 27017) · `fitolink-pipeline-1` (python 3.11 + GDAL · sin puerto, cron interno)
- **Dominio:** `fitolink.agrom.es` (canónico desde 18-may-2026)
- **SSL:** Let's Encrypt **expira 2026-08-15** (renovación auto cada 60 días) · cert path `/etc/letsencrypt/live/fitolink.agrom.es/`
- **Healthcheck:** pendiente registrar en `/opt/scripts/healthcheck.sh` (TODO)
- **Backup:** MongoDB sin backup automatizado configurado (TODO)
- **Acceso SSH:** `ssh root@100.110.52.22` (Tailscale auth)
- **fitolink.systemrapid.io:** dominio antiguo, retirado 18-may-2026. El cert sigue en el VPS pero no se sirve (sin DNS apuntando)

## 4 · Datos operativos clave

- **Email contacto operativo:** `johnj@agrom.es` (Jonh Russo · piloto operativo + cliente pistacho)
- **Email contacto AgroM:** `juang@systemrapid.io` (sender del SMTP_FROM)
- **SSH VPS:** `ssh root@100.110.52.22` (Tailscale habilitado · per-command auth en sesiones de agente)
- **MAP_KEYs:** NASA FIRMS_MAP_KEY en `.env` del VPS (regenerable en https://firms.modaspr.eosdis.nasa.gov/api/map_key/)
- **Push to main:** clasificador bloquea push del agente · JuanCho lo hace manualmente
- **SSH deploy:** requiere autorización explícita per-command

### Modelo operativo · AgroM bajo paraguas Drovinci

**Hasta nueva orden, AgroM NO es operador legal independiente.** Acuerdo activo: AgroM opera comercialmente bajo el paraguas de **Drovinci** (empresa real con certificaciones propias) hasta que AgroM tenga su propio operador UAS + dron censado MAPA + ROPO empresa + seguros RC propios.

**Quién aporta qué en cada tratamiento dron operativo:**

| Pieza legal | Aporta | Detalle |
|---|---|---|
| Bloque 1 · AESA (PDRA-S01[F], DRI, manual ops, seguro RC aeronáutico) | **Drovinci** | Empresa registrada, certificaciones propias |
| Bloque 2 · ITEAF (dron censado MAPA, ISO 16122-5 cuando llegue) | **Drovinci** | Su dron T10 + T40/T100 según operación |
| Bloque 3 · Fitosanitario (autorización CCAA por tratamiento, ROPO piloto + empresa, producto autorizado aéreo, seguro RC fitosanitario, plan Anexo VI) | **Drovinci** | Tramita autorización CCAA antes de cada tratamiento |
| Inteligencia satelital + IA + alertas + dashboard | **AgroM/FitoLink** | Lo que vendemos en SaaS |
| Marca comercial + relación cliente + brokerage | **AgroM** | Cara visible ante cliente final |
| Coordinación operativa + asesoría agronómica | **AgroM (Jonh)** | Jonh trabaja con/vía Drovinci |

**Implicación copy comercial**: NO afirmar "AgroM aplica con dron" como operador propio · sí "AgroM coordina tratamientos con drones operados por la red Drovinci" o wording equivalente honesto. Pendiente verificar exactly qué wording aceptan ambas partes (ACCIÓN JUANCHO).

**Implicación audit legal**: el audit de 3 bloques NO es con Jonh aislado · es con **Ana Gomez Ferrer (Drovinci · aparece como `demo-pilot-002` en BD, persona real)** o quien sea el contacto operativo de Drovinci. Validar vigencia de sus certificaciones + procedimiento de autorización CCAA por tratamiento.

**Camino a independencia** (no prioridad campaña 2026): AgroM registrarse como operador UAS propio + censar drones propios MAPA + ROPO empresa + seguros · entonces salir del paraguas Drovinci.

## 5 · TODOs pendientes (priorizados)

### Bloqueantes para campaña comercial
- [ ] **Pricing definido** (€ por ha/mes o por modelo institucional · acción JuanCho, no código)
- [ ] **Audit con Drovinci** (Ana Gomez Ferrer u operativo) sobre vigencia 3 bloques normativos antes de aceptar primer tratamiento comercial (PDRA-S01[F] vigente + ITEAF censo MAPA + ROPO + procedimiento autorización CCAA por tratamiento). Ver §4 "Modelo operativo · AgroM bajo paraguas Drovinci". NO es audit con Jonh aislado — el operador legal es Drovinci.
- [ ] **Verificar wording copy comercial** con Drovinci · acordar cómo se refiere AgroM a la operación con dron sin afirmar que es operador propio.

### Mejoras importantes (cuando haya tiempo)

#### Bloque C · estado 9-jun-2026

✅ **FOUNDATION CERRADA** (9 commits LIVE en prod entre 8-jun y 9-jun):
- `PEST_SOURCES` enum extendido: RAIF · DARP · MAPA · SAIF · SIAM · CSCV · otros
- Seeds activos en BD prod (idempotentes vía `seedAll.ts`):
  - `seedPestAdvisories.ts` · 7 advisories RAIF (Prays oleae × 5 provincias REALES portal RAIF + Bactrocera + Spilocaea Repilo)
  - `seedPestAdvisoriesDARP.ts` · 2 advisories Cataluña (Cydia Lleida + Plasmopara Tarragona)
  - `seedPestAdvisoriesLevante.ts` · 2 advisories Levante (Cotonet SAIF Vega Baja + Minador SIAM Murcia)
- **Total 11 advisories** geolocalizándose dinámicamente vs cada parcela según crop + radius
- **PRIMER ADVISORY REAL** (commit `e4416ae`): Prays oleae cifras LITERALES del portal oficial RAIF (informe oct 2025 · Sevilla 35% · Málaga 45,1% · Córdoba 35,1% · Cádiz 4,1 capturas/trampa/día · Granada 1% supervivencia larvas) · cero invento · todo verificable clickeando `sourceUrl`
- Verificación E2E via Claude in Chrome 9-jun: Aula Jaén Mancha Real ve Repilo MEDIA + Mosca BAJA · Coop Estepa Sevilla ve 3 Prays provincia (Sevilla LOW + Málaga MEDIUM + Córdoba MEDIUM) · Regantes Vega Baja Almoradí ve Cotonet ALTA + Minador MEDIA
- Esqueleto `apps/api/src/services/raifIngestService.ts` con interfaz lista para sustituir hardcoded por scraper HTML real (TODO comentado)

❌ **PENDIENTE F1 RAIF** (~6-8 días):
- [ ] **F1 día 2-3:** convertir `fetchPraysOleaeReport()` a scraper HTML real (fetch + regex sobre portal RAIF · misma interfaz · cero refactor downstream)
- [ ] **F1 día 4-6:** ampliar a otros endpoints RAIF (Bactrocera oleae · Spilocaea oleagina Repilo · Saissetia oleae · otros con páginas dedicadas del portal)

❌ **PENDIENTE F1 DARP + SAIF + IRIAF** (~6-8 días):
- [ ] **F1 día 7-8:** ingestor DARP Cataluña (`darpIngestService.ts`) · 9 estaciones · scraper portal Ruralcat
- [ ] **F1 día 9-10:** ingestor SAIF / IVIA Valencia (`saifIngestService.ts`) · cítrico + hortícola
- [ ] **F1 día 11-12:** ingestor IRIAF Castilla-La Mancha (`iriafIngestService.ts`) · viñedo + pistacho + cereal
- [ ] **F1 día 13:** cron weekly + endpoint admin trigger manual + UI dashboard agricultor para forzar refresh

❌ **PENDIENTE F2 (Q3 2026 · ~1-2 meses):** SIAM/IMIDA Murcia + ITAGRA Castilla y León + INTAEX Extremadura + IMIDRA Madrid (~85% PIB agrícola)
❌ **PENDIENTE F3 (Q4 2026 / Q1 2027):** los 9 servicios autonómicos restantes (Norte + Islas) (100% cobertura)

#### Visor de Plagas público `/avisos` · 2º lead magnet

- [x] **Mock v2 standalone HTML** entregado 9-jun · `docs/comercial/visor-plagas-mock.html` (+copy en `apps/web/public/`) · abrir con `open` directo en browser · iteración v2 con feedback PM "de tablón a tool que engancha" (HERO input grande "¿Qué pasa en tu comarca?" + Toggle MI ZONA/TODA ESPAÑA + Mapa Leaflet grande + Timeline lateral "últimas publicaciones oficiales" con tiempo relativo + Cards agrupadas por región + KPI "2.847 agricultores esta semana" social proof). Tagline manifiesto al final.
- [ ] **Construcción real en React** como ruta `/avisos` en `apps/web` consumiendo endpoint público `GET /api/v1/public/advisories` (sin auth · cache 1h Redis · SEO con meta tags + URLs únicas por advisory tipo `/avisos/raif-andalucia-mosca-olivo-2026-23`). Visión: agregar los 17 servicios autonómicos · vista anónima + vista logged filtrada por comarcas/cultivos del usuario. Esfuerzo: combina con F1 (ingestores reales) + ~3-4 días extra UI pública.

#### UX badges tipo alerta (Sprint 9-jun + cierre 10-jun)

✅ **Sprint 100% CERRADO** · Helper centralizado `apps/web/src/features/alerts/alertTypeMetadata.tsx` con 4 SVG editorial line-icons (gota=stress hídrico · llama=fuego · hoja=NDVI · destello=NDRE) + `getAlertTypeMetadata(type)` → `{icon, label, shortLabel}`. Backend `cooperativeService.getOverview()` devuelve `alertTypes: AlertTypeBreakdown` per socio (reusado por Coop + ADV + Regantes via aggregator-rule).

Aplicado en **7 componentes** del producto:
- `AlertsPage.tsx` (vista completa)
- `DashboardHome.tsx` farmer (sidebar 2x2)
- `CooperativeDashboardHome.tsx` (lista socios home Coop)
- `CooperativeMembersPage.tsx` (vista detallada Socios · cierre 10-jun)
- `AdvDashboardHome.tsx` (rol ADV · cierre 10-jun)
- `RegantesDashboardHome.tsx` (rol Regantes · cierre 10-jun)
- `AlertBell.tsx` topbar farmer (dropdown 5 recientes · cierre 10-jun)

#### Refactor Small Cards Cooperativa (sprint 10-jun)

✅ **CooperativeMembersPage** · de filas largas a grid responsive 3 cols desktop / 2 tablet / 1 mobile. Mejor escalabilidad para cooperativas con 20-50 socios + comparación visual instantánea + estética más Botanical Cartography (§ eyebrows + hairlines + numerales). Card entera clickable. Commit `f21481f`.
❌ **Pendiente evaluar extensión a otros 3 dashboards** (Coop home / ADV / Regantes) que tienen sidebars laterales 1/3 width · si JuanCho lo valida visualmente.


#### Cliente real ENCINEÑO 407 ha (10-jun-2026 · pre-demo MS)

✅ **Cliente fondo de inversión cargado en sistema** desde KMZ recibido vía Jorge Leccia (jorgeleccia@hotmail.com) de Guillermo Morales Sanchez (guillermoms@live.com). Asunto literal del forward: "AgroM · Aplicación Aerea Agricola". El fondo gestiona **2.300 ha cartera total** · ENCINEÑO 407 ha es solo un sector enviado para evaluación de alcance pre-demo Microsoft 12-jun.

**Datos cargados en BD prod**:
- Usuario demo identificable: `demo-encineno@agrom.es` rol `farmer` (NO usamos email real del propietario en la cuenta — borrable post-demo)
- Parcela "Finca Encineño · Sector 407 ha" · `cropType: olivo` · `province: Cordoba` · 70 vértices del KMZ · 407.7 ha calculadas vs 407 declaradas
- Centroide -4.594, 37.781 (campiña SO Córdoba ciudad · comarca Subbética auto-asignada por sistema)

**Pipeline manual ejecutado 10-jun 15:21-15:49** sobre las 44 parcelas en BD (29 vía openEO, 0 ODATA fallback, 7 alerts creadas total). Encineño cargada con datos REALES Sentinel-2 + Landsat:
- 1 lectura NDVI: mean 0.351 · NDRE 0.232 · NDMI 0.028 (cero anomalía detectada)
- Thermal Landsat C2-L2: LST 39 °C (escena 26-may, 2 escenas usadas)
- Recent climate 31d: 2 mm precipitación total (sequía estacional típica)
- 0 alertas críticas (parcela no está estresada al umbral del detector)
- Climate baseline + MODIS baseline: vacíos (fallback openEO no los rellenó en este run · re-correr si la demo lo pide)

**Advisory matching verificado E2E** vía `/api/v1/parcels/:id/insights/pest-advisories`:
- **Prays oleae · MEDIUM · 19.7 km** · cifras LITERALES portal RAIF oct 2025 (35,1% aceitunas con Prays vivo en Córdoba · por encima del umbral 20%) · `sourceUrl` clickeable al portal Junta de Andalucía
- Comarca auto: "Subbética · campiña olivar"

**Seed canónico** `apps/api/src/seed/seedEncinenoDemo.ts` (idempotente, patrón seedProfessorDemo) committed en este snapshot.

**Login para la demo**: dev-login-by-email con `demo-encineno@agrom.es` (no requiere Google OAuth · ALLOW_DEV_LOGIN sigue true).

#### Otras mejoras
- [ ] **Logs-con-body en pipeline Python** (~30 min) · workers/geo-pipeline/src/* con loguru · mismo patrón que TS
- [ ] **Healthcheck registrado** en `/opt/scripts/healthcheck.sh` del Servidor 2
- [ ] **Backup MongoDB** automatizado (snapshot diario)
- [ ] **Pre-cálculo SoilGrids** en parcelas Aula Jaén (hueco visible "Perfil edáfico no calculado todavía") · script seed batch o endpoint admin con autenticación adecuada · evita el CTA editorial que aparece sin perfil

### Limpieza / V2
- [ ] **Reportes RAIF cuatrimestral** específico ADV (V2 cuando primer cliente real)
- [ ] **Reporte reparto hídrico semanal** específico regantes (V2 cuando primer cliente real)
- [ ] **Self-service onboarding socios** para coop/ADV/regantes (hoy lo vincula equipo SR manual)
- [ ] **DJI Cloud webhook** (solo si abrimos cliente con flota drones)

## 6 · Cómo retomar en 1 minuto desde otra máquina

```bash
git clone https://github.com/gutierrezbj/fitolink.git
cd fitolink
cat HANDOVER.md          # este doc · estado vivo + runbooks + todos
cat CLAUDE.md            # contexto estable + sprint table histórica
cat glossary.md          # vocabulario del proyecto
npm install              # workspaces
npm run build -w packages/shared    # build shared PRIMERO
npm run dev              # web 3040 + api 4040
```

Para acceder a producción:
```bash
ssh root@100.110.52.22
cd /opt/fitolink
docker compose ps
docker logs fitolink-api-1 --tail 50
```

## 7 · Runbooks de fallo

### `https://fitolink.agrom.es` no responde
```bash
ssh root@100.110.52.22
docker ps | grep fitolink
docker logs fitolink-web-1 --tail 30
docker logs fitolink-api-1 --tail 30
cd /opt/fitolink && docker compose up -d --force-recreate web api
```

### SSL caducó / falla
```bash
ssh root@100.110.52.22
certbot certificates | grep fitolink
certbot renew --cert-name fitolink.agrom.es
systemctl reload nginx   # nginx host, no contenedor
```

### Container API en bucle / muere al arrancar
```bash
ssh root@100.110.52.22
docker logs fitolink-api-1 --tail 100
# Causas frecuentes:
# 1. MongoDB no responde · verificar fitolink-mongo-1 Up
# 2. FIRMS_MAP_KEY o ENV var corrupta · grep en /opt/fitolink/.env
# 3. Build mal cacheado · docker compose up -d --force-recreate --build api
```

### KPIs Coop/ADV/Regantes muestran "—" o gris en mapa
Causa: pipeline V2 no ha procesado las parcelas nuevas todavía (cron cada 5 días). Solución: esperar 5d o forzar pipeline manualmente. Las parcelas marcadas `isSyntheticDemo:true` (regantes) NO se procesan por diseño — se les preserva ndviHistory sintético plausible.

### Deploy desplegó pero cambios no aparecen
Causa típica: Docker layer cache stale. Solución: `--force-recreate --build` (no solo `restart`).
```bash
ssh root@100.110.52.22 "cd /opt/fitolink && bash deploy.sh && docker compose up -d --force-recreate --build web api"
```

### Quiero ejecutar todos los seeds idempotentes en prod
```bash
ssh root@100.110.52.22 "cd /opt/fitolink && docker compose exec -T api node apps/api/dist/seed/seedAll.js"
```
Crea/actualiza: providers + pestAdvisories + cooperativa demo (5 socios + 12 parcelas SIGPAC Estepa) + regantes demo (4 socios + 8 parcelas SIGPAC Vega Baja) + professor Aula Jaén (6 parcelas SIGPAC).

### Rollback rápido
```bash
ssh root@100.110.52.22
cd /opt/fitolink && git log --oneline -5
git checkout <SHA_anterior> && docker compose up -d --force-recreate --build web api
```

## 8 · Reglas no negociables del proyecto

- **CRITICAL_no_inventar** (12-may-2026 · memoria SRS) — verificar copy contra realidad operativa. Reforzada 5-jun con HITO 26 parcelas SIGPAC catastral real. Reforzada 9-jun con primer advisory REAL Prays oleae portal RAIF (sustituyendo demo-data inventada).
- **Identity Ecosystem · FitoLink como base** (13-may-2026) — paleta brand-600 + terra-500 + earth, tipografía Instrument Serif + DM Sans + IBM Plex Mono.
- **Jerarquía marca · AgroM empresa + FitoLink producto** (14-may-2026).
- **`fitolink.agrom.es` URL canónica única** (18-may-2026) — `fitolink.systemrapid.io` retirado.
- **"El launch va con lo nuestro"** (4-jun-2026) — no bloquear MVP por dependencias externas privadas no validadas.
- **Separación productos** (5-jun-2026) — FitoLink informa, AgroOps opera. No mezclar.
- **Logs-con-body** (5-jun-2026) — todo servicio externo captura body del error 200ch antes del throw. Aplicado a TS, pendiente Python.
- **TAGLINE OFICIAL AgroM** (9-jun-2026 cierre del día) — *"AgroM va a ganar el campo español porque cree que ayudar es el camino"* · frase verbatim canónica · NO parafrasear · cláusula de misión fundacional. Va al header de `/about` · cierre del deck inversor · firma email · bio LinkedIn.
- **Vendemos el CANAL, no la perfección del dato** (9-jun-2026) — durante construcción NO necesitamos cargar datos comprometedores · demostramos que el CANAL funciona (correo a las 7am cada día con inteligencia accionable). Los datos se afinan con ingestores reales · el sistema ya entrega la promesa. Slot brutal del deck: enseñar el email matutino · WOW de continuidad operativa que el agricultor nota desde día 1.
- **Push a main bloqueado para agente** · JuanCho push manual.
- **SSH deploy requiere OK per-command**.
- **NUNCA API keys en línea de comando** · clasificador bloquea credential leak.

## 9 · Tareas dejadas sin commit en otros repos

Ninguna.

## 10 · Decisiones que el siguiente operador puede tomar

- **Aplicar logs-con-body al pipeline Python** sin consultar (es regla operativa establecida)
- **Sondear refs SIGPAC adicionales** si hace falta seedear nueva región demo (patrón Aula Jaén v2 / Coop v2 / Regantes v3)
- **Reactivar temporalmente el botón Pistachar** en LoginPage para llamada comercial específica + volver a ocultar después (línea comentada en `apps/web/src/features/auth/LoginPage.tsx` con instrucciones)
- **Refrescar MAP_KEY de NASA FIRMS** si NASA la revoca otra vez (regenerar en https://firms.modaspr.eosdis.nasa.gov/api/map_key/ + actualizar `.env` VPS + `docker compose up -d --force-recreate api`)

### NO tomar sin consultar:
- **Cambiar copy comercial** sin verificar contra código real (regla CRITICAL_no_inventar)
- **Construir features que pertenezcan a AgroOps** (cumplimiento normativo dron, gestión operativa tratamientos) · FitoLink informa, AgroOps opera
- **Borrar cuentas demo o cliente real** de MongoDB
- **Mezclar lógica de blockchain / eIDAS / cuaderno PAC** · esos están aparcados conscientemente

---

*Fin del HANDOVER. Si pegas o referencias este doc al inicio del chat nuevo, el asistente arranca con contexto completo de FitoLink. Si la fecha del snapshot tiene >7 días, refrescar con `git pull` + relectura.*
