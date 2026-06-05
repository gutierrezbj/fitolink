# 🛸 HANDOVER · FitoLink

**Snapshot:** 2026-06-05 · 22:55 CEST · v1.5 (post-BUMM + Bloque B + HITO SIGPAC)
**Owner:** JuanCho
**Para retomar:** lee este doc + `CLAUDE.md` (contexto estable) + `glossary.md` (vocabulario del proyecto).

---

## 1 · Identidad del proyecto

- **Nombre:** FitoLink (SaaS satélite + IA + alertas agrícolas)
- **Repo:** https://github.com/gutierrezbj/fitolink
- **Live:** https://fitolink.agrom.es
- **Owner:** JuanCho · empresa AgroM (SystemRapid SL)
- **Estado actual:** LIVE en producción · campaña 2026 abierta a Tipo A/B + Cooperativa + ADV + Regantes
- **Última versión:** commit `4ac8663` en `main` (docs reasignar normativo a AgroOps · 5-jun-2026)
- **Documentación viva interna:** este `HANDOVER.md` + `CLAUDE.md` (contexto estable + sprint table) + `glossary.md` (vocabulario)
- **Documentación canónica externa (Notion):** [Bitácora 5-jun monumental](https://app.notion.com/p/3767981f08ef812291c4d858a7b5d516) · [Bitácora 22-may→4-jun](https://app.notion.com/p/3757981f08ef81f3a7a0cda2890f1e19)

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
- [ ] **Bloque C REORIENTADO · Ingesta boletines oficiales fitosanitarios** (~5-6 días). **NO** hacemos diagnóstico propio (eso sería inventar). Tomamos información de fuentes oficiales y la mostramos contextualizada por parcela. **Infraestructura YA EXISTE**: `PestAdvisory` model + `pestAdvisoryService` + `PestAdvisoriesCard` + endpoint + seed con 2 advisories RAIF de muestra (Polilla + Mosca olivo). Falta: (1) ingesta automatizada RAIF Andalucía (scraping/RSS), (2) IVIA Comunidad Valenciana (cítricos), (3) GIPA Castilla-La Mancha (pistacho/viñedo), (4) DARP Cataluña + IMIDA Murcia cuando lleguen clientes, (5) tratamiento "estilo FIRMS" en UI (banner ROJO destacado + sección "§ 00 · AVISO COMARCA" + prefijo subject email digest). Cero responsabilidad legal nuestra · fuentes oficiales auditables. Coherente CRITICAL_no_inventar.
- [ ] **Logs-con-body en pipeline Python** (~30 min) · workers/geo-pipeline/src/* con loguru · mismo patrón que TS
- [ ] **Healthcheck registrado** en `/opt/scripts/healthcheck.sh` del Servidor 2
- [ ] **Backup MongoDB** automatizado (snapshot diario)

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

- **CRITICAL_no_inventar** (12-may-2026 · memoria SRS) — verificar copy contra realidad operativa. Reforzada 5-jun con HITO 26 parcelas SIGPAC catastral real.
- **Identity Ecosystem · FitoLink como base** (13-may-2026) — paleta brand-600 + terra-500 + earth, tipografía Instrument Serif + DM Sans + IBM Plex Mono.
- **Jerarquía marca · AgroM empresa + FitoLink producto** (14-may-2026).
- **`fitolink.agrom.es` URL canónica única** (18-may-2026) — `fitolink.systemrapid.io` retirado.
- **"El launch va con lo nuestro"** (4-jun-2026) — no bloquear MVP por dependencias externas privadas no validadas.
- **Separación productos** (5-jun-2026) — FitoLink informa, AgroOps opera. No mezclar.
- **Logs-con-body** (5-jun-2026) — todo servicio externo captura body del error 200ch antes del throw. Aplicado a TS, pendiente Python.
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
