# FitoLink — Overwatch Handoff Document

> Documento de referencia completo para validación y desarrollo autónomo.
> Generado: 2026-03-15

---

## 1. VISIÓN DEL PRODUCTO

**FitoLink** es una plataforma de agricultura de precisión que conecta detección satelital (Sentinel-2) con pilotos de drones certificados AESA/ROPO para tratamientos fitosanitarios con trazabilidad completa.

**Flujo principal:**
```
Sentinel-2 (cada 5 días) → NDVI/NDRE → Detección anomalías (IA)
    → Alerta al agricultor → Solicitud de tratamiento
    → Asignación piloto certificado → Aplicación con drone
    → Registro trazable completo
```

**URL staging:** https://fitolink.systemrapid.io
**Repo:** https://github.com/gutierrezbj/fitolink
**Servidor:** 187.77.71.102 (root, /opt/fitolink)

---

## 2. ARQUITECTURA

```
┌─────────────────────────────────────────────────────────┐
│                      NGINX (proxy)                       │
│              :80/:443 → SSL Let's Encrypt                │
├──────────────────────┬──────────────────────────────────┤
│   /  → Web (:3040)   │   /api/ → API (:4040)            │
├──────────────────────┴──────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  React SPA   │  │  Express API │  │  Geo Pipeline │  │
│  │  Vite+TS     │  │  Node+TS     │  │  Python 3.11  │  │
│  │  Port 3040   │  │  Port 4040   │  │  Cron 5 días  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                 │                  │           │
│         └────────┬────────┴──────────────────┘           │
│                  │                                        │
│          ┌───────▼────────┐                              │
│          │   MongoDB 7    │                              │
│          │   Port 6040    │                              │
│          └────────────────┘                              │
└─────────────────────────────────────────────────────────┘
```

**Monorepo (npm workspaces):**
```
fitolink/
├── apps/api/          → Express backend
├── apps/web/          → React frontend
├── packages/shared/   → Tipos, schemas Zod, constantes
├── workers/geo-pipeline/ → Python Sentinel-2 processor
├── docker/            → Dockerfiles + Nginx configs
├── cursos-escuela-gis/ → Material de referencia geoespacial
├── docker-compose.yml → Dev
└── docker-compose.prod.yml → Producción
```

---

## 3. MODELOS DE DATOS

### 3.1 User
```typescript
{
  email:              String     // unique, lowercase, required
  name:               String     // required, trimmed
  role:               Enum       // farmer | pilot | agronomist | insurer | admin
  phone:              String?
  avatar:             String?    // URL
  googleId:           String     // unique, required (OAuth)
  location:           GeoJSON Point?  // 2dsphere index
  // --- Pilot-specific ---
  certifications:     [{ type: String, number: String, expiry: Date }]
  equipment:          [{ model: String, type: String, payloadKg: Number }]
  operationalRadiusKm: Number?
  // --- Farmer-specific ---
  cooperativeId:      ObjectId?  // ref User
  // --- Insurer-specific ---
  company:            String?
  contractId:         String?
  // --- Common ---
  isVerified:         Boolean    // default: false
  rating:             Number     // default: 0
  ratingCount:        Number     // default: 0
  createdAt, updatedAt: Timestamps
}
// Indexes: location(2dsphere), role+isVerified(compound)
```

### 3.2 Parcel
```typescript
{
  ownerId:    ObjectId    // ref User, required, indexed
  name:       String      // required, trimmed
  geometry:   GeoJSON Polygon  // required, 2dsphere index
  areaHa:     Number      // required, min: 0.1
  cropType:   Enum        // olivo|vinedo|cereal|girasol|algodon|frutal|
                          // hortaliza|citrico|almendro|arroz|maiz|
                          // remolacha|patata|leguminosa|otro
  province:   String      // required (25 provincias españolas)
  sigpacRef:  String?     // referencia SIGPAC
  isInsured:  Boolean     // default: false
  insurerId:  ObjectId?   // ref User
  ndviHistory: [{
    date:            Date
    mean:            Number
    min:             Number
    max:             Number
    anomalyDetected: Boolean  // default: false
    source:          Enum     // sentinel2 | planet
  }]
  isActive:   Boolean     // default: true (soft-delete)
  createdAt, updatedAt: Timestamps
}
// Indexes: geometry(2dsphere), ownerId+isActive, isInsured+insurerId
```

