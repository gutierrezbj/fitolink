# FitoLink — Reglas de Desarrollo

## Que es FitoLink
Marketplace on-demand que conecta agricultores con pilotos de drones certificados para aplicaciones fitosanitarias, potenciado por deteccion satelital de anomalias vegetales via Copernicus (Sentinel-2).

## Stack
- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS + Zustand + TanStack Query + React Router v7 + react-leaflet + Recharts
- **Backend:** Node.js + Express 5 + TypeScript + MongoDB (Mongoose) + JWT + Google OAuth + Zod + structlog
- **Geo Pipeline:** Python 3.11 + openeo>=0.26.0 + rasterio + scikit-learn>=1.4.0 + scipy>=1.11.0 + numpy + pymongo + schedule
- **Infra:** Docker multi-stage + Nginx + VPS staging 187.77.71.102 (Web:3040, API:4040, Mongo:6040)

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
- **ML anomaly detector V2:** RandomForestClassifier (scikit-learn>=1.4.0), 13 features, 4 clases de severidad. Fallback a V1 threshold si sklearn no disponible.
- **NDRE:** Red Edge index = (B08-B05)/(B08+B05). Mas sensible al estres de clorofila que NDVI.
- **NDVI Grid (Intra-Parcela):** `ndvi_grid.py` muestrea pixels del GeoTIFF, interpola con RBF (thin_plate_spline, scipy, UTM EPSG:25830) a grilla uniforme recortada por polígono. Guarda en `ndvi_snapshots` collection. `NdviHeatmap.tsx` + `NdviLegend.tsx` en frontend. Toggle en ParcelDetailPage. CELL_HALF=0.000045°.
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

### NASA Earthdata — Acceso solicitado, integracion futura
- **MODIS/VIIRS:** Cobertura diaria baja resolucion (250m-1km) — tendencias regionales
- **AppEEARS/LP DAAC:** Evapotranspiracion, temperatura superficial, indices de sequia — riesgo aseguradoras
- **FIRMS:** Deteccion incendios tiempo real — alertas quema agricola
- **Landsat historico:** Archivo 40+ anos — analisis temporal largo plazo
- **Nota:** APIs distintas (CMR/STAC), auth separada. No integrar hasta Sprint ML o Overwatch

## Roles de usuario y dashboards
- **farmer:** DashboardHome (mapa+gauge+alertas) · ParcelsPage · ParcelDetailPage · AlertsPage · OperationsPage (kanban)
- **pilot:** PilotDashboardHome · AssignmentsPage (kanban accept/reject) · CompleteOperationForm · OperationDetailPage
- **insurer:** InsuranceDashboardHome · B2BParcelsPage (filtros riesgo) · B2BAlertsPage (confianza IA)
- **admin:** AdminDashboardHome (stats globales) · AdminUsersPage · `GET /admin/users` (protegido)
- **agronomist:** Planificado (futuro)

## Estado de sprints (31 marzo 2026)
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

## Deploy
- **URL:** https://fitolink.systemrapid.io/login?demo
- **Server:** srs-staging (100.110.52.22) · `/opt/fitolink/`
- **Stack:** Docker Compose (web:3040 + api:4040 + mongo:6040) + Nginx reverse proxy + Certbot SSL
- **Redeploy:** `ssh root@100.110.52.22 "bash /opt/fitolink/deploy.sh"` (git pull + build + up + seed)
- **TS fixes en build:** `import { User }` named export en admin.ts · `height` como string en ParcelMap · `company?` en User type · `areaHa?` en B2BParcelsPage
- **Fix demo login:** `VITE_API_URL` en `.env` raíz tenia `localhost:4040` embebido en build. Fix: `VITE_API_URL=` vacío + `apps/web/.env.production`
- **Favicon:** `apps/web/public/favicon.svg` creado (círculo verde + trigo + señal satelital)
- **GitHub:** https://github.com/gutierrezbj/fitolink · latest commit `461f9b2`
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
