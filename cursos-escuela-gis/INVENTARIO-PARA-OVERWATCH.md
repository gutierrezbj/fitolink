# Inventario de Material Geoespacial — Para ingesta Overwatch

> Material descargado de cursos Escuela Ambiental GIS (Hotmart).
> Compra: 15/03/2026 · Total: 85.91€
> Ubicación local: `/Users/juanguti/dev/srs/fitolink/cursos-escuela-gis/`

---

## Qué hay aquí

14 notebooks de Python/Colab + 6 datasets + 4 scripts GEE + 1 paper + 4 libros de referencia.
Todo enfocado en: interpolación espacial, ML geoespacial, deep learning con teledetección, y procesamiento SAR.

---

## 1. NOTEBOOKS DESCARGADOS (.ipynb)

### 1.1 Estadística Espacial con Python
**Ruta:** `inundaciones-ml/estadistica-espacial-python/`

| Archivo | Técnica | Input | Output | Libs principales |
|---------|---------|-------|--------|-----------------|
| `00_ESDA_Juan.ipynb` | EDA espacial completo | Shapefile puntos suelo | Estadísticos, histogramas, Box-Cox, Shapiro-Wilk | geopandas, scipy, matplotlib |
| `01_EDA.ipynb` | Análisis exploratorio | Shapefile puntos suelo | Distribuciones, correlaciones, normalización | pandas, geopandas, matplotlib |
| `02_IDW.ipynb` | Inverse Distance Weighting | Puntos muestrales | Raster interpolado (.tif) | scipy, rasterio, geopandas |
| `03_RBF.ipynb` | Radial Basis Functions | Puntos muestrales | Raster interpolado (.tif) | scipy.interpolate.RBFInterpolator |
| `03b_RBF_Juan.ipynb` | RBF con grid search + LOO-CV | Puntos muestrales | Mejor kernel (inverse_multiquadric), GeoTIFF 1m | scipy, sklearn, rasterio |
| `04_Kriging.ipynb` | Kriging geoestadístico | Puntos muestrales | Variograma + superficie interpolada | pykrige, geopandas |
| `05_Kernel_Density.ipynb` | Kernel Density Estimation | Puntos evento | Mapa densidad continuo | scipy.stats.gaussian_kde |
| `06_Distancia_Euclidiana.ipynb` | Distancia euclidiana espacial | Puntos/líneas referencia | Raster de distancias | scipy.spatial, rasterio |
| `07_OLS_Regression.ipynb` | Regresión espacial OLS | Variables suelo + coordenadas | Modelo predictivo, residuos espaciales | sklearn, statsmodels |

### 1.2 Machine Learning Geoespacial
**Ruta:** `inundaciones-ml/mozambique-gee/`

| Archivo | Técnica | Input | Output | Libs principales |
|---------|---------|-------|--------|-----------------|
| `ML_Susceptibilidad_Inundaciones.ipynb` | Random Forest + GEE | Variables ambientales (DEM, slope, lluvia, NDVI, distancia ríos) | Mapa susceptibilidad inundaciones | ee, geemap, sklearn |

### 1.3 Estimación de Biomasa
**Ruta:** `biomasa-forestal/ml-python-avanzado/`

| Archivo | Técnica | Input | Output | Libs principales |
|---------|---------|-------|--------|-----------------|
| `Composicion_Raster_Biomasa.ipynb` | RF + Gradient Boosting con GEE | GEDI + Sentinel-2 + Landsat bandas | Mapa biomasa forestal (Mg/ha) | ee, sklearn, pandas |

### 1.4 Deep Learning
**Ruta:** `biomasa-forestal/`