### 3.3 Alert
```typescript
{
  parcelId:     ObjectId   // ref Parcel, required, indexed
  type:         Enum       // ndvi_drop | ndre_anomaly | stress_pattern
  severity:     Enum       // low | medium | high | critical
  ndviValue:    Number     // valor NDVI actual
  ndviDelta:    Number     // cambio respecto al anterior
  detectedAt:   Date       // default: now
  status:       Enum       // new | notified | acknowledged | resolved
  aiConfidence: Number     // 0-1 (confianza del modelo)
  resolvedBy:   Enum?      // service | false_positive | natural_recovery
  imagery: {
    sentinelScene: String   // ID de la escena Sentinel-2
    tileUrl:       String?  // URL del tile
  }
  createdAt, updatedAt: Timestamps
}
// Indexes: parcelId+status, severity+status, detectedAt(desc)
```

### 3.4 Operation
```typescript
{
  parcelId:      ObjectId   // ref Parcel, required
  farmerId:      ObjectId   // ref User, required
  pilotId:       ObjectId?  // ref User
  agronomistId:  ObjectId?  // ref User
  type:          Enum       // phytosanitary | inspection | diagnosis
  status:        Enum       // requested | assigned | in_progress | completed | cancelled
  alertId:       ObjectId?  // ref Alert (trigger)
  product: {
    name:             String
    activeSubstance:  String
    doseLPerHa:       Number
  }?
  applicationMethod:  String?
  weatherConditions: {
    temp:      Number
    windKmh:   Number
    humidity:  Number
  }?
  flightLog: {
    startTime: Date
    endTime:   Date
    areaHa:    Number
  }?
  prescription: {
    ref:      String
    signedBy: String
  }?
  reportUrl:    String?
  rating: {
    farmer:  { score: Number, comment: String }
    pilot:   { score: Number, comment: String }
  }?
  completedAt:  Date?
  createdAt, updatedAt: Timestamps
}
// Indexes: farmerId+status, pilotId+status, parcelId+createdAt(desc)
```

---

## 4. API ENDPOINTS

**Base:** `/api/v1`

### Auth (`/auth`)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/login` | — | Login Google OAuth (credential) |
| POST | `/login/dev` | — | Login demo (googleId) — dev only |
| POST | `/register` | — | Registro (credential, role, phone?) |
| GET | `/me` | JWT | Perfil del usuario autenticado |

### Parcels (`/parcels`)
| Method | Route | Auth | Roles | Description |
|--------|-------|------|-------|-------------|
| POST | `/` | JWT | farmer | Crear parcela (GeoJSON) |
| GET | `/mine` | JWT | farmer | Mis parcelas (activas) |
| GET | `/:id` | JWT | all | Detalle parcela |
| PUT | `/:id` | JWT | farmer | Actualizar parcela (owner only) |
| DELETE | `/:id` | JWT | farmer | Soft delete (owner only) |
| GET | `/:id/ndvi-history` | JWT | all | Historial NDVI |
| GET | `/` | JWT | admin | Todas las parcelas (paginado) |

### Alerts (`/alerts`)
| Method | Route | Auth | Roles | Description |
|--------|-------|------|-------|-------------|
| GET | `/mine` | JWT | farmer | Alertas de mis parcelas |
| GET | `/active` | JWT | admin | Alertas activas (paginado) |
| GET | `/parcel/:parcelId` | JWT | all | Alertas por parcela |
| PATCH | `/:id` | JWT | all | Actualizar status/resolución |

### Health
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Health check |

---

## 5. FRONTEND

### Stack
React 19, TypeScript, Vite, Tailwind CSS, Zustand, React Router v7, Leaflet, Recharts, Axios, Radix UI

### Páginas y componentes

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/` | LandingPage | Hero + trust bar + proceso + roles + stats + CTA |
| `/login` | LoginPage | Google OAuth + botones demo (farmer/pilot/insurer/admin) |
| `/register` | RegisterPage | Selección rol + Google OAuth |
| `/dashboard` | DashboardLayout → DashboardHome | Stats, alertas recientes |
| `/dashboard/parcels` | ParcelsPage | Mapa Leaflet + lista + detalle + NDVI chart |
| `/dashboard/alerts` | AlertsPage | Lista alertas con severity badges |

### Navegación por rol (sidebar)
- **Farmer:** Inicio, Mis Parcelas, Alertas, Operaciones
- **Pilot:** Inicio, Asignaciones, Historial
- **Insurer:** Inicio, Parcelas Aseguradas, Alertas, Inspecciones
- **Admin:** Inicio, Usuarios, Parcelas, Alertas

### Auth Store (Zustand → localStorage `fitolink-auth`)
```typescript
{ token: string, user: User, isAuthenticated: boolean }
// Methods: login(token, user), logout(), updateUser(user)
```

### API Client (Axios)
- Base URL: `${VITE_API_URL}/api/v1` (vacío = relativo)
- Request interceptor: adjunta Bearer token
- Response interceptor: 401 → redirect `/login`

### Mapa (ParcelMap)
- Color por NDVI: rojo=anomalía, verde=sano, amarillo=warning, naranja=estrés
- GeoJSON polygons, tooltip on hover, click to select, fitBounds

### NDVI Chart (Recharts)
- LineChart: mean, min, max NDVI en el tiempo
- Puntos rojos = anomalías detectadas
- Línea referencia en NDVI 0.4 (umbral alerta)

---

## 6. GEO-PIPELINE (Python)

### Flujo
```
1. MongoDB → parcelas activas
2. Para cada parcela:
   a. Extraer bbox del GeoJSON
   b. Copernicus API → buscar escenas Sentinel-2 (últimos 10 días)
   c. Obtener último NDVI del historial
   d. detect_anomaly(current, historical) → AnomalyResult
   e. Si anomalía → crear Alert en MongoDB
