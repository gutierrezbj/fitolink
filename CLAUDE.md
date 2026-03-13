# FitoLink — Reglas de Desarrollo

## Que es FitoLink
Marketplace on-demand que conecta agricultores con pilotos de drones certificados para aplicaciones fitosanitarias, potenciado por deteccion satelital de anomalias vegetales via Copernicus (Sentinel-2).

## Stack
- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS + Radix UI + Zustand + TanStack Query + React Router v7 + react-leaflet + Recharts
- **Backend:** Node.js + Express + TypeScript + MongoDB (Mongoose) + JWT + Google OAuth + Zod + Pino
- **Geo Pipeline:** Python 3.11+ + rasterio + geopandas + eo-learn + PyTorch
- **Infra:** Docker Compose + Nginx + MongoDB Atlas + Resend (email)

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
- Librerias geo: rasterio, geopandas, eo-learn
- IA: PyTorch
- Tests: pytest
- Logging: structlog

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

## Roles de usuario
- farmer: Agricultor
- pilot: Piloto de drones certificado
- agronomist: Ingeniero agronomo
- insurer: Aseguradora (B2B)
- admin: Administrador

## API Response Format
```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: { code: string, message: string, details?: unknown } }

// Paginated
{ success: true, data: T[], meta: { total: number, page: number, limit: number } }
```