| Archivo | Ruta | Técnica | Input | Output | Libs |
|---------|------|---------|-------|--------|------|
| `Canopy_Height_1m.ipynb` | `colab-canopy-height/` | Clasificación alturas (Meta Trees) | GEE Community Catalog 1m | Mapa altura dosel clasificado | ee, geemap |
| `Super_Resolucion_S2_DeepLearning.ipynb` | `super-resolucion-sentinel2/` | SRGAN / Super-resolución | Sentinel-2 10m | Imagen 1m (×10 upscale) | keras, tensorflow |
| `Coberturas_Redes_Neuronales.ipynb` | `coberturas-deep-learning/` | CNN 1D (Keras) | Muestras espectrales GEE | Mapa coberturas clasificado | keras, sklearn, ee |

---

## 2. DATASETS DESCARGABLES

### Ya descargados (en Hotmart, pendientes de mover desde ~/Downloads)

| Archivo | Tamaño | Contenido | Para notebook |
|---------|--------|-----------|---------------|
| `Tabla_suelos.xlsx` | 8.59 KB | 28 muestras suelo (Arena, Arcilla, Limo, Ph, MO, N, P, K + coordenadas) | EDA, Kriging |
| `Datos.zip` | 9.85 KB | Shapefile puntos suelo | IDW, Kriging |
| `RBF.zip` | 9.85 KB | Shapefile puntos suelo | RBF interpolación |
| `Kernel.zip` | 14.75 MB | Shapefile eventos + polígono estudio | Kernel Density |
| `Distancia_Euclidiana.zip` | 1.64 MB | Shapefile líneas/puntos referencia | Distancia Euclidiana |
| `Regresion_Lineal_Simple.zip` | 4.25 MB | Shapefile con variables predictoras | OLS Regression |
| `Mafungautsi.zip` | 2.56 KB | Assets zona de estudio (Zimbabwe) | Composición Raster Biomasa |

### En Google Drive (no descargados aún)

