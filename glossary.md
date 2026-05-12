# FitoLink — Glossary

## Satellite & Remote Sensing

| Term | Definition |
|------|-----------|
| **NDVI** | Normalized Difference Vegetation Index = (B08-B04)/(B08+B04). Range [-1,1]. Core health indicator. Thresholds: <0.30 critical, <0.40 high risk, <0.55 medium, ≥0.55 healthy. |
| **NDRE** | Normalized Difference Red Edge = (B08-B05)/(B08+B05). More sensitive to chlorophyll stress than NDVI. Detects stress before it's visible in NDVI. Requires Sentinel-2 B05 (RedEdge band, 20m). |
| **Sentinel-2 L2A** | ESA satellite. 10m resolution (B04/B08), 20m (B05/B11/B12). 5-day revisit. Bands: B04=Red, B05=RedEdge, B08=NIR, SCL=Scene Classification. |
| **SCL** | Scene Classification Layer — Sentinel-2 band classifying each pixel: 0=no data, 1=saturated, 3=cloud shadow, 8=cloud medium, 9=cloud high, 10=cirrus, 11=snow. Used for cloud masking. |
| **CDSE** | Copernicus Data Space Ecosystem — ESA/EU platform providing Sentinel data access. Both OData catalog and openEO endpoint. Same credentials for both. |
| **openEO** | Standard protocol for cloud-side satellite processing. FitoLink sends a process graph to CDSE openEO, executes NDVI/NDRE in the cloud, receives small GeoTIFF in memory (no 500MB downloads). |
| **OData** | Legacy Sentinel-2 download API. Downloads 500MB SAFE ZIPs. Used as fallback when openEO is unavailable. |
| **GeoTIFF** | Georeferenced raster format. FitoLink receives NDVI results as GeoTIFF in BytesIO (in-memory, no disk I/O). |
| **SAFE ZIP** | Sentinel-2 product archive format (~500MB). Contains JP2 band files in 10m/20m/60m resolutions. Used in OData fallback path. |
| **Max composite** | Temporal reduction strategy: picks the maximum NDVI value per pixel across the time window. Selects the clearest (least cloudy) observation. |
| **CLMS NPP** | Copernicus Land Monitoring Service Net Primary Productivity. Based on FAPAR 200m. Complements NDVI with real vegetation productivity. |
| **FIRMS** | Fire Information for Resource Management System (NASA). Near real-time fire detection. Future integration for burn alerts. |
| **MPC** | Microsoft Planetary Computer. Catálogo STAC público con auto-firma de URLs. Sin auth obligatoria, sin coste. Acceso a MODIS, Landsat, Sentinel, ERA5, TerraClimate, etc. Integrado en FitoLink desde Sprint MPC (2026-05-02). |
| **MODIS / MOD13Q1.061** | Terra MODIS Vegetation Indices. 250m resolution, 16-day composite, 2000-presente, global. NDVI con scale factor 0.0001 e int16 fill -3000. Usado en FitoLink para baseline histórico 3-5 años por parcela. |
| **STAC** | SpatioTemporal Asset Catalog. Estándar abierto para indexar datos geoespaciales. Permite buscar por bbox + datetime + collection. MPC, CDSE y NASA exponen catálogos STAC. |
| **odc-stac** | Open Data Cube + STAC: librería Python para cargar items STAC como xarray DataArray. Usada en FitoLink para extraer time series MODIS por parcela. |
| **TerraClimate** | Dataset mensual climatología 1958-2021, ~4km global. Variables: precip, tmax, tmin, PDSI (drought index), PET, AET. Vía MPC. Fallback de baseline climático en FitoLink (la fuente principal es Open-Meteo). |
| **Open-Meteo** | API HTTP gratuita para datos meteorológicos históricos (ERA5 reanalysis 1940-presente) y actuales. Sin API key. Tier gratis 10k requests/día. Usado en FitoLink para baseline climático (1995-2024) y clima 30-day actual. Rate-limit 429 manejado con backoff exponencial 5/10/15/20s. |
| **ERA5** | Reanálisis ECMWF horario 1940-presente, ~31km global. Backend de Open-Meteo y de varios datasets MPC. Provee T, lluvia, viento, ET₀ FAO. |
| **ET₀ (FAO)** | Evapotranspiración de referencia, método Penman-Monteith FAO. Demanda atmosférica de agua. Calculada por Open-Meteo desde ERA5. Indicador clave de estrés hídrico. |
| **PDSI** | Palmer Drought Severity Index. Rango -10 (sequía extrema) a +10 (humedad extrema). En TerraClimate. No disponible en Open-Meteo (FitoLink usa anomalía precipitación como proxy). |

