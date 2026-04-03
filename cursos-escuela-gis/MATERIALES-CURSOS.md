# Materiales Cursos Escuela GIS - FitoLink

Documento resumen con todos los links, notebooks, scripts y archivos descargables recopilados de los cursos de Hotmart.

---

## CURSO 1: Inundaciones con Machine Learning

URL del curso: https://hotmart.com/es/club/talleres-sig-escuela-ambiental-gis/products/5438198

### Module 4 — mozambique-gee/

**GEE Scripts:**
- Analisis Multitemporal de Inundaciones: https://code.earthengine.google.com/050dd047d65787973c2781bc19732aa5

**Colab Notebooks:**
- ML Susceptibilidad Inundaciones: https://colab.research.google.com/drive/1Q5yRPjlZXNuGAxxaQgydY7ykLWeOiBE1

**Nota:** 1 leccion bloqueada (estreno 18/03/2026 - "Multicriterio de Inundaciones con Imagenes")

---

### Module 5 — berlin-ml/

**Google Drive:**
- Training Dataset (Berlin): https://drive.google.com/drive/folders/12dcwgYfjz0ND5dECT-WnKScvJgA3GYaB?usp=share_link

**Nota:** La leccion "Regresion Logistica y Random Forest" es video-only, el codigo se muestra dentro del video.

---

### Module 6 — sar-snap/

**Google Drive:**
- Imagenes Sentinel-1: https://drive.google.com/drive/folders/1Y_fihJkEv4rMMgq4IMYLUuhvjSCP9ijL?usp=sharing

**Links de referencia:**
- Copernicus Browser: https://browser.dataspace.copernicus.eu/
- Copernicus API Docs (S1 GRD): https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S1GRD.html

**Nota:** 7 lecciones son video-only sobre procesamiento SNAP. No hay scripts descargables.

---

### Module 7 — desplazamientos-tierra/

**Colab Notebooks:**
- Susceptibilidad de Desplazamientos de Tierra en Python: https://colab.research.google.com/drive/1OJKZV75JSMDL4JGeYCiTHDJIQb904u41?usp=sharing

**Archivos descargados (Hotmart -> ~/Downloads):**
- Land.zip (19.85 KB) — Datos de entrenamiento para modelo de susceptibilidad a deslizamientos

**Relevancia FitoLink:** Mapas de susceptibilidad a deslizamientos para seguros agricolas y gestion ambiental (CAR). Sentinel-2 + DEM + precipitacion = riesgo por parcela.

---

### Module 8 — estadistica-espacial-python/

**Archivos descargados (Hotmart -> ~/Downloads):**
- Tabla_suelos.xlsx (8.59 KB) — EDA + Kriging
- Datos.zip (9.85 KB) — Thiessen, IDW, Kriging Interpolacion
- RBF.zip (9.85 KB) — RBF
- Kernel.zip (14.75 MB) — Kernel Density
- Distancia_Euclidiana.zip (1.64 MB) — Distancia Euclidiana
- Regresion_Lineal_Simple.zip (4.25 MB) — OLS Regression

**Colab Notebooks:**
- EDA: https://colab.research.google.com/drive/16tvrcgBnz0yProUycmMtmwyHEU4ngHG6?usp=sharing
- IDW: https://colab.research.google.com/drive/1w2x6Xfr5zuXXO8XRRrmoJeHYJdzclwLj?usp=sharing
- RBF: https://colab.research.google.com/drive/1kSfgm6twVbGKY4bh8PHxwA4pRvbTb-ao?usp=sharing
- Kriging: https://colab.research.google.com/drive/1-zRkl37fwhYHc85nToSIJRyDpQfkcUT3?usp=sharing
- Kernel Density: https://colab.research.google.com/drive/10thDXF5aEnSicvlCzn5CC1DQ8OkmWN3L?usp=sharing
- Distancia Euclidiana: https://colab.research.google.com/drive/1xQT53XrJYakDSmgmG8oFH-Vy7p94e2rv?usp=sharing
- OLS Regression: https://colab.research.google.com/drive/1Wx8XtKCzvtzXVAlqgF5kPJ8d-9zOjbgo?usp=sharing

**GEE Scripts:**
- Regresion Multivariable: https://code.earthengine.google.com/ee67971a31ee7352bace41020a7a8750

**Papers de referencia:**
- MDPI Remote Sensing: https://www.mdpi.com/2072-4292/14/16/4076

---

## CURSO 2: Biomasa Forestal

URL del curso: https://hotmart.com/es/club/talleres-sig-escuela-ambiental-gis/products/5612569

### Module 1 — datos-practica/

**Google Drive:**
- Datos para la practica: https://drive.google.com/drive/folders/19Dw6IFyoAYSrRhJ56YDzveOkBJy1QjDC?usp=sharing

---

### Module 3 — ml-python-avanzado/

**Archivos descargados (Hotmart -> ~/Downloads):**
- Mafungautsi.zip (2.56 KB) — Assets para la leccion

**Colab Notebooks:**
- Composicion Raster (notebook principal del modulo): https://colab.research.google.com/drive/10FbnYx9cLfa3vvNeUomRB6zTdzA6o61A?usp=sharing

**Nota:** Las demas lecciones (GEDI, EDA, RF, Gradient Boosting, Prediccion) son video-only y usan el mismo Colab notebook.

---

### Bonus 1 — colab-canopy-height/