3. Log resultados
```

### Módulos

**ingestion/copernicus.py** — CopernicusClient
- OAuth2 con Copernicus Data Space (token cache 1h)
- `search_sentinel2(bbox, start, end, max_cloud=30%)` → OData query
- `download_product(product_id, output_path)` → ZIP

**processing/ndvi.py**
- `compute_ndvi(nir, red)` → (B08-B04)/(B08+B04)
- `compute_ndre(nir, red_edge)` → (B08-B05)/(B08+B05)
- `compute_parcel_stats(ndvi_array)` → NdviResult(mean, min, max, std, pixels, cloud_fraction)

**alerting/detector.py** — detect_anomaly()
- Thresholds: DROP=0.10, CRITICAL=0.30, HIGH=0.40
- Logic: no drop=ok, drop>0.10=anomaly
- Severity: por NDVI absoluto + delta
- Type: `stress_pattern` si 3+ lecturas en declive
- Confidence: normalizada por magnitud delta + bonus histórico

**config.py**
- CLOUD_COVER_MAX: 50%
- PROCESSING_INTERVAL_DAYS: 5

---

## 7. SHARED PACKAGE

### Constantes (`packages/shared/src/constants.ts`)
```typescript
USER_ROLES:          ['farmer', 'pilot', 'agronomist', 'insurer', 'admin']
OPERATION_TYPES:     ['phytosanitary', 'inspection', 'diagnosis']
OPERATION_STATUSES:  ['requested', 'assigned', 'in_progress', 'completed', 'cancelled']
ALERT_TYPES:         ['ndvi_drop', 'ndre_anomaly', 'stress_pattern']
ALERT_SEVERITIES:    ['low', 'medium', 'high', 'critical']
ALERT_STATUSES:      ['new', 'notified', 'acknowledged', 'resolved']
NDVI_SOURCES:        ['sentinel2', 'planet']
ALERT_RESOLUTIONS:   ['service', 'false_positive', 'natural_recovery']
CROP_TYPES:          [15 cultivos españoles]
PROVINCES:           [25 provincias españolas]
```

### Schemas Zod (`packages/shared/src/schemas.ts`)
- Geometry: pointSchema, polygonSchema
- User: createUserSchema, updateUserSchema, certificationSchema, equipmentSchema
- Parcel: createParcelSchema, updateParcelSchema, ndviReadingSchema
- Operation: createOperationSchema, completeOperationSchema, productSchema, weatherSchema, flightLogSchema
- Alert: createAlertSchema, updateAlertSchema
- Auth: loginGoogleSchema, registerSchema

---

## 8. DOCKER & DEPLOY

### Servicios
| Servicio | Imagen | Puerto | Notas |
|----------|--------|--------|-------|
| mongo | mongo:7 | 6040:27017 | Volume: fitolink-mongo-data |
| api | Dockerfile.api | 4040 | Node 22-alpine, tsc build |
| web | Dockerfile.web | 3040 | Vite build → nginx:alpine |
| geo-pipeline | Dockerfile.geo | — | Python 3.11-slim + GDAL |
| proxy | nginx | 80/443 | SSL Let's Encrypt, reverse proxy |

### Variables de entorno
```
NODE_ENV, PORT, API_URL
MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
COPERNICUS_CLIENT_ID, COPERNICUS_CLIENT_SECRET
RESEND_API_KEY, EMAIL_FROM
VITE_API_URL (vacío=relativo), VITE_GOOGLE_CLIENT_ID
VITE_APP_NAME, VITE_SHOW_DEMO
```

### Deploy commands (staging)
```bash
# Sync local → server
rsync -avz --delete apps/web/ root@187.77.71.102:/opt/fitolink/apps/web/