## ML & Anomaly Detection

| Term | Definition |
|------|-----------|
| **V1 detector** | Threshold-based anomaly detector. Simple rules: if NDVI drops > X → alert. More false positives. Used as fallback. |
| **V2 detector** | RandomForestClassifier (scikit-learn). 150 trees, 8 max depth, class_weight='balanced'. Trained on synthetic NDVI time series. 4 output classes. |
| **NdviFeatures** | 13-element feature vector extracted from NDVI time series: current_ndvi, below_critical, below_high, delta_1, delta_3, delta_5, slope_3, slope_5, drop_from_recent_max, consecutive_drops, volatility, ndre_delta_1, history_length. |
| **delta_1** | Current NDVI minus previous reading (~5 days). Negative = drop. Key short-term change signal. |
| **consecutive_drops** | Number of consecutive declining readings. ≥3 → alert_type='stress_pattern'. |
| **Severity classes** | 0=no anomaly (healthy), 1=medium, 2=high, 3=critical. Mapped to alert severity field. |
| **alert_type** | 'ndvi_drop' (sudden fall), 'stress_pattern' (sustained decline, consecutive_drops≥3), 'ndre_anomaly' (chlorophyll stress, ndre-ndvi gap>0.08). |
| **aiConfidence** | Probability of the predicted class from RandomForest predict_proba. Stored in alert doc, displayed as bar in UI. |
| **modis_baseline_ndvi** | Argumento opcional del detector V2: media histórica MODIS de 5 años para esa parcela en ese mes. Si la lectura actual está dentro de ±15% del baseline, override "anomalía → no anomalía" (suprime falsos positivos en parcelas con dinámica estacional fuerte). |
| **drought_flag** | Argumento opcional del detector V2: 'none' / 'mild' / 'moderate' / 'severe' calculado de `precip_30d / climate_normal_precip`. Enriquece el texto de la alerta con contexto físico para distinguir estrés biótico de abiótico. |
| **modisBaseline** | Subdoc en `parcels` con baseline NDVI MODIS. Schema: `{source, years, computed, months[{month, mean, std, n}], allTimeMean, observationCount}`. Construido por `build_mpc_baselines.py`. |
| **climateBaseline** | Subdoc en `parcels` con normales climáticas mensuales. Schema: `{source, period, computed, months[{month, precip, tmax, tmin, pdsi, pet}], annualPrecip, annualPet, aridityIndex}`. Fuente primaria: Open-Meteo ERA5 1995-2024. |
| **recentClimate** | Subdoc en `parcels` con clima últimos 30 días (refrescado cada pipeline run). Schema: `{source, days, fetched, precipTotalMm, tempMeanC, tempMaxC, tempMinC, et0TotalMm, daysWithRain, lastRainDaysAgo, precipPctOfNormal, precipAnomalyMm, tempAnomalyC, droughtFlag}`. |
| **search_with_retry** | Helper en `planetary_computer.py` para STAC searches con backoff exponencial 2s/4s ante "maximum allowed time" timeouts típicos del MPC anonymous tier. |

## Agricultural Domain