| Recurso | URL | Contenido |
|---------|-----|-----------|
| Training Dataset Berlín | [Drive](https://drive.google.com/drive/folders/12dcwgYfjz0ND5dECT-WnKScvJgA3GYaB) | Variables ML susceptibilidad |
| Imágenes Sentinel-1 SAR | [Drive](https://drive.google.com/drive/folders/1Y_fihJkEv4rMMgq4IMYLUuhvjSCP9ijL) | Imágenes radar pre/post inundación |
| Datos práctica Biomasa | [Drive](https://drive.google.com/drive/folders/19Dw6IFyoAYSrRhJ56YDzveOkBJy1QjDC) | GEDI, Landsat, Sentinel-2 recortes |
| Datos Incendios Forestales | [Drive](https://drive.google.com/drive/folders/1yVhfLpxwILbMzm1kL5F2U1MTAQqZ1_6j) | Variables + scripts GEE incendios |

---

## 3. SCRIPTS GOOGLE EARTH ENGINE

| Script | URL | Qué hace |
|--------|-----|----------|
| Análisis Multitemporal Inundaciones | [GEE](https://code.earthengine.google.com/050dd047d65787973c2781bc19732aa5) | Sentinel-1 SAR pre/post evento Mozambique |
| Regresión Multivariable | [GEE](https://code.earthengine.google.com/ee67971a31ee7352bace41020a7a8750) | Regresión espacial con múltiples bandas |
| Muestras Entrenamiento Coberturas | [GEE](https://code.earthengine.google.com/68b43c2702c7901a0793913ed409048f) | Generación training data para CNN |

**Pendiente (estreno 18/03/2026):**
- Multicriterio de Inundaciones con Imágenes (Módulo 4, curso inundaciones)

---

## 4. PAPERS Y LIBROS

| Archivo | Tipo | Relevancia |
|---------|------|------------|
| `forests-14-01325.pdf` (11.79 MB) | Paper MDPI | Wildfire Susceptibility con Deep Learning — metodología RF replicable |
| `Libro_SIG_VictorOlaya.pdf` (51.88 MB) | Libro | Fundamentos SIG completo (referencia) |
| `Fundamentos IDE.pdf` (7.02 MB) | Libro | Infraestructuras de Datos Espaciales |
| `Descripcion Productos LandSat 8.pdf` (2.84 MB) | Guía | Bandas, correcciones, metadata Landsat |
| `Protocolo ortorectificacion Landsat.pdf` (2.60 MB) | Guía | Corrección geométrica imágenes |
| Paper MDPI Remote Sensing | [Online](https://www.mdpi.com/2072-4292/14/16/4076) | Referencia estadística espacial |

---

## 5. TÉCNICAS EXTRAÍBLES POR CATEGORÍA

### Interpolación espacial
| Técnica | Notebook | Parámetros clave | Métrica validación |
|---------|----------|-------------------|-------------------|
| IDW | 02_IDW.ipynb | power, n_neighbors | RMSE, MAE |
| RBF | 03b_RBF_Juan.ipynb | kernel (7 opciones), smoothing, epsilon | LOO-CV RMSE=0.033 |
| Kriging | 04_Kriging.ipynb | variogram_model, nlags | Cross-validation |
| KDE | 05_Kernel_Density.ipynb | bandwidth, kernel | Visual |

### Machine Learning
| Técnica | Notebook | Features | Target |
|---------|----------|----------|--------|
| Random Forest | ML_Susceptibilidad.ipynb | DEM, slope, aspect, lluvia, NDVI, distancia ríos | Susceptibilidad (0-1) |
| RF + Gradient Boosting | Composicion_Raster.ipynb | Bandas Sentinel-2 + Landsat + GEDI | Biomasa (Mg/ha) |
| OLS Regression | 07_OLS_Regression.ipynb | Variables suelo + coordenadas | Variable continua |

### Deep Learning
| Técnica | Notebook | Arquitectura | Input → Output |
|---------|----------|-------------|----------------|
| CNN 1D clasificación | Coberturas_Redes.ipynb | Conv1D + MaxPool + Dense + Dropout | Espectros → Clases cobertura |
| Super-resolución | Super_Resolucion_S2.ipynb | SRGAN / CNN | 10m → 1m pixel |
| Clasificación alturas | Canopy_Height_1m.ipynb | Pre-entrenado (Meta) | GEE catalog → Clases altura |

### Procesamiento SAR
| Técnica | Fuente | Herramienta |
|---------|--------|-------------|
| Calibración radiométrica | Módulo 6 (video) | SNAP |
| Speckle filtering | Módulo 6 (video) | SNAP |
| Detección agua/inundación | Módulo 6 (video) | SNAP + threshold |
| Análisis multitemporal S1 | Script GEE | Google Earth Engine |

---

## 6. DEPENDENCIAS COMUNES

```
# Python core
numpy, pandas, geopandas, matplotlib, seaborn

# Geoespacial
rasterio, shapely, fiona, pyproj, pykrige

# ML
scikit-learn (RandomForest, GradientBoosting, cross_val_score, GridSearchCV)
scipy (RBFInterpolator, gaussian_kde, spatial)

# Deep Learning
keras / tensorflow (Sequential, Conv1D, Dense, Dropout, MaxPooling1D)

# Google Earth Engine
earthengine-api (ee), geemap

# Validación
sklearn.metrics (confusion_matrix, classification_report, r2_score, RMSE)
sklearn.model_selection (LeaveOneOut, train_test_split, KFold)
```

---

## 7. ESTADO DE DESCARGA

| Item | Estado |
|------|--------|
| 14 notebooks (.ipynb) | ✅ Descargados y organizados |
| 7 ZIPs/XLSX de Hotmart | ⚠️ En ~/Downloads, pendiente mover |
| 4 carpetas Google Drive | ❌ No descargadas |
| 4 scripts GEE | 🔗 Solo links (se ejecutan en GEE online) |
| 1 lección bloqueada | ⏳ Estreno 18/03/2026 |
| 4 PDFs/libros | ⚠️ En ~/Downloads, pendiente mover |

---

*Documento para ingesta por proyecto Overwatch. Generado 2026-03-15.*
