<p align="center">
  <img src="https://fitolink.systemrapid.io/favicon.svg" width="60" alt="FitoLink" />
</p>

<h1 align="center">FitoLink</h1>

<p align="center">
  <strong>Del pixel al tratamiento de precisión</strong><br/>
  Plataforma de agricultura de precisión que conecta detección satelital Sentinel-2 con pilotos de drones certificados AESA/ROPO.
</p>

<p align="center">
  <a href="https://fitolink.systemrapid.io">🌐 Demo</a> ·
  <a href="#quick-start">🚀 Quick Start</a> ·
  <a href="#arquitectura">📐 Arquitectura</a>
</p>

---

## ¿Qué es FitoLink?

FitoLink monitoriza parcelas agrícolas con imágenes satelitales gratuitas (Sentinel-2), detecta anomalías mediante análisis NDVI, y conecta agricultores con pilotos de drones certificados para tratamientos fitosanitarios de precisión — con trazabilidad completa.

### Roles

| Rol | Qué hace |
|-----|----------|
| **🌾 Agricultor** | Registra parcelas, recibe alertas NDVI, solicita tratamientos |
| **🚁 Piloto** | Recibe asignaciones, gestiona equipos y certificaciones |
| **🏢 Aseguradora** | Monitoriza parcelas, inspecciones automatizadas, reduce fraude |

---

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Zustand, Leaflet, Recharts |
| **Backend** | Node.js, Express 5, MongoDB, JWT, Zod |
| **Geo Pipeline** | Python 3.11, Copernicus API, rasterio, GeoPandas, NDVI processing |
| **Infra** | Docker Compose, Nginx reverse proxy, npm workspaces |

---

## Estructura del Monorepo

```
fitolink/
├── apps/
│   ├── api/              # Express API (puerto 4040)
│   │   ├── src/
│   │   │   ├── controllers/   # Auth, Parcels, Alerts
│   │   │   ├── models/        # User, Parcel, Alert, Operation
│   │   │   ├── routes/v1/     # REST endpoints
│   │   │   ├── services/      # Business logic
│   │   │   └── middleware/     # Auth JWT, validation, errors
│   │   └── package.json
│   └── web/              # React SPA (puerto 3040)
│       ├── src/
│       │   ├── features/      # Auth, Parcels, Alerts, Dashboard
│       │   ├── pages/         # Landing page
│       │   ├── layouts/       # Dashboard layout
│       │   └── lib/           # API client, utils
│       └── package.json
├── packages/
│   └── shared/           # Tipos, schemas Zod, constantes
├── workers/
│   └── geo-pipeline/     # Python: Sentinel-2 → NDVI → Alertas
│       └── src/
│           ├── ingestion/     # Copernicus API client
│           ├── processing/    # NDVI band math
│           └── alerting/      # Anomaly detector
├── docker/               # Dockerfiles + Nginx configs
├── docker-compose.yml    # Dev
└── docker-compose.prod.yml  # Producción
```

---

## Quick Start

### Requisitos

- Node.js 20+
- Docker & Docker Compose
- Python 3.11+ (solo para geo-pipeline)

### Desarrollo local

```bash
# Clonar
git clone https://github.com/gutierrezbj/fitolink.git
cd fitolink

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Levantar MongoDB + servicios
docker compose up -d mongo

# Instalar dependencias
npm install

# Arrancar API + Web en paralelo
npm run dev
```

- **Frontend:** http://localhost:3040
- **API:** http://localhost:4040
- **MongoDB:** localhost:6040

### Cuentas demo

En la página de login hay botones de acceso rápido para probar cada rol:

| Rol | Usuario |
|-----|---------|
| 🌾 Agricultor | Maria García |
| 🚁 Piloto | Carlos López |
| 🏢 Aseguradora | Ana Martínez |

---

## API

Base URL: `/api/v1`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/auth/login` | Login con Google OAuth |
| `POST` | `/auth/login/dev` | Login demo (dev only) |
| `GET` | `/parcels` | Listar parcelas del usuario |
| `POST` | `/parcels` | Crear parcela (GeoJSON) |
| `GET` | `/alerts` | Listar alertas |
| `PATCH` | `/alerts/:id` | Actualizar estado de alerta |
| `GET` | `/health` | Health check |

---

## Geo Pipeline

El worker de Python procesa imágenes Sentinel-2 cada 5 días:

```
Copernicus API → Sentinel-2 scenes → NDVI computation → Anomaly detection → MongoDB alerts
```

**Tipos de alerta:** `crop_stress` · `water_stress` · `disease` · `pest`

**Severidades:** `low` · `medium` · `high` · `critical`

---

## Deploy (Producción)

```bash
# En el servidor
cd /opt/fitolink

# Configurar .env con variables de producción
# MONGODB_URI, JWT_SECRET, GOOGLE_CLIENT_ID, etc.

# Build y deploy
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Nginx maneja SSL (Let's Encrypt) y reverse proxy:
- `/` → Frontend SPA
- `/api/` → Backend Express

---

## Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `MONGODB_URI` | URI de MongoDB |
| `JWT_SECRET` | Secret para tokens JWT |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `COPERNICUS_CLIENT_ID` | Copernicus Data Space API |
| `COPERNICUS_CLIENT_SECRET` | Copernicus API secret |
| `RESEND_API_KEY` | Email transaccional |
| `VITE_API_URL` | URL base API (vacío para relativo) |

---

## Licencia

Propietario · © 2025 SystemRapid

---

<p align="center">
  Hecho con 🛰️ por <a href="https://systemrapid.io">SystemRapid</a>
</p>