# Build + restart
ssh root@187.77.71.102 "cd /opt/fitolink && docker compose build --no-cache web && docker compose up -d web"
```

---

## 9. CUENTAS DEMO (seed.ts)

| Rol | googleId | Nombre |
|-----|----------|--------|
| farmer | demo-farmer-001 | María García |
| pilot | demo-pilot-001 | Carlos López |
| insurer | demo-insurer-001 | Ana Martínez |
| admin | demo-admin-001 | Admin FitoLink |

Login dev: `POST /api/v1/auth/login/dev { googleId: 'demo-farmer-001' }`

---

## 10. MATERIAL GEOESPACIAL DISPONIBLE

### Notebooks descargados (`cursos-escuela-gis/`)

#### Estadística Espacial (listos para integrar en geo-pipeline)
| Notebook | Técnica | Aplicación FitoLink |
|----------|---------|---------------------|
| 00_ESDA_Juan.ipynb | EDA espacial, GeoPandas | Análisis exploratorio de parcelas |
| 01_EDA.ipynb | Análisis exploratorio | Distribución de variables de suelo |
| 02_IDW.ipynb | Inverse Distance Weighting | Interpolación NDVI entre puntos |
| 03_RBF.ipynb | Radial Basis Functions | Superficies continuas NDVI (LOO-CV) |
| 04_Kriging.ipynb | Kriging geoestadístico | Interpolación con variogramas |
| 05_Kernel_Density.ipynb | KDE | Mapas de densidad de anomalías |
| 06_Distancia_Euclidiana.ipynb | Distancia euclidiana | Proximidad a zonas de riesgo |
| 07_OLS_Regression.ipynb | Regresión espacial | Modelado variables explicativas |

#### Machine Learning Geoespacial
| Notebook | Técnica | Aplicación FitoLink |
|----------|---------|---------------------|
| ML_Susceptibilidad_Inundaciones.ipynb | GEE + ML (RF) | Mapas de susceptibilidad/riesgo |
| Composicion_Raster_Biomasa.ipynb | GEE + GEDI + RF | Estimación rendimiento cultivos |

#### Deep Learning
| Notebook | Técnica | Aplicación FitoLink |
|----------|---------|---------------------|
| Canopy_Height_1m.ipynb | Meta Trees 1m | Altura vegetación de parcelas |
| Super_Resolucion_S2_DeepLearning.ipynb | SRGAN | Sentinel-2 de 10m → 1m |
| Coberturas_Redes_Neuronales.ipynb | Keras CNN | Clasificación automática de cultivos |

---

## 11. ROADMAP TÉCNICO

### v1.0 (actual) — MVP funcional
- [x] Landing page con trust bar
- [x] Auth Google OAuth + demo accounts
- [x] CRUD parcelas con mapa Leaflet
- [x] Visualización NDVI (historial + chart)
- [x] Sistema de alertas (CRUD + severity)
- [x] Dashboard por roles
- [x] Geo-pipeline básico (Copernicus → NDVI → alertas)
- [x] Deploy Docker + Nginx + SSL

### v2.0 (próximo) — Geo-pipeline avanzado
- [ ] Integrar interpolación espacial (IDW/RBF/Kriging) para mapas NDVI continuos
- [ ] Sentinel-1 SAR para detección bajo nubes
- [ ] Clasificación automática de cultivos (CNN)
- [ ] Super-resolución Sentinel-2 (10m → 1m)
- [ ] Mapas de susceptibilidad/riesgo con ML
- [ ] Estimación de rendimiento (biomasa → yield)

### v3.0 — Marketplace + Trazabilidad
- [ ] Marketplace piloto-agricultor
- [ ] Sistema de operaciones completo (asignación → vuelo → informe)
- [ ] Trazabilidad end-to-end (detección → tratamiento → verificación)
- [ ] Portal aseguradora con inspecciones automatizadas
- [ ] API pública para integraciones

---

## 12. COMANDOS ÚTILES

```bash
# Dev local
npm run dev                    # API + Web en paralelo
npm run dev:api                # Solo API
npm run dev:web                # Solo Web

# Build
npm run build                  # Todos los workspaces
npm run build:shared           # Solo shared (primero)

# Database
npm run seed -w apps/api       # Seed demo data

# Docker dev
docker compose up -d           # Todo
docker compose logs -f api     # Logs API

# Docker prod
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Tests
npm run test -w apps/api       # Tests API
```

---

*Documento generado para validación por Overwatch Agent. Última actualización: 2026-03-15.*
