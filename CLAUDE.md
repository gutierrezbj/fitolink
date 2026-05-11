# FitoLink — Reglas de Desarrollo

## Que es FitoLink
Marketplace on-demand que conecta agricultores con pilotos de drones certificados para aplicaciones fitosanitarias, potenciado por deteccion satelital de anomalias vegetales via Copernicus (Sentinel-2).

## Stack
- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS + Zustand + TanStack Query + React Router v7 + react-leaflet + Recharts
- **Backend:** Node.js + Express 5 + TypeScript + MongoDB (Mongoose) + JWT + Google OAuth + Zod + structlog
- **Geo Pipeline:** Python 3.11 + openeo>=0.26.0 + rasterio + scikit-learn>=1.4.0 + scipy>=1.11.0 + numpy + pymongo + schedule + planetary-computer + pystac-client + odc-stac + xarray
- **Infra:** Docker multi-stage + Nginx + VPS staging 187.77.71.102 (Web:3040, API:4040, Mongo:6040). Nginx system con gzip activado (sweep SRS 2026-05-04, -71.8% egress en JS bundle).

## Estructura del monorepo
```
fitolink/
├── apps/web/          # Frontend React 19
├── apps/api/          # Backend Express
├── workers/geo-pipeline/  # Pipeline Python (Copernicus + IA)
├── packages/shared/   # Schemas Zod + tipos TS compartidos
├── docker/            # Dockerfiles
└── docs/              # Docs extra
```

## Convenciones de codigo

### General
- Codigo en **ingles**, UI en **espanol**, documentacion en **espanol**
- Prettier: semicolons, single quotes, 2 spaces
- ESLint con reglas estrictas
- Conventional Commits: feat:, fix:, docs:, refactor:, test:, chore:

### Frontend
- Componentes funcionales con hooks. PROHIBIDO: class components
- PascalCase componentes, camelCase funciones/variables
- Un componente por archivo
- Props tipadas con TypeScript interfaces (PROHIBIDO: `any`)
- Estado global: Zustand. PROHIBIDO: Redux
- Data fetching: TanStack Query. PROHIBIDO: useEffect para fetch
- Formularios: React Hook Form + Zod
- UI: Radix UI + Tailwind. PROHIBIDO: Material UI, Ant Design
- Mapas: react-leaflet. PROHIBIDO: Google Maps
- CSS: Solo Tailwind. PROHIBIDO: CSS inline, styled-components

### Backend
- TypeScript estricto (strict: true)
- Controllers delgados → logica en /services
- Validacion: Zod en middleware
- Errores: clase AppError con HTTP status codes
- Logging: Pino (structured JSON)
- Rutas: kebab-case (/api/v1/parcels/:id/ndvi-history)
- Versionado: /api/v1/ desde el inicio

### Pipeline Python
- Python 3.11+, type hints obligatorios
- Librerias geo: rasterio, geopandas
- **Procesamiento primario: openEO (CDSE)** — proceso graph al cloud, recibe GeoTIFF en BytesIO (sin disco). Bandas B04+B05+B08+SCL. NDVI + NDRE en una llamada. ~10-50x mas rapido, 25% menos creditos. `USE_OPENEO=true` por defecto.
- **Fallback: OData download** — descarga SAFE ZIP 500MB, extrae bandas, computa localmente. `USE_OPENEO=false` o error de openEO activa fallback automatico.
- **ML anomaly detector V2:** RandomForestClassifier (scikit-learn>=1.4.0), 13 features, 4 clases de severidad. Fallback a V1 threshold si sklearn no disponible. Acepta `modis_baseline_ndvi` y `drought_flag` como señales adicionales (Sprint MPC).
- **NDRE:** Red Edge index = (B08-B05)/(B08+B05). Mas sensible al estres de clorofila que NDVI.
- **NDVI Grid (Intra-Parcela):** `ndvi_grid.py` muestrea pixels del GeoTIFF, interpola con RBF (thin_plate_spline, scipy, UTM EPSG:25830) a grilla uniforme recortada por polígono. Guarda en `ndvi_snapshots` collection. `NdviHeatmap.tsx` + `NdviLegend.tsx` en frontend. Toggle en ParcelDetailPage. CELL_HALF=0.000045°.
- **Sprint MPC (Microsoft Planetary Computer):**
  - `ingestion/planetary_computer.py` — cliente STAC con auto-firma + retry on timeout
  - `ingestion/modis_baseline.py` — baseline NDVI 3-5 años desde MOD13Q1.061 (250m), 12 medias mensuales por parcela
  - `ingestion/climate_context.py` — 30-day actual climate (Open-Meteo ERA5) + climate normals 1995-2024 (Open-Meteo histórico, fallback TerraClimate). Devuelve drought flag (none/mild/moderate/severe) por parcela
  - `build_mpc_baselines.py` — script one-shot idempotente (rate-limit aware: 2s pacing entre parcelas + backoff 5/10/15/20s para 429)
  - Schema: `parcels.modisBaseline` + `parcels.climateBaseline` + `parcels.recentClimate` (todos opcionales, retrocompatibles)
  - Failures NO rompen pipeline Sentinel-2 — try/except wrapping en todas las llamadas MPC/Open-Meteo