| Term | Definition |
|------|-----------|
| **Parcela** | Agricultural plot/field. Has geometry (GeoJSON Polygon), owner (farmer), crop type, province, NDVI history. |
| **Cultivo / cropType** | Crop type: 'olivo' (olive), 'vinedo' (vineyard), 'cereal', 'citricos', etc. |
| **NDVI history** | Time series of NDVI readings stored per parcel in MongoDB (ndviHistory array). Each reading: date, mean, min, max, anomalyDetected, source, optional ndreValue. |
| **Alerta** | Anomaly alert generated when V2 detector flags a parcel. Fields: parcelId, type, severity, ndviValue, ndviDelta, aiConfidence, detectedAt, status, imagery. |
| **Operacion** | Service request from farmer. Lifecycle: requested → assigned → in_progress → completed/cancelled. Has flightLog, product, weatherConditions, prescription. |
| **flightLog** | Flight execution data: startTime, endTime, areaHa treated. Required to complete an operation. |
| **Fitosanitario** | Phytosanitary product/treatment. Registered applicators required (ROPO license). |
| **SIGPAC** | Spanish agricultural plot reference system. `sigpacRef` field on parcels for official ID. |
| **ROPO** | Registro Oficial de Productores y Operadores — Official registry for phytosanitary product users. Pilots applying treatments must be registered. |
| **Perito agricola** | Agricultural damage assessor for insurance claims. 450 in Spain for 113,000+ annual claims. |
| **Agroseguro** | Pool of 23 Spanish agricultural insurance companies managing ~1B EUR/year in premiums. Key B2B target. |

## Platform & Architecture