**Colab Notebooks:**
- Canopy Height y Clasificacion de Alturas 1m: https://colab.research.google.com/drive/1H83fjHCMZ7lM_DokkKkmXXNbBwlcmeu4?usp=sharing

**Datasets:**
- GEE Community Catalog (Meta Trees / Global Canopy Height): https://gee-community-catalog.org/projects/meta_trees/

**Nota:** Las lecciones de Configuracion Inicial, Instalacion de Librerias e Instalacion de GDAL son video-only de preparacion del entorno Colab.

---

### Bonus 2 — super-resolucion-sentinel2/

**Colab Notebooks:**
- Super Alta Resolucion Sentinel 2 con Deep Learning: https://colab.research.google.com/drive/1aWggWQEnboxJLDs2WaUpBO9AT1Zp93NJ?usp=sharing

**Articulos de referencia:**
- Sentinel-2 Deep Resolution 3.0 (Medium): https://medium.com/@ya_71389/sentinel-2-deep-resolution-3-0-c71a601a2253

---

### Bonus 3 — coberturas-deep-learning/

**GEE Scripts:**
- Creacion de Muestras de Entrenamiento: https://code.earthengine.google.com/68b43c2702c7901a0793913ed409048f?hl=es-419

**Colab Notebooks:**
- Mapa de Coberturas de la Tierra con Redes Neuronales: https://colab.research.google.com/drive/159saxiZVxr0MWTIb4rc2rz6EQMFFMB57?usp=sharing

---

### Bonus 4 — incendios-forestales/

**Archivos descargados (Hotmart -> ~/Downloads):**
- forests-14-01325.pdf (11.79 MB) — Paper: Wildfire Susceptibility Mapping Using Deep Learning

**Google Drive:**
- Datos y scripts del proyecto: https://drive.google.com/drive/folders/1yVhfLpxwILbMzm1kL5F2U1MTAQqZ1_6j?usp=share_link

**Nota:** Las lecciones intermedias (Delimitacion zona estudio, Variables Elevacion, Distancia Euclidiana, Landsat/NDVI, Variables Climaticas, Resampling, Dataset ML, Entrenamiento RF) son video-only con codigo GEE mostrado en pantalla.

---

### Module 8 — libros/

**Archivos descargados (Hotmart -> ~/Downloads):**
- Libro_SIG_VictorOlaya.pdf (51.88 MB) — Libro completo de Sistemas de Informacion Geografica
- Copia de Fundamentos de las Infraestructuras de Datos Espaciales.pdf (7.02 MB)
- Copia de Descripcion y Correccion de Productos LandSat 8.pdf (2.84 MB)
- Copia de Protocolo ortorectificacion imagenes Landsat.pdf (2.60 MB)

---

## Resumen de archivos descargados (todos en ~/Downloads)

### Curso 1:
1. Tabla_suelos.xlsx
2. Datos.zip
3. RBF.zip
4. Kernel.zip
5. Distancia_Euclidiana.zip
6. Regresion_Lineal_Simple.zip
7. Land.zip (desplazamientos de tierra)

### Curso 2:
7. Mafungautsi.zip
8. forests-14-01325.pdf
9. Libro_SIG_VictorOlaya.pdf
10. Copia de Fundamentos de las Infraestructuras de Datos Espaciales.pdf
11. Copia de Descripcion y Correccion de Productos LandSat 8.pdf
12. Copia de Protocolo ortorectificacion imagenes Landsat.pdf

---

## Destino de archivos descargados

Mover desde ~/Downloads a las carpetas correspondientes:

```
# Curso 1 - Estadistica Espacial Python
mv ~/Downloads/Tabla_suelos.xlsx cursos-escuela-gis/inundaciones-ml/estadistica-espacial-python/
mv ~/Downloads/Datos.zip cursos-escuela-gis/inundaciones-ml/estadistica-espacial-python/
mv ~/Downloads/RBF.zip cursos-escuela-gis/inundaciones-ml/estadistica-espacial-python/
mv ~/Downloads/Kernel.zip cursos-escuela-gis/inundaciones-ml/estadistica-espacial-python/
mv ~/Downloads/Distancia_Euclidiana.zip cursos-escuela-gis/inundaciones-ml/estadistica-espacial-python/
mv ~/Downloads/Regresion_Lineal_Simple.zip cursos-escuela-gis/inundaciones-ml/estadistica-espacial-python/

# Curso 1 - Desplazamientos de Tierra
mv ~/Downloads/land.zip cursos-escuela-gis/inundaciones-ml/desplazamientos-tierra/

# Curso 2 - ML Python Avanzado
mv ~/Downloads/Mafungautsi.zip cursos-escuela-gis/biomasa-forestal/ml-python-avanzado/

# Curso 2 - Incendios Forestales
mv ~/Downloads/forests-14-01325.pdf cursos-escuela-gis/biomasa-forestal/incendios-forestales/

# Curso 2 - Libros
mv ~/Downloads/Libro_SIG_VictorOlaya.pdf cursos-escuela-gis/biomasa-forestal/libros/
mv ~/Downloads/"Copia de Fundamentos de las Infraestructuras de Datos Espaciales.pdf" cursos-escuela-gis/biomasa-forestal/libros/
mv ~/Downloads/"Copia de Descripcion y Correccion de Productos LandSat 8.pdf" cursos-escuela-gis/biomasa-forestal/libros/
mv ~/Downloads/"Copia de Protocolo ortorectificacion imagenes Landsat.pdf" cursos-escuela-gis/biomasa-forestal/libros/
```