- Logging: structlog. Tests: pytest.

### MongoDB
- Collections: plural, lowercase (users, parcels, operations, alerts)
- IDs: ObjectId nativo
- Timestamps: createdAt, updatedAt automaticos
- Indices: unique email, 2dsphere geometry, compound parcelId+date
- PROHIBIDO: referencias circulares, arrays embedded >1000 docs

## Patrones obligatorios
1. Feature-based structure en frontend
2. Service layer en backend (controllers nunca acceden a DB)
3. Schema-first: Zod schemas en packages/shared
4. Error boundaries por feature en React
5. Variables de entorno en .env con validacion Zod al arrancar

## Patrones prohibidos
1. No `any` en TypeScript
2. No logica de negocio en controllers
3. No secrets en codigo
4. No queries directas en componentes React
5. No instalar deps core sin documentar la decision
6. No comentarios obvios

## Datos satelitales disponibles

### CDSE (Copernicus) — Integrado, core pipeline
- **Sentinel-2 L2A:** NDVI, NDRE, SAVI (10m, cada 5 dias) — core pipeline
- **Sentinel-1 SAR:** Coherencia interferometrica via openEO — humedad del suelo
- **Landsat 8-9:** Bandas termicas TIRS — estres hidrico por temperatura superficial
- **CLMS Vegetation Productivity:** NPP basado en FAPAR 200m V2 — productividad real
- **CDSE Embeddings:** Vectores pre-computados de imagenes — clasificacion ML sin CNN

### Microsoft Planetary Computer — Integrado (Sprint MPC, 2026-05-02)
- **MODIS NDVI (MOD13Q1.061):** 250m, 16-day composite, 2000-presente. Baseline histórico 3-5 años por parcela. Autenticación: ninguna. Acceso vía STAC + odc-stac.
- **TerraClimate:** ~4km mensual climatología 1958-2021 (PDSI, PET, precip, tmax/tmin). Fallback de baseline climática.
- **ERA5 (vía Open-Meteo Historical Archive):** Temperatura, precipitación, ET₀ FAO. Tier gratis 10k req/día. Rate-limit-aware con backoff exponencial. Fuente primaria del baseline climático y del 30-day actual.
- **Coste total:** $0. Sin API keys. Globalmente disponible.

### NASA Earthdata — Acceso solicitado, integracion futura
- **VIIRS:** Cobertura diaria baja resolucion (375m-1km) — tendencias regionales (MODIS ya integrado vía MPC).
- **AppEEARS/LP DAAC:** Evapotranspiracion, temperatura superficial, indices de sequia — riesgo aseguradoras
- **FIRMS:** Deteccion incendios tiempo real — alertas quema agricola
- **Landsat historico:** Archivo 40+ anos — analisis temporal largo plazo
- **Nota:** APIs distintas (CMR/STAC), auth separada. No integrar hasta Overwatch.

## Identidad visual AgroM (Identity Sprint v0.1 — heredado)

> Aplicada en puntos de contacto de marca: email transaccional, login, sidebar dashboard. Interior del dashboard sigue con paleta `brand/terra/earth` original para no romper componentes en uso. Migración total a `agrom-*` queda en backlog.

### Tokens Tailwind disponibles
```js
colors.agrom = {
  deep:  '#1B4332',  // brand primary, CTA, headers
  terra: '#E07A3C',  // acento, monogram dot, highlights
  ink:   '#0F2A22',  // texto principal
  paper: '#F4F0E8',  // fondo cálido neutro
  parch: '#E8DDC9',  // fondo bloque diferenciado
  rule:  '#C9A876',  // hairlines, separadores
  muted: '#6B6B5C',  // texto secundario, labels
  // Semánticos:
  alert:   '#B8312F', warning: '#D49343',
  success: '#3A7D44', info:    '#5B7A8F',
}
fontFamily.display = ['Fraunces', 'Georgia', 'Cambria', 'serif']
fontFamily.body    = ['"IBM Plex Sans"', system fallbacks…]
fontFamily.mono    = ['"IBM Plex Mono"', 'SF Mono', 'Consolas', 'monospace']
```