| Term | Definition |
|------|-----------|
| **SDD** | Software Development with AI Direction — SRS methodology. Human directs, AI executes. |
| **B2B / B2C** | B2C: farmers and pilots. B2B: insurers (Agromutua, Agroseguro) paying per monitored hectare. |
| **Demo mode** | Activated via `?demo` URL param. Shows 4 demo login buttons (farmer/pilot/insurer/admin). Works on staging and production. |
| **Seed** | `npm run seed --workspace=apps/api` — resets all data and creates 4 demo users, 3 parcels, 3 alerts, 4 operations. |
| **Toast** | UI notification (Zustand toastStore + ToastContainer). Auto-dismiss in 4s. Fires on: accept assignment, reject, request service, complete operation, false positive. |
| **HealthScoreGauge** | SVG circular gauge 0-100 derived from NDVI. Color bands: green ≥60, yellow ≥40, orange ≥25, red <25. |
| **NdviChart** | Recharts AreaChart with gradient fill, min/max range band, anomaly dots (red ring), NDRE dashed purple line, reference lines at 0.30 (critical) and 0.40 (alert). |
| **OperationKanban** | Kanban board component. Farmer: 4 cols (Solicitada/Asignada/En curso/Completada). Pilot: 3 cols (Pendiente/En curso/Completada) with inline accept/reject. |
| **AlertPulse** | Double CircleMarker (dashed outer + solid inner) on ParcelMap for parcels with active alert or NDVI<0.30. |
| **Auto-assign** | On operation creation, pipeline does $near query (2dsphere, 100km radius) to find nearest verified pilot. Fallback: any verified pilot. Operation goes to 'assigned' status immediately. |
| **2dsphere index** | MongoDB geospatial index on User.location and Parcel.geometry. Required for $near auto-assign queries. |
| **deploy.sh** | Script en `/opt/fitolink/deploy.sh`. Ejecuta: git pull → docker compose build → docker compose up -d → seed via container temporal. Invocado via SSH desde Mac. |
| **Docker Compose** | Orquestacion de contenedores en staging: `fitolink-web` (nginx:alpine + Vite dist), `fitolink-api` (node:22-alpine), `fitolink-mongo` (mongo:7). Red interna `fitolink_default`. |
| **SVG icons** | Iconos custom en `apps/web/public/`. Convención: paths que empiezan con `/` en DashboardLayout renderizan `<img>` en vez de emoji `<span>`. Archivos: farmer, drone-pilot, drone, insurance2, location, operational-system, siren, system-administration, user, setting, smart-farming, vegetables, favicon. |
| **FitAllButton** | Componente Leaflet control (topright) en ParcelMap. Botón "⊙ Ver todas" que llama `map.fitBounds()` sobre todas las parcelas con padding 40px. Permite resetear el zoom tras seleccionar una parcela. |
| **AdminUsersPage cards** | Rediseño de AdminUsersPage con grid de tarjetas (1→2→3 cols) en vez de filas horizontales. UserCard con iniciales, SVG de rol, badge verificado, certs, rating y fecha. |
| **NdviHeatmap** | Overlay Leaflet/react-leaflet en ParcelDetailPage. GeoJSON FeatureCollection de celdas Polygon (~10m, CELL_HALF=0.000045°). Coloreadas por ndviToColor(). Toggle button "Mapa NDVI" visible si existe snapshot. |
| **NdviLegend** | Leyenda visual del heatmap NDVI. 6 rangos con color, etiqueta y descripción. Se muestra sobre el mapa (absolute bottom-right, z-1000) cuando el toggle está activo. |
| **ndvi_snapshots** | MongoDB collection para snapshots intra-parcela. Schema: parcelId, date, resolution, points[{lat,lng,ndvi}], bbox, pixelCount. Índice compound {parcelId:1, date:-1}. |
| **RBF interpolation** | Radial Basis Function (scipy, kernel=thin_plate_spline). Interpola pixels NDVI muestreados del GeoTIFF a grilla uniforme. Proyecta a UTM EPSG:25830 para interpolación métrica, devuelve a WGS84. |
| **PAC compliance** | FitoLink como "proveedor de evidencia técnica para cumplimiento PAC". Historial NDVI = prueba pre-siniestro. Cuaderno de campo digital. Trazabilidad fitosanitaria 100%. Sección PacPain en LandingPage. |
| **MpcContextWidget** | Componente React en `apps/web/src/features/parcels/MpcContextWidget.tsx`. Tarjeta 3 columnas con cabecera azul-cian gradient (branding Microsoft Planetary Computer). Muestra NDVI baseline 5y MODIS · normales climáticas mensuales · clima últimos 30 días con badge drought (none/mild/moderate/severe). Insertado debajo del NdviChart en ParcelDetailPage. |
| **build_mpc_baselines.py** | Script Python one-shot idempotente. Recorre todas las parcelas activas y construye `modisBaseline` + `climateBaseline` para las que no lo tengan. Flags: `--refresh` (rebuild todos), `--parcel ID` (uno solo). Pacing 2s entre parcelas para evitar rate-limits. Failures por parcela no abortan el batch. |
| **demo-sergio-asaja** | googleId del usuario demo personalizado para Sergio Valverde (Jefe de Formación ASAJA). Rol admin, company "ASAJA". Botón destacado amarillo con anillo en LoginPage cuando se accede con `?demo`. |
| **Onepager ASAJA** | PDF A4 de 1 cara generado con reportlab desde `docs/asaja-onepager/build_onepager.py`. Filosofía de diseño "Botanical Telemetry" (lámina botánica científica + telemetría aeroespacial). Tipografía: Crimson Pro + Bricolage Grotesque + IBM Plex Mono. Paleta: verdes FitoLink + amarillo telemetría #d4a017. |
| **Botanical Telemetry** | Filosofía de diseño documentada en `docs/asaja-onepager/design-philosophy.md`. Cruce entre tradición de lámina botánica (Maria Sibylla Merian, Redouté) y disciplina de telemetría aeroespacial. Crosshairs de registro, coordenadas en cabecera, numeración griega/romana. Aplicable a futuros documentos comerciales FitoLink. |
| **gzip sweep SRS** | Activación system-wide de gzip en nginx de srs-staging (2026-05-04). Aplica a todos los sites SRS hospedados allí (fitolink, bodyforge, dbuilder, insiteiq, moevet, ottoia, skypro360, s3.skypro360). Reducción típica JS bundle 71-72%. Backup config en `/etc/nginx/nginx.conf.bak.20260504-094222`. |
| **AgroM** | Vertical agro de SRS. Marca pública `agrom.es` (`.com` cogido). FitoLink es su producto principal. Brazo técnico: `systemrapid.io`. 11-may-2026: identidad visual aplicada al frontend (login + sidebar) y al email transaccional. Tokens Tailwind `colors.agrom.*`. |
| **AgroM Identity Sprint v0.1** | Sistema visual heredado para AgroM. Paleta: deep `#1B4332`, terra `#E07A3C`, ink `#0F2A22`, paper `#F4F0E8`, parch `#E8DDC9`, rule `#C9A876`, muted `#6B6B5C` + semánticos alert/warning/success/info. Tipografía: Fraunces (display) + IBM Plex Sans (body) + IBM Plex Mono (microcopy). |
| **AgroM wordmark** | Logo oficial "Agro·M" con punto terracota entre la O y la M. Archivos en `apps/web/public/brand/agrom-wordmark.{svg,png}` (transparent bg). También monograma en `agrom-monogram.{svg,png}`. Servidos en `https://fitolink.systemrapid.io/brand/`. |
| **learned baseline** | Override post-hoc del detector V2 que aprende el patrón normal de NDVI de cada parcela individual (últimas 18 lecturas Sentinel-2). Suprime alerta si \|z\| < 1.0 (lectura dentro del rango natural). Escala a 'high' si z < -2.5. Módulo `workers/geo-pipeline/src/alerting/learned_baseline.py`. |
| **Weather widget** | Componente en `apps/web/src/features/weather/WeatherWidget.tsx`. Open-Meteo Forecast 7 días + suitability badges drone por hora (ideal / ok / precaución / no aplicar). Dos modos: fitosanitario e inspección. Reglas AESA/FAO en `suitability.ts`. Integrado en ParcelDetailPage. |
| **AlertsTimeline** | Componente analytics en `apps/web/src/components/AlertsTimeline.tsx`. 3 paneles: stacked bar semanal por severidad + donut + top-5 parcelas problemáticas. Selector temporal 4s/8s/12s/26s. Backend `GET /admin/alerts/timeline?weeks=N`. Patrón heredado de OverWatch. |
| **emailService.ts** | Servicio nodemailer dual-mode en `apps/api/src/services/emailService.ts`. Trigger automático en `createAlert` para severity critical/high (fire-and-forget). Endpoint manual `POST /alerts/:id/resend-email` (admin) con override `{to, name}`. Plantilla HTML editorial AgroM con wordmark + Google Fonts. |
| **SMTP_* env vars** | Variables Gmail SMTP en `.env`: HOST=smtp.gmail.com, PORT=587, USER=juang@systemrapid.io, PASS=`<App Password 16 chars>`, FROM=`FitoLink Alertas <juang@systemrapid.io>`. App Password de Workspace via myaccount.google.com → Security → App passwords. Container Docker lee via `env_file: .env`. |
| **Botanical Cartography** | Filosofía visual en `docs/comercial/design-philosophy.md`. Cruce editorial entre lámina botánica científica + cartografía catastral SIGPAC. Aplicada a la infografía A4 del cliente pistacho. Hairlines, romanos, paleta paper/parch/deep/terra. |
| **Pitch deck cliente pistacho** | Material comercial en `docs/comercial/`. PPTX editable 16:9 wide (5 slides) generado por `build-deck.cjs` (pptxgenjs). PDF cerrado. Infografía A4 PDF + JPG por `build_infografia.py` (reportlab). Genérico, sin nombre del cliente, para evitar polémica con 100x100. |
| **Cooperativa (rol)** | Sexto rol de User: `cooperative`. NO posee parcelas — agrega los datos de farmers con `cooperativeId` apuntando a ella. Endpoint `GET /cooperative/overview`. Componente `CooperativeDashboardHome`. Seed `seedCooperativeSocios.ts` crea 5 socios DCOOP en Estepa. |
| **establishmentPhase** | Campo opcional en Parcel para parcelas recién plantadas o con cultivo residual (NDVI baja = ruido conocido). Con `isActive: false` saca a la parcela de los dashboards de demo. Usado para aislar las parcelas pistacho de Jonh del demo (movidas al user `john-pistacho-real`). |
| **Jonh Yanga Núñez** | Socio operativo de AgroM (autónomo bajo paraguas SRS). Coordinación operativa con clientes. En materiales comerciales aparece como "Coordinación operativa — Jonh Yanga Núñez". |
| **Predictive insights (Ola 1.5)** | Capa nueva de inteligencia accionable sobre los datos que ya tenemos. 3 piezas planeadas: (1) Trayectoria NDVI proyectada — regresión lineal sobre últimas lecturas para estimar cuándo cruza umbral crítico. (2) Eventos meteo personalizados — 7 reglas sobre Open-Meteo forecast (frente cálido / frío / borrasca / tormenta / helada / calor extremo / viento). (3) Plagas curadas (camino B) — admin emite alerta fitosanitaria desde boletín oficial RAIF/MAPA, sistema distribuye a parcelas que matchen comarca+cultivo. Empaquetado como digest matutino diario por email AgroM. |
