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
| Sprint Demos Comerciales: 4 dashboards demoneables + weather widget | ✅ Done 2026-05-09 · commits 8ec231b, 362aa64, 3efd8a7 |
| Sprint Cooperativa: nuevo rol `cooperative` + agregación de socios + endpoint `/cooperative/overview` | ✅ Done 2026-05-09 |
| Weather forecast widget (Open-Meteo 7d + suitability badges drone) en ParcelDetailPage | ✅ Done 2026-05-09 |
| Sprint Ola 1.1: Email notifications (Resend → migrado a Gmail SMTP nodemailer) | ✅ Done 2026-05-11 · commit 9ac556e |
| Sprint Ola 1.2: Learned baseline per parcel (override sobre detector V2) | ✅ Done 2026-05-11 |
| Sprint Ola 1.3: Alerts timeline analytics en AdminDashboardHome (Recharts) | ✅ Done 2026-05-11 |
| Identidad AgroM en frontend: paleta + Fraunces/Plex/Mono + wordmark en login + sidebar | ✅ Done 2026-05-11 · commit 0227846 |
| Email Gmail SMTP LIVE con Workspace (App Password juang@systemrapid.io) | ✅ Done 2026-05-11 |
| Material comercial: pitch deck 5 slides (PPTX+PDF) + infografía A4 (PDF+JPG) para cliente pistacho | ✅ Done 2026-05-12 · commits 67e7414, c964d2c |
| Ola 1.5 · Pieza 1: NDVI forecast (linear regression + critical-threshold projection per parcel) | ✅ Done 2026-05-12 |
| Ola 1.5 · Pieza 2: Weather events 7d (7 reglas Open-Meteo: cold/warm front, storm, helada, calor, viento) | ✅ Done 2026-05-12 |
| Ola 1.5 · Pieza 3: Pest advisories curados (admin emite RAIF/MAPA, 2dsphere + haversine por crop+radius) | ✅ Done 2026-05-12 |
| Ola 1.5 · Pieza 4: Morning digest 7am (orquesta P1+P2+P3, email AgroM editorial, cron guardado por DIGEST_CRON env) | ✅ Done 2026-05-12 · commit c895432 |
| Pistacho client: PDF Informe Técnico personalizado + reactivación 6 parcelas + demo button "Pistachar (Cliente)" | ✅ Done 2026-05-12 · commit 1aec910 |
| Agrodex (Gregorio Becerra) — presentación entregada, interés en meterlo en cursos de formación | ✅ 2026-05-12 (validación cualitativa) |
| Sprint Alta usuarios · Ronda 1: T&C + Privacidad + checkbox /register + audit trail RGPD + cooperative en role picker | ✅ Done 2026-05-12 · commit 73e073c |
| Sprint Alta usuarios · Ronda 2: Empty state DashboardHome + aviso "5 días" ParcelDetailPage + emails bienvenida + email primera parcela (idempotente) | ✅ Done 2026-05-12 · commit 44d3640 |
| Sprint Alta usuarios · Ronda 3: PricingPage modelo C (gratis monitor + dron €/ha sales-led) + formulario "Solicitar demo" → POST /contact/demo-request → email a JuanCho + cc Jonh con reply-to al prospect | ✅ Done 2026-05-12 · commit 5b3c15f |
| Sweep Honestidad: 26 afirmaciones falsas corregidas en copy comercial (PricingPage + LandingPage + ServicesPage + PrivacyPage + docs/comercial). Riesgo legal de publicidad engañosa eliminado. Regla CRITICAL_no_inventar establecida en memoria del proyecto | ✅ Done 2026-05-12 · commit a4b3281 |
| Feedback loop IA: Alert.detectionFeatures (17 floats) snapshotea features del detector V2; retrain_from_ground_truth.py reentrena RF cuando hay >=20 alerts resueltas; fix Open-Meteo pacing 300ms para evitar HTTP 429 | ✅ Done 2026-05-13 · commit e532282 |
| Sprint Contexto del Cultivo: helper `inferCoverLevel` en packages/shared + matización en 5 sitios (badge térmico MpcContextWidget, mensaje digest matutino, pill NdviForecastCard, diagnóstico isCritical, stressPct intra-parcela, supresión alerts pipeline V2). Cierra falsos positivos en parcelas con `establishmentPhase=true` | ✅ Done 2026-05-13 · commits a7de5b3, 30faa95, 7d912a8 |
| Seed `closeEstablishmentFalsePositives.ts`: cierra alerts legacy del detector pre-fix en parcelas en establecimiento como `resolved · false_positive` (2 cerradas en producción · ZONA 2 pistachar Jonh) | ✅ Done 2026-05-13 · commit 322efc4 |
| Dominio @agrom.es operativo (Hostinger): johnj/giusepper/gerardop. `DEMO_REQUEST_CC` + email del cliente pistacho migrados a `johnj@agrom.es`. SMTP sender se queda en AlertasAgrom@systemrapid.io. Giuseppe + Gerardo (comerciales) documentados sin enganchar al flujo | ✅ Done 2026-05-13 · commit e8c7f59 |
| Identity Sweep · paleta unificada: eliminada `agrom-*` (efímera mayo). 244 ocurrencias web + 145 referencias HTML emails migradas a paleta histórica FitoLink (brand/terra/earth + grays Tailwind nativos) | ✅ Done 2026-05-13 · commits 578cf16 + c82d427 |
| Identity Sweep · verde editorial alineado a `brand-600 #46632e` (mismo que el botón "Acceder" de la landing) en lugar de `brand-700`. Hover states bajan a `brand-700` | ✅ Done 2026-05-13 · commit c82d427 |
| Identity Sweep · tipografía unificada: fuera Fraunces + IBM Plex Sans (efímera mayo). Sistema oficial = Instrument Serif (display) + DM Sans (body) + IBM Plex Mono (eyebrows). Google Fonts <link> reducido en index.html + email HTML | ✅ Done 2026-05-13 · commit 05b514b |
| Identity Sprint AgroOps v0.2 en Notion: hereda de FitoLink (no de AgroM directo). Cambio comunicado a sesión paralela `gutierrezbj/AgroOPs` antes de que la sesión construya UI sobre tokens v0.1 obsoletos | ✅ Done 2026-05-13 · Notion only |
| Jerarquía marca AgroM/FitoLink · Fase 1 (landing pública): navbar wordmark AgroM + eyebrow mono "FitoLink · del pixel al tratamiento". Footer "© 2026 AgroM — Inteligencia agraria de precisión". `<title>` y meta description "AgroM · FitoLink". Cierra la disonancia entre la puerta SEO (decía "FitoLink") y la puerta comercial (correos desde @agrom.es) | ✅ Done 2026-05-14 · commit a0e9a68 |
| Jerarquía marca AgroM/FitoLink · Fase 2 (sweep 9 páginas): auditoría completa. Regla de oro aplicada — relación humana/sello/programa → AgroM, panel/módulo/sección → FitoLink. 7 ediciones: badge "AgroM ✓" en Marketplace, "equipo de AgroM te contactará", "certificada por AgroM", "experto de AgroM", "programa AgroM para cooperativas". Auth/legal/dashboard ya estaban correctas | ✅ Done 2026-05-14 · commit d9ac5d7 |
| Markers Marketplace armonizados: dron top-down con cuerpo central + 4 brazos + 4 motores (vs cruz X + 4 puntos anterior). Providers ahora con glifo blanco por categoría: botella (distribuidor), hoja con nervio (asesor), 3 cabezas (cooperativa). Halo `r*1.4/0.18` → `r*1.2/0.14`. Radio base 14/18 → 12/15 | ✅ Done 2026-05-14 · commits fd0f4db + 4ff379b |
| Sprint Carnaval Parcela: MpcContextWidget + WeatherWidget armonizados al lenguaje editorial. Gradientes blue/sky → header `bg-brand-600` + eyebrow `§ XXX · FUENTE`. Emojis decorativos eliminados (💧🌡☔🌬🛰💨). Toggle Fitosanitario/Inspección recolor a brand-700. Las 7 secciones de la página de parcela hablan ahora el mismo dialecto | ✅ Done 2026-05-14 · commit a91383d |
| DNS `agrom.es` setup (Opción A: AgroM empresa + FitoLink producto): DKIM Hostinger verificado (selectores hostingermail-a/b/c). DMARC `p=none` añadido. Buzón `alertas@agrom.es` pendiente de crear. Subdominio `fitolink.agrom.es` bloqueado por bug del panel Hostinger — A record borrado del UI sigue publicado en la zona junto al CNAME nuevo (RFC 1034 invalid, ghost record). Ticket a Hostinger pendiente | 🟡 Parcial 2026-05-14 · Notion only |
| ⚠️ INCIDENTE prod offline 14-may: durante manipulación DNS de `agrom.es` en Hostinger se borró por accidente el A record `fitolink → 187.77.71.102` en la zona `systemrapid.io` (mismo panel, fácil cruzar dominios). Resultado: `fitolink.systemrapid.io` NXDOMAIN, producción inaccesible. Resuelto 18-may sin restaurar DNS: decisión JuanCho de retirar el dominio viejo definitivamente, todo el tráfico vive ahora en `fitolink.agrom.es`. Ver entrada glossary `fitolink.systemrapid.io · retirado 18-may-2026` | ✅ Resuelto 2026-05-18 |
| Retirada `fitolink.systemrapid.io`: 18-may JuanCho regresa de viaje y `fitolink.agrom.es` ya está completamente operativo (DNS A + cert Let's Encrypt + bundle desplegado). Decisión: matar `fitolink.systemrapid.io` definitivamente. Sweep en 7 archivos: `STAGING_BASE` constante en emailService.ts (afecta a 4 emails: digest, alerta crítica, welcome, primera parcela) → `https://fitolink.agrom.es`. TermsPage referencia legal. `build_informe_pistachar.py` API_BASE. `build_onepager.py` pie ASAJA. README.md (favicon + demo link). OVERWATCH.md URL operativa. CLAUDE.md URL deploy. Cero referencias activas a `systemrapid.io` en código .ts/.tsx/.html/.py. nginx del VPS conserva server block pero sin DNS, queda inerte | ✅ Done 2026-05-18 |
| Sprint Contexto del Cultivo · Iteración 6: HealthScoreGauge respeta `establishmentPhase`. Cuando `inferCoverLevel({ndvi, establishmentPhase})==='low'`, el dial pinta en gris-neutro con etiqueta "En establecimiento" en lugar de "Crítico" rojo. Conectado en 4 consumidores: ParcelDetailPage, DashboardHome (admin worstParcel), ParcelsPage, B2BParcelsPage. Cierra la disonancia "gauge gritando vs resto del UI diciendo sin acción" detectada al revisar ZONA 1 de Jonh | ✅ Done 2026-05-18 · commit acb2686 |
| Sprint Calibración del Cultivo · 1 (modelo + endpoint): nuevos campos `Parcel.plantingYear?: number` + `Parcel.calibratingUntil?: Date`. Helper `inferEstablishmentFromAge(crop, year)` en shared con tabla `ESTABLISHMENT_YEARS` (pistacho 7, olivo 5, almendro/cítrico/frutal 4, viñedo 3). Helpers `isCalibrating(parcel)` + `calibrationDaysLeft(parcel)`. `parcelService.createParcel` aplica `applyCalibrationOnCreate`: con `plantingYear` → deduce establishmentPhase + sin calibración; sin `plantingYear` → calibratingUntil = hoy + 60d | ✅ Done 2026-05-18 |
| Demo Aula Jaén Jesús (cuenta pedagógica): seed idempotente `seedProfessorDemo.ts` crea usuario `jesus-vivar-edu` (Jesús Vivar, jesusvivar22@gmail.com) con 6 parcelas sintéticas Jaén ilustrando escenarios canónicos de agricultura precisión (olivar sano, intensivo seto, pistachar calibrando sin plantingYear, almendro establecimiento informado, olivar estrés hídrico con alerta crítica activa + Operation completada, olivar heterogéneo). Nuevo flag `Parcel.isSyntheticDemo: boolean` → pipeline V2 + build_mpc_baselines.py ignoran estas parcelas (no sobrescriben datos hand-crafted). Botón demo "Aula Jaén Jesús" en LoginPage. Para clases del profesor en su curso UPM-Jaén. **Estado 22-may**: aparcado tras iteraciones v1.0→v1.4 — polígonos formal/visualmente correctos pero coords ciegas pinchan cortijos. Pendiente decisión SIGPAC vs hand-crafted GeoJSON (ver task #12). | 🟡 Aparcado 2026-05-22 |
| Sprint SoilGrids (BACKLOG · alto valor pedagógico + comercial): integrar SoilGrids 250m de ISRIC para añadir dimensión SUELO al ecosistema FitoLink. Hoy el sistema interpreta NDVI sin saber nada del suelo subyacente — un NDVI 0.42 sobre arcilla 62% significa cosa muy distinta que sobre arena 70%. Plan: (1) descarga raster GeoTIFF para Andalucía + La Mancha por capa (clay, sand, silt, organic carbon, water capacity, 6 profundidades 0-200cm); (2) servicio backend `soilService.getProfileForParcel(geometry)` devuelve textura media + heterogeneidad espacial; (3) card nueva `§ SUELO · SOILGRIDS 250M` en ParcelDetailPage; (4) integración en mensajería contextual (`lowCoverNote`, `isCritical`, digest matutino) — el mismo NDVI dice cosas distintas según suelo. Diferenciador: Hemav/xFarm/Auravant no exponen SoilGrids. Aprovechable para B2B aseguradora (factor riesgo) + B2B cooperativa (caracterización cartera socios). ~3 días dev. Decisión 22-may JuanCho: priorizado sobre SMAP/Sentinel-1 SAR porque añade dimensión NUEVA (no duplica drought signal existente). | ⏸ Backlog 2026-05-22 |
| Sprint Calibración del Cultivo · pasos 2+3 (UI alta + UI calibrando): render del campo `plantingYear` + radio "no lo sé" + feedback contextual reactivo en CreateParcelPage. HealthScoreGauge muestra "Calibrando · faltan X días" en gris-tierra (`#d4a85a`) en vez de "Crítico" rojo cuando `isCalibrating()===true`. Banner editorial en ParcelDetailPage explicando modo Calibración. NdviForecastCard sustituye proyección crítica por card "PROYECCIÓN — EN CALIBRACIÓN" con barra progreso X de 8 lecturas. 4 Parcel types frontend extendidos con `calibratingUntil?: string \| null`. Cierra disonancia "agricultor nuevo recibe CRÍTICO el día 1" — ahora ve "te observamos 60 días antes de diagnosticar" | ✅ Done 2026-05-18 · commit c00ff45 |
| Sprint Calibración del Cultivo · paso 4 (pipeline + digest suaves): pipeline V2 suprime alerts severity high+critical mientras `calibratingUntil > now` (guard en `pipeline.py` después del establishmentPhase check, log entry `alert_suppressed_calibrating`). `predictiveInsightService.computeNdviForecast` acepta `calibratingUntil` y devuelve mensaje suave informativo en lugar de proyección absoluta cuando calibrando: *"[name] sigue calibrándose. Faltan X días para que el sistema conozca el patrón normal..."*. Cierra Sprint Calibración del Cultivo completo (4 pasos LIVE) | ✅ Done 2026-05-18 · commit 27ff23c |
| Aula Jaén v2 · SIGPAC catastral REAL: cierra el sprint Aula Jaén iniciado 18-may tras 4 iteraciones v1.x con polígonos sintéticos que pinchaban cortijos. Reemplaza el sistema `realisticPolygon` (octógonos perturbados perpendicularmente) por descarga directa de geometrías catastrales oficiales desde SIGPAC vía `fetchByReference()` del sigpacService ya existente. 6 referencias catastrales reales Jaén verificadas: Albanchez Sierra Mágina (23/1/0/0/10/15/1 OV 1.92ha) + Sabiote La Loma (23/74/0/0/3/1/1 OV 5.71ha) + Frailes pistachar (23/31/0/0/3/5/1 FY 2.47ha) + Quesada almendro (23/70/0/0/3/5/1 FY 0.38ha) + Mancha Real olivar estrés (23/61/0/0/3/5/1 OV 2.43ha) + Andújar Sierra Morena (23/5/0/0/15/5/1 OV 1.29ha). Cualquier alumno puede pegar la ref en https://sigpac.mapa.gob.es/fega/visor/ y ver la misma geometría. Cero invento. Sigue patrón AgroM: ciencia auditable, no marketing | ✅ Done 2026-05-22 · commit f4cc352 |
| Sprint SoilGrids · A (backend service): cliente ISRIC SoilGrids v2.0 REST API en `apps/api/src/services/soilService.ts`. Schema `Parcel.soil?: ISoilProfile` con clay/sand/silt %, organic carbon g/kg, bulk density g/cm³, field capacity volumétrica, dominantTexture USDA castellanizado, sampledAt lat/lng. `fetchSoilProfileForPoint(lat,lng)` agrega capas 0-5/5-15/15-30 cm con pesos por espesor, convierte unidades crudas, renormaliza texturas a sumar 100, computa textura USDA simplificada en 7 familias agronómicas reconocibles. Endpoint POST /parcels/:id/soil/refresh manual. Auto-fetch fire-and-forget en `createParcel` y `createParcelsBulk`. Si ISRIC falla, log + skip — no rompe la creación de parcela. A diferencia de enrichments MPC (temporales), suelo es PERMANENTE — fetch una vez, queda forever | ✅ Done 2026-05-22 · commit 35d0140 |
| Sprint SoilGrids · B+C (UI card + mensajería contextual): `SoilProfileCard.tsx` armonizado con MpcContextWidget. Banner principal con textura dominante ("Franco arenoso") + 3 barras horizontales arcilla/arena/limo + 3 métricas (cap. agua disponible, carbono orgánico, densidad aparente). Footer técnico con coords centroide + botón "Refrescar". Empty state con CTA "Calcular perfil de suelo" cuando aún no hay datos. Montado en ParcelDetailPage tras MpcContextWidget. `lowCoverNote` en shared cropContext acepta perfil suelo opcional y matiza mensaje según textura — arcilla ≥35% añade "su suelo retiene agua varios días más que los arenosos", arena ≥65% añade "drena rápido, vigile próxima ventana lluvia". `predictiveInsightService` pasa parcel.soil a `lowCoverNote` cuando cover='low'. Cierra Sprint SoilGrids completo (A+B+C LIVE) | ✅ Done 2026-05-22 · commit b1fc9f8 |
| Sprint FIRMS · A+B (cliente NASA + UI card § FOCOS TÉRMICOS): nuevo ALERT_TYPE `fire_proximity` en shared. `apps/api/src/services/fireService.ts` cliente NASA FIRMS API (VIIRS Suomi-NPP + NOAA-20, 375m resolución, ~3h latencia). `env.FIRMS_MAP_KEY` (registro gratis NASA EARTHDATA). Endpoint GET /parcels/:id/fires con query params radiusKm/days/includeLow. `FireProximityCard.tsx` con banner ROJO destacado si foco <5km + lista ordenada por distancia con fecha/hora/satélite/brillo/FRP/confianza/día-noche. Empty state "Sin focos activos" para invierno. Montado en ParcelDetailPage tras WeatherWidget — riesgo incendio se interpreta junto al calor previsto. Crítico en verano mediterráneo: agricultor recibe aviso antes de verlo en redes | ✅ Done 2026-06-04 · commit bc5015e |
| Sprint FIRMS · C (Alerts persistent + digest matutino destacado): Alert model extendido con `fireProximityKm` + `fireSource`. ndviValue/ndviDelta ahora con default 0 (no aplican a fire alerts). DigestPayload nuevo campo `fireSection: DigestFireProximity[]`. `composeDigestForUser` itera parcelas + llama FIRMS por cada una (radio 5km, 7 días). `maybeCreateFireAlert` crea Alert con dedupe básico (uno por parcela mientras esté abierto). Severity inferida: critical si <2km, high si 2-5km. Email digest renderiza nueva sección "§ 00 · FOCOS TÉRMICOS CERCANOS" al inicio con banner rojo. digestSubject añade prefijo ⚠️ con count si hay focos críticos. Cierra Sprint FIRMS completo (A+B+C LIVE en prod) | ✅ Done 2026-06-04 · commit 8118a09 |
| Sprint Visor SIGPAC público (`/sigpac`): página standalone sin login que sustituye al horrible visor oficial MAPA (UI 2010, lento, no compartible). Componente nuevo `SigpacViewerPage.tsx` con hero editorial + form 7 campos + mapa Leaflet 460px tiles Esri World Imagery + polígono catastral en **terra-500 naranja brand** (visible sobre satellite vs verde brand que se camuflaba) + card "DATOS DEL RECINTO" con botón sólido "Buscar otra parcela" arriba derecha. Sección "§ TIEMPO EN SU PARCELA · HOY" con Open-Meteo + banner candado "los 6 días siguientes están a un click" → CTA `/register`. URL parametrizada `/sigpac/:prov/:muni/:agre/:zona/:pol/:par/:rec` para enlaces compartibles SEO-friendly. Link "Visor SIGPAC" añadido en navbar + footer de LandingPage. Endpoint `/api/v1/sigpac/lookup` ya era público. Lead magnet comercial + diferenciador SEO. 6 commits iterativos por feedback usuario en testing | ✅ Done 2026-06-04 · commits 948328d / 9c8a508 / b10a29d / 34733de / bbc58a5 |
| Decisión PM · campaña 2026: aseguradoras APARCADAS hasta 2027+ (ciclo comercial 5+ años, ROI no retorna). Foco campaña 2026: **Tipo A/B agricultor + Cooperativa olivar + Comunidad de Regantes (sequía + RD 950/2024) + ADV (Agrupación Defensa Vegetal)**. La ADV es match perfecto con stack actual sin código nuevo casi — 1 técnico + N socios encaja en modelo cooperative ya existente con sólo añadir rol `adv` + UI labels. Eliminada del roadmap toda dependencia con Elevenais (blockchain eIDAS) — el copy comercial ya no menciona blockchain desde Sweep Honestidad 12-may. Regla operativa nueva: "el launch va con lo nuestro" — no bloquear MVP por dependencias externas no validadas. APIs externas SÍ usables sin riesgo: organismos científicos/gubernamentales públicos (Copernicus, MPC, NASA FIRMS, ISRIC, SIGPAC, Open-Meteo) — no partners comerciales privados | 📋 Decisión 2026-06-04 |
| Sprint Visor SIGPAC mejoras · card "§ COMPARTIR Y EXPORTAR" con 4 botones que multiplican valor del lead magnet: **WhatsApp** (wa.me/?text=... con texto preformateado SIGPAC ref + uso + Ha + URL) para viralidad en grupos cooperativa, **Google Maps** (centroide del polígono via maps.google.com/?q=lat,lng) para piloto-dron / agricultor navegando a finca, **KML download** (formato KML 2.2 OGC con style terra-500, compatible DJI GS Pro / Litchi / DroneDeploy / Pix4D / QGIS) para piloto-dron carga directa en misión de vuelo, **GeoJSON download** (Feature con properties sigpacRef/cropUse/areaHa) para QGIS / asesor agrónomo. Helpers nuevos `buildKmlFromGeometry()` + `escapeXml()` + `downloadBlob()` (Blob + createObjectURL + click sintético + cleanup retardado Safari). Sin cambios backend | ✅ Done 2026-06-05 · commit 71ec2ee |
| Sprint Rol ADV · constants + UI labels + dashboard básico. Añadido `'adv'` al array `USER_ROLES` (shared/constants.ts). Componente nuevo `AdvDashboardHome.tsx` con KPI strip (Socios vigilados / Ha vigiladas / Avisos activos / NDVI medio comarca) + mapa agregado parcelas socios + lista socios con NDVI individual + alertas. Reusa endpoint `/cooperative/overview` (mismo shape estructural). RegisterPage añade opción 'adv' con `needsVerification:true`. AdminUsersPage badge color terra (naranja brand) para diferenciar visualmente. DashboardLayout añade NAV_ITEMS.adv + AlertBell. digestService extiende elegibilidad (`farmer ∨ cooperative ∨ adv`) — vigilancia comarcal es exactamente el use case del rol. Empty state editorial específico ADV con onboarding 3 pasos (compartir → vincular en 24h → digest diario). Sprint ½ jornada cumplido | ✅ Done 2026-06-05 · commit XXX |

## Deploy
- **URL:** https://fitolink.agrom.es/login?demo  (`fitolink.systemrapid.io` retirado 18-may-2026)
- **Server:** srs-staging (100.110.52.22) · `/opt/fitolink/`
- **Stack:** Docker Compose (web:3040 + api:4040 + mongo:6040) + Nginx reverse proxy + Certbot SSL + gzip system-wide
- **Redeploy:** `ssh root@100.110.52.22 "bash /opt/fitolink/deploy.sh"` (git pull + build + up + seed)
- **Build baselines MPC:** `ssh root@100.110.52.22 "cd /opt/fitolink && docker compose exec -T pipeline python -m src.build_mpc_baselines"` (idempotente — sólo procesa parcelas sin baseline; añadir `--refresh` para forzar)
- **Morning digest dry-run (Ola 1.5 · Pieza 4):** `ssh root@100.110.52.22 "cd /opt/fitolink && docker compose exec -T api node apps/api/dist/seed/sendMorningDigest.js --user john-pistacho-real --dry-run"` (idempotente, no manda SMTP). Para activarlo de verdad: `DIGEST_CRON=true` en `.env` raíz + restart api. El cron dispara a las 05:00 UTC (07:00 Madrid verano / 06:00 invierno).
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

## Estado comercial (12 mayo 2026)
- **Producto**: en producción técnica, sin clientes aún. Validación con explotaciones reales pendiente para temporada 2026.
- **Datos demo en staging**: 23 parcelas activas (incluye 12 de socios cooperativa DCOOP recién seedeadas, todas con NDVI real tras corrida del pipeline cron). Cobertura MPC completa en parcelas históricas.
- **Equipo operativo**: AgroXdron + Drovinci como partners reales, no ficticios. Pilotos AESA propios con equipo certificado. **Socio operativo: Jonh Yanga Núñez** (autónomo bajo paraguas AgroM).
- **Outreach activo**:
  - **ASAJA** — Sergio Valverde (Jefe de Formación) contactado por teléfono. Email v3 + onepager PDF preparados (`docs/asaja-onepager/`). Demo button personalizado "Sergio · ASAJA" en login (`googleId: demo-sergio-asaja`, rol admin). Pendiente envío + videollamada.
  - **Cliente pistacho (anónimo)** — intermediado por Jonh. Prestó KMZ para pruebas. **12-may**: pitch deck 5 slides + infografía A4 enviada vía Jonh (`docs/comercial/AgroM-FitoLink-Capacidades.pptx/pdf` + `AgroM-FitoLink-Infografia.pdf/jpg`). Sin nombre concreto del cliente para evitar polémica con 100x100.
  - **DJI Developer Program** — FitoLink es miembro. Webhook DJI Cloud API (auto-sync flight logs) en pipeline técnico de alta prioridad.

## Email transaccional (Gmail SMTP LIVE)
- Stack: nodemailer + Workspace systemrapid.io. Service en `apps/api/src/services/emailService.ts` (dual-mode: live si SMTP_* configurado, dry-run con structured log si no).
- Sender: `juang@systemrapid.io` con App Password de Google Workspace. Pendiente: alias `AlertasAgrom@systemrapid.io` (cuando el admin del Workspace lo cree).
- Trigger automático: severidad `critical`/`high` al crear Alert → email al propietario (fire-and-forget, swallow-errors).
- Trigger manual: `POST /alerts/:id/resend-email` (admin only) con `{to, name}` override en body — útil para enseñar el email a un prospecto en demo.
- Plantilla HTML con identidad AgroM (paleta `deep/terra/ink/paper/parch/rule`, Fraunces + IBM Plex Sans + IBM Plex Mono, wordmark real PNG).
- Docker: `apps/api` lee `.env` vía `env_file: .env` para que SMTP_* lleguen al container (recrear con `docker compose up -d --force-recreate api`).

## Material comercial — `docs/comercial/`
- **`AgroM-FitoLink-Capacidades.pptx/pdf`** — pitch deck 5 slides 16:9 wide. Slides: portada / contexto / método 4 capas / informe diario / próximo paso. Identidad AgroM aplicada (paleta + Fraunces fallback Georgia + wordmark). Genérico, sin nombre cliente — adaptable por Jonh en PPTX.
- **`AgroM-FitoLink-Infografia.pdf/jpg`** — infografía A4 vertical "Botanical Cartography". Diseñada para imprimirse y quedarse en la cocina del cliente. Generada con ReportLab + IBM Plex Serif (body) + Helvetica fallback. Una sola página densa pero respirada.
- **Scripts reproducibles**: `build-deck.cjs` (pptxgenjs) y `build_infografia.py` (reportlab). Si cambia la paleta o tipografía, regeneración en 30 seg.
- **Filosofía visual**: `docs/comercial/design-philosophy.md` ("Botanical Cartography" — cruce lámina botánica + cartografía catastral SIGPAC).

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