### Assets de marca
- `apps/web/public/brand/agrom-wordmark.svg/.png` — logotipo completo (Agro·M con punto terra)
- `apps/web/public/brand/agrom-monogram.svg/.png` — solo el monograma

### Email transaccional
Service: `apps/api/src/services/emailService.ts` (Gmail SMTP nodemailer alineado con OverWatch). Paleta + tipografía + wordmark aplicados al template HTML. Sender: `SMTP_FROM` env var (default `FitoLink Alertas <juang@systemrapid.io>`, migrar a `AlertasAgrom@systemrapid.io` cuando el alias exista en Workspace).

## Roles de usuario y dashboards
- **farmer:** DashboardHome (mapa+gauge+alertas) · ParcelsPage · ParcelDetailPage · AlertsPage · OperationsPage (kanban)
- **pilot:** PilotDashboardHome · AssignmentsPage (kanban accept/reject) · CompleteOperationForm · OperationDetailPage
- **insurer:** InsuranceDashboardHome · B2BParcelsPage (filtros riesgo) · B2BAlertsPage (confianza IA)
- **admin:** AdminDashboardHome (stats globales) · AdminUsersPage · `GET /admin/users` (protegido)
- **agronomist:** Planificado (futuro)

## Estado de sprints (4 mayo 2026)
| Sprint | Estado |
|--------|--------|
| Sprint 1: Core + NDVI pipeline | ✅ Done |
| Sprint Piloto: flujo farmer↔pilot | ✅ Done |
| Sprint UI Wow: NdviChart+gradient, ParcelMap, HealthScoreGauge, Kanban | ✅ Done |
| Sprint GEE: openEO cloud processing + NDRE | ✅ Done |
| Sprint ML: RandomForest V2 + feature extractor 13 features | ✅ Done |
| Sprint Multi-rol: Insurer + Admin dashboards | ✅ Done |
| Toasts: feedback actions (Zustand toastStore) | ✅ Done |
| Deploy staging (srs-staging, Docker, seed) | ✅ Done 2026-03-29 |
| Fix demo login + favicon | ✅ Done 2026-03-29 |
| Fix white screen (stale token logout) | ✅ Done 2026-03-29 · commit b42f5fa |
| Sprint Icons: custom SVG icons en toda la app | ✅ Done 2026-03-31 |
| Fix: botón "Ver todas" reset mapa a todas las parcelas | ✅ Done 2026-03-31 |
| AdminUsersPage: grid cards en vez de filas horizontales | ✅ Done 2026-03-31 |
| Sprint Intra-Parcela: NDVI heatmap overlay en ParcelDetailPage | ✅ Done 2026-04-01 |
| LandingPage: sección PAC Pain (evidencia técnica cumplimiento PAC) | ✅ Done 2026-04-01 |
| Sprint Marketplace: Red de Proveedores (pilotos AESA con mapa CartoDB) | ✅ Done 2026-04 |
| Sprint Servicios: catálogo on-demand (6 tipos drone) + DJI banner | ✅ Done 2026-04 |
| Sprint Dispatch: kanban admin (Pendientes/Asignadas/En vuelo/Completadas) | ✅ Done 2026-04 |
| Sprint Unified Dashboards: pilot/insurer/admin con layout farmer | ✅ Done 2026-04 |
| Sprint MPC: MODIS baseline 5y + Open-Meteo climate + drought signal | ✅ Done 2026-05-02 · commits bc7e44b, 83d85e9 |
| MPC: TerraClimate → Open-Meteo migration + 429 rate-limit handling | ✅ Done 2026-05-03 · commits 4f175b0, cf9f9f6 |
| MpcContextWidget en ParcelDetailPage (3 columnas: NDVI 5y / clima normal / 30d real) | ✅ Done 2026-05-02 |
| Sergio Valverde (ASAJA) demo button + onepager PDF Botanical Telemetry | ✅ Done 2026-05-03 · commit 297f047 |
| SRS sweep: gzip nginx system-wide (-71.8% egress en JS bundle) | ✅ Done 2026-05-04 |

