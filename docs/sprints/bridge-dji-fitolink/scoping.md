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

**Fuera de alcance**: dronehubsrs.com es la herramienta de preparación de misiones del operador. No forma parte de este bridge — la fuente de datos post-vuelo es DJI (mando / SmartFarm), no dronehub.

## 2 · Dónde están los datos DJI (verificado / conocido)

| Fuente | Qué contiene | Acceso |
|---|---|---|
| **Mando (app DJI Agras)** | Campos mapeados (polígono + obstáculos + calibración) y registros de trabajo (ruta, área tratada, dosis, tiempos) | Export manual KMZ/archivo desde la app · lo hace el piloto en ~30 s |
| **DJI SmartFarm** (nube agrícola DJI) | Lo mismo, auto-sincronizado cuando el mando tiene internet · portal web + **API de desarrollador** | Cuenta SmartFarm del operador (Drovinci) + alta developer DJI Agriculture (solicitud, tiempos de aprobación variables — semanas) |
| DJI Cloud API genérica (developer.dji.com) | MQTT device-to-cloud, orientada a Dock/M-series | Soporte Agras limitado · NO es el camino primario |

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

### Fase 1 · Auto-sync — INVESTIGADO 19-jul-2026 · la API DJI directa NO existe

**Hallazgo verificado (fuentes oficiales + repo dji-sdk):** no hay API pública de
DJI para que un tercero descargue campos + tareas de Agras/SmartFarm.
- **DJI Cloud API** = Dock + Pilot 2 + enterprise (M300/M350/M30/M3E). MQTT
  flighttask_*/fileupload_*/DRC. Cero Agras, cero spraying, cero endpoints de
  campos o registros de tarea (confirmado en dji-sdk/Cloud-API-Doc + WPML doc).
- **WPML/template.kml** = misión de vuelo de drones de mapeo, no Agras, sin dosis.
- **SmartFarm** = plataforma cerrada. Acceso a datos = **export manual KML**
  (flight logs KML; prescripciones SHP/RX/KML/JSON). Sin API pública terceros.
- **Único auto-sync real del sector = vía AirData UAV** como intermediario
  (SmartFarm→servidores DJI→AirData, o app AirData en el propio mando RC Plus).
  AirData sí publica API de terceros.

**Conclusión:** la Fase 1 original ("sync DJI SmartFarm API") se DESCARTA — esa
API no existe. Las vías reales de automatización:

**1a · Import por lote de KML (recomendado · sin dependencia externa)**
Extender Fase 0 de 1 archivo a carpeta completa: el operador exporta todos los
campos/logs del mando o SmartFarm (KML) y FitoLink los ingesta en una pasada
(parcelas + operaciones si el KML trae ruta/área). Quita el clic-por-archivo.

**1b · Puente AirData (verdadero auto-sync · requiere adoptar AirData)**
Si AgroM corre AirData (en el mando RC Plus o vía sync SmartFarm→AirData),
FitoLink se integra con la API de AirData (no con DJI). Investigar contrato
AirData + coste de licencia como sprint aparte. Cambia el target de integración
de DJI (cerrado) a AirData (abierto).

**1c · App on-controller RC Plus (descartado corto plazo)**
Desarrollo Android nativo en el mando · demasiado pesado para el ROI actual.

### Fase 2 · Cierre de ciclo completo (Epic 11 · 1-2 meses · post-validación Fase 1)

- Tiempo casi-real (webhook/MQTT si DJI lo expone para Agras).
- PDF post-aplicación por Operation (base para futura evidencia eIDAS vía Elevenais).

## 4 · Riesgos y dependencias

| Riesgo | Mitigación |
|---|---|
| Alta developer DJI tarda semanas o se deniega | Fase 0 no depende de DJI · lanzar solicitud en paralelo YA |
| KMZ Agras con formato variable por versión de app | Parser tolerante + preview antes de persistir + warnings |
| Mandos sin sync activado | Fase 0 (export manual) es el fallback permanente |

## 5 · Decisión solicitada

1. **Aprobar Fase 0** → 1-2 días dev, desbloquea Don Antonio y cualquier cliente futuro sin PAC.
2. **Lanzar en paralelo** la solicitud developer DJI Agriculture + conversación con Drovinci (cuenta SmartFarm + acuerdo datos).
3. Fase 1 arranca cuando (a) Fase 0 esté en prod y (b) haya credenciales API.

---
*Precedentes en el repo: import geometría directa (Encineño · seedEncinenoDemo.ts) · entidad-cliente multi-recinto (PAC Aranjuez-Añover) · pipeline baseline manual (docker exec fitolink-pipeline-1 python -m src.pipeline).*
