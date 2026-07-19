# Sprint Bridge DJI → FitoLink · Scoping

**Fecha**: 19-jul-2026 · **Autor**: sesión Claude Code + JuanCho · **Estado**: DISEÑO (pendiente aprobación para Fase 0)
**Regla**: No SDD = No code. Este scoping precede a SDD-01/02.

---

## 1 · Problema

Los pilotos (Jonh · red Drovinci) mapean campos y ejecutan tratamientos con mandos DJI Agras
(T10/T40). Esa cartografía — polígono del campo, obstáculos, ruta volada, área tratada, dosis —
vive en el mando o en la nube de DJI. FitoLink no la ve. Consecuencias:

- Alta de clientes sin PAC (caso Don Antonio) bloqueada esperando geometría.
- El ciclo alerta → operación → evidencia se cierra a mano o no se cierra.
- La promesa comercial "del pixel al tratamiento" tiene un hueco en el último tramo.

## 2 · Dónde están los datos DJI (verificado / conocido)

| Fuente | Qué contiene | Acceso |
|---|---|---|
| **Mando (app DJI Agras)** | Campos mapeados (polígono + obstáculos + calibración) y registros de trabajo (ruta, área tratada, dosis, tiempos) | Export manual KMZ/archivo desde la app · lo hace el piloto en ~30 s |
| **DJI SmartFarm** (nube agrícola DJI) | Lo mismo, auto-sincronizado cuando el mando tiene internet · portal web + **API de desarrollador** | Cuenta SmartFarm del operador (Drovinci) + alta developer DJI Agriculture (solicitud, tiempos de aprobación variables — semanas) |
| DJI Cloud API genérica (developer.dji.com) | MQTT device-to-cloud, orientada a Dock/M-series | Soporte Agras limitado · NO es el camino primario |
| dronehubsrs.com | Directorio pilotos + compliance pre-vuelo (Supabase) | Ya nuestro · NO tiene post-vuelo (verificado 19-jul) |

⚠️ Nota parser: KMZ de Agras puede traer extras propietarios junto al doc.kml → parser tolerante.
Coordenadas WGS84 (verificar que no llegue GCJ-02 si un mando estuvo configurado región China).

## 3 · Diseño por fases

### Fase 0 · Import manual KMZ (1-2 días dev · desbloquea Don Antonio) ← EMPEZAR AQUÍ

Sin dependencias externas: ni DJI developer, ni acuerdos. El piloto exporta, el operador sube.

**Backend** (`apps/api`):
- `POST /api/v1/admin/parcels/import-kmz` · multipart · roles admin/agronomist
  - unzip KMZ → doc.kml → parsea todos los Placemark/Polygon
  - responde preview: `[{name, areaHa (calculada proyección local), centroid, vertices, warnings}]`
  - NO persiste nada en este paso
- `POST /api/v1/admin/parcels/import-kmz/confirm`
  - body: `{ownerId, parcels: [{name, cropType, geometry, areaHa, applicationTarget?}]}`
  - crea Parcels bajo el cliente · idempotente por (ownerId + name)
- Validaciones: ring cerrado, área > 0, dentro de bbox España, no duplicado geométrico (centroid < 50 m de parcela existente del mismo owner → warning)

**Frontend** (`apps/web` · admin):
- Página "Importar KMZ" · drag & drop → preview polígonos sobre Leaflet → tabla editable (nombre + cultivo + cliente destino) → botón Guardar
- Post-guardado: CTA "lanzar pipeline baseline" (manual, como caso PAC)

**Reutiliza**: parsing igual que Encineño (10-jun) · modelo Parcel intacto · patrón entidad-cliente del caso PAC.

### Fase 1 · Sync DJI SmartFarm API (2-3 semanas dev + espera alta developer)

- Alta developer DJI Agriculture con la cuenta SmartFarm de **Drovinci** (los mandos sincronizan a SU cuenta → acuerdo de acceso a datos con Drovinci ANTES de tocar nada · gestión JuanCho).
- Worker `djiSyncWorker` (cron diario): `GET plots` + `GET tasks` → upsert
  - plot.boundary → `Parcel.geometry` (match por externalRef)
  - task (área tratada, dosis, tiempos) → `Operation.flightLog` + `Operation.products`
- Cambio de modelo mínimo: `externalRefs?: { djiPlotId?: string; djiTaskId?: string }` en Parcel y Operation.
- El modelo Operation YA tiene `flightLog {startTime, endTime, areaHa}`, `products[]`, `applicationMethod`, `prescription` → el mapping encaja sin migración.

### Fase 2 · Cierre de ciclo completo (Epic 11 · 1-2 meses · post-validación Fase 1)

- Tiempo casi-real (webhook/MQTT si DJI lo expone para Agras).
- PDF post-aplicación por Operation (base para futura evidencia eIDAS vía Elevenais).
- Cruce compliance: al ingestar un task, verificar contra dronehubsrs (Supabase) que el piloto tenía ROPO/AESA vigentes el día del vuelo → sello "operación conforme" en la Operation.

## 4 · Riesgos y dependencias

| Riesgo | Mitigación |
|---|---|
| Alta developer DJI tarda semanas o se deniega | Fase 0 no depende de DJI · lanzar solicitud en paralelo YA |
| Datos en cuenta SmartFarm de Drovinci (no nuestra) | Acuerdo de acceso explícito con Drovinci (acción JuanCho, no técnica) |
| KMZ Agras con formato variable por versión de app | Parser tolerante + preview antes de persistir + warnings |
| Mandos sin sync activado | Fase 0 (export manual) es el fallback permanente |

## 5 · Decisión solicitada

1. **Aprobar Fase 0** → 1-2 días dev, desbloquea Don Antonio y cualquier cliente futuro sin PAC.
2. **Lanzar en paralelo** la solicitud developer DJI Agriculture + conversación con Drovinci (cuenta SmartFarm + acuerdo datos).
3. Fase 1 arranca cuando (a) Fase 0 esté en prod y (b) haya credenciales API.

---
*Precedentes en el repo: import geometría directa (Encineño · seedEncinenoDemo.ts) · entidad-cliente multi-recinto (PAC Aranjuez-Añover) · pipeline baseline manual (docker exec fitolink-pipeline-1 python -m src.pipeline).*