## Deploy
- **URL:** https://fitolink.systemrapid.io/login?demo
- **Server:** srs-staging (100.110.52.22) · `/opt/fitolink/`
- **Stack:** Docker Compose (web:3040 + api:4040 + mongo:6040) + Nginx reverse proxy + Certbot SSL + gzip system-wide
- **Redeploy:** `ssh root@100.110.52.22 "bash /opt/fitolink/deploy.sh"` (git pull + build + up + seed)
- **Build baselines MPC:** `ssh root@100.110.52.22 "cd /opt/fitolink && docker compose exec -T pipeline python -m src.build_mpc_baselines"` (idempotente — sólo procesa parcelas sin baseline; añadir `--refresh` para forzar)
- **TS fixes en build:** `import { User }` named export en admin.ts · `height` como string en ParcelMap · `company?` en User type · `areaHa?` en B2BParcelsPage
- **Fix demo login:** `VITE_API_URL` en `.env` raíz tenia `localhost:4040` embebido en build. Fix: `VITE_API_URL=` vacío + `apps/web/.env.production`
- **Favicon:** `apps/web/public/favicon.svg` creado (círculo verde + trigo + señal satelital)
- **GitHub:** https://github.com/gutierrezbj/fitolink · latest commit `297f047`
- **Nginx gzip:** `/etc/nginx/nginx.conf` http block con `gzip_types` extendido (text/css, application/javascript, application/json, application/geo+json, application/wasm, image/svg+xml, font/ttf, font/otf). `gzip_min_length 1024`, `gzip_comp_level 6`. Backup: `/etc/nginx/nginx.conf.bak.20260504-094222`. Brotli no disponible en Ubuntu 22.04 jammy stock.
- **SVG icons en public/:** farmer, drone-pilot, drone, insurance2, location, operational-system, siren, system-administration, user, setting, smart-farming, vegetables, favicon

## API Response Format
```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: { code: string, message: string, details?: unknown } }

// Paginated
{ success: true, data: T[], meta: { total: number, page: number, limit: number } }
```

## Estado comercial (4 mayo 2026)
- **Producto**: en producción técnica, sin clientes aún. Validación con explotaciones reales pendiente para temporada 2026.
- **Datos demo**: 13 parcelas con coordenadas REALES de zonas agrícolas españolas (Estepa olivar, Ribera del Duero, La Rioja, Castilla-La Mancha). Cobertura MPC 13/13/13 (MODIS · clima histórico · clima 30d). Datos satelitales 100% reales — el único "demo" es la cartera de propietarios.
- **Equipo operativo**: AgroXdron + Drovinci como partners reales, no ficticios. Pilotos AESA propios con equipo certificado.
- **Outreach activo**:
  - **ASAJA** — Sergio Valverde (Jefe de Formación) contactado por teléfono. Email v3 + onepager PDF preparados (`docs/asaja-onepager/`). Demo button personalizado "Sergio · ASAJA" en login (`googleId: demo-sergio-asaja`, rol admin). Pendiente envío + videollamada.
  - **DJI Developer Program** — FitoLink es miembro. Webhook DJI Cloud API (auto-sync flight logs) en pipeline técnico de alta prioridad.

## Onepager ASAJA — `docs/asaja-onepager/`
- **PDF**: `FitoLink_ASAJA_Onepager.pdf` (A4, 73 KB, listo para adjuntar)
- **Filosofía de diseño**: "Botanical Telemetry" (`design-philosophy.md`) — cruce entre lámina botánica científica y lenguaje de telemetría aeroespacial
- **Tipografía**: Crimson Pro (serif) + Bricolage Grotesque (sans) + IBM Plex Mono (instrumentación)
- **Generador**: `build_onepager.py` (reportlab) — reproducible, regenerar tras cambios de marca

## Pipeline técnico priorizado (post 2026-05-04)
1. **Onboarding flow farmer** — registro + dibujo parcela / SIGPAC import → primera lectura NDVI < 5 min
2. **SIGPAC import real** — referencia catastral → polígono real (hoy hay sólo lookup demo)
3. **Notificaciones email** — alerta crítica → email al farmer con texto enriquecido (NDVI vs baseline)
4. **DJI Cloud API webhook** — fin de vuelo en DJI → auto-rellena flightLog en operación
5. **Distribuidores fitosanitarios widget** — productos cercanos a la parcela cuando hay alerta
6. **Asesor FitoLink** — formulario contacto agrónomo desde alerta
7. **DJI .kml/.kmz importer** — tracklog del vuelo sobre el polígono (refuerza cuaderno PAC)
