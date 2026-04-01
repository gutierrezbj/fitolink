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
