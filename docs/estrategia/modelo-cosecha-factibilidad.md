# Ajustar FitoLink al modelo predictivo del fondo · estudio de factibilidad
*Borrador técnico · 12-jun-2026 · para la sesión con Guillermo (MPC) y el fondo*

> **Tesis:** FitoLink hoy es **descriptivo** (qué pasa ahora). El fondo paga por lo
> **predictivo** (qué pasará y **cuándo cosechar**). El salto no es una feature: es
> reorientar la arquitectura de datos de *parcela* a *árbol*, generar histórico
> largo, y entrenar modelos por cultivo con el **rendimiento real del fondo** como
> objetivo. Factible — Guillermo (MPC) lo confirmó — pero es I+D real, no magia.

---

## 1 · Las tres preguntas predictivas que el fondo paga

| Modelo | Pregunta | Dificultad | Empezar por |
|---|---|---|---|
| **Yield** | ¿Cuánto voy a cosechar? (kg/árbol, kg/ha) | Media | ✅ 1º (más datos, más directo) |
| **Harvest timing** | ¿Cuándo es la ventana óptima? | **Alta** | 2º |
| **Quality** | ¿Qué rendimiento graso / calidad AOVE? | Alta | 3º |

Cosechar a tiempo vs. tarde = **20-25% del valor** (cifra del propio fondo). Ahí está el dinero.

---

## 2 · El cambio de cimiento: de PARCELA a ÁRBOL

El NDVI de parcela en olivar de secano está **diluido** (copa + suelo desnudo). La granularidad correcta es el **árbol individual**:

1. **Censo de árboles** — vuelo RGB dron + modelo de conteo de copas. Fiable (>95%) y casi trivial en secano disperso (alto contraste copa/suelo). Inventario estable: se hace ~1 vez.
2. **Segmentación de copa** (tree crown delineation) → asignar a cada olivo su propio NDVI/NDRE midiendo **solo la copa**. Elimina el ruido del suelo.
3. **kg/árbol** = (kg cosechados de la parcela, del fondo) ÷ (nº árboles). Normaliza por densidad de plantación → comparable entre parcelas.

→ Pasamos del "promedio de mancha" (commodity) al **estado por árbol** (diferencial).

---

## 3 · Las capas de datos (multimodal) y el target

| Capa | Features | Fuente | Estado FitoLink |
|---|---|---|---|
| Óptico | Series NDVI/NDRE/NDMI **por copa** 2016→ | Sentinel-2 (MPC) | parcial (hoy por parcela) |
| Térmico | LST + **GDD** (integral térmica desde floración) | Landsat/MODIS (MPC) + ERA5 | ✅ base |
| Meteo | Lluvia por fase fenológica, ET0, estrés hídrico | ERA5 | ✅ base |
| Suelo | AWC, textura, profundidad | SoilGrids | ✅ base |
| **Dron** | Censo de árboles · (fase 2) carga de fruto por muestreo + color/madurez | RGB propio | ⛏️ a construir |
| **🎯 Target** | **kg/árbol/campaña · fecha cosecha · % graso** (varios años) | **El fondo** | ❌ imprescindible |

**Sin el histórico de rendimiento del fondo no hay aprendizaje supervisado.** Es la pieza que solo ellos tienen y el activo que hace el proyecto factible.

**Histórico:** generar 8-10 años de series de MPC (Sentinel 2016+, MODIS) → cubrir suficientes campañas de entrenamiento. El **MODIS baseline (5 años)** que FitoLink ya genera es el embrión de este pipeline.

---

## 4 · Feature engineering (donde vive el conocimiento agronómico)

- **Fenológicas:** fecha de floración estimada (inflexión del NDVI), GDD acumulado, días desde floración.
- **De la curva de campaña:** integral (área bajo curva) de NDRE, pendiente de descenso en envero, máximo y fecha del máximo.
- **De estrés:** déficit hídrico acumulado por fase, nº días de calor extremo, anomalía de precipitación pre-floración y en crecimiento del fruto.
- **Estructurales:** densidad de árboles/ha, tamaño de copa, edad estimada.

La pendiente de descenso de NDRE en otoño es el proxy satelital de la maduración (envero) — la señal más prometedora para el *timing*.

---

## 5 · El/los modelos — por qué NO es "deep learning sobre fotos"

El satélite no ve el fruto; las features son **tabulares multimodales** con **pocas muestras** (nº campañas limitado). En ese régimen:

- **Yield y quality → Gradient Boosting (XGBoost/LightGBM).** Gana a deep learning con datos tabulares y pocas muestras, y es **interpretable** (importancia de features) — un fondo y un Guillermo quieren saber *por qué*.
- **Harvest timing → híbrido mecanicista + ML.** Base fenológica (GDD + curva NDRE) corregida con ML. Más robusto que ML puro con poco dato.
- **Deep learning (CNN) → solo en el módulo de visión del dron** (conteo de árboles/fruto), que es un problema aparte de imágenes.

**Modelo por cultivo y región** (no global) — Guillermo fue explícito. La plataforma se reutiliza; el modelo se **re-entrena** por cultivo.

---

## 6 · Validación (lo que convence a un ingeniero)

- **Backtesting temporal:** entrenar con campañas ≤ N-1, predecir N, comparar con la cosecha real.
- **Validación espacial:** leave-one-zone-out (entrenar en unas zonas, validar en otras).
- **Métricas:** yield → MAE/RMSE en kg/árbol + R²; timing → **error en días**.
- **Baseline a batir:** la regla agronómica simple (GDD fijo) y la media histórica. Si no las batimos, no hay producto. Honestidad por diseño.

---

## 7 · Plan por fases (realista, con puertas de decisión)

| Fase | Qué | Esfuerzo | Puerta |
|---|---|---|---|
| **0 · Factibilidad** | Ingesta histórico MPC + EDA: ¿correlacionan las señales con el rendimiento del fondo? | semanas | ¿Sigue? |
| **1 · Yield piloto** | Modelo kg/árbol + backtesting en una zona | ~meses | ¿Bate baseline? |
| **2 · Dron + timing** | Censo dron + muestreo fruto/madurez + modelo de ventana de cosecha + muestreo de campo de calibración | 1 campaña | ¿Error en días aceptable? |
| **3 · Escala + multi-cultivo** | 2.300 ha + replicar método a cítrico/frutal | continuo | Producto |

La **Fase 0 da la respuesta de factibilidad en semanas, antes de comprometer nada grande.** Es la propuesta honesta al fondo.

---

## 8 · Lo que pedimos al fondo (sin esto no arranca)

1. **Registros históricos de cosecha** por parcela/campaña: kg, fecha, % graso — cuantos más años, mejor.
2. **Acceso a las parcelas** para vuelos de dron + muestreo de campo (calibración).
3. **Su conocimiento agronómico** (sus agrónomos) para validar el sentido de las features.

A cambio: el modelo entrenado **sobre sus propias 2.300 ha** — un activo que les pertenece y que ningún commodity satelital les da.

---

## 9 · Infraestructura (MLOps) — quién hace qué

- **Ingesta histórica + entrenamiento:** cómputo batch pesado → **SystemRapid UK + hardware local (Mac mini) / cloud bajo demanda. NUNCA el VPS.**
- **Feature store:** las series por árbol/fecha.
- **Servir predicciones:** ligero → lo sirve FitoLink (el producto vivo).
- **Re-entrenamiento:** por campaña, a medida que entra rendimiento nuevo.
- **Asesoría técnica:** Guillermo / MPC (reduce el riesgo del estudio).

---

## 10 · Punto de partida real (no se empieza de cero)

✅ Ya hay: MODIS baseline (histórico por parcela), pipeline multimodal (Sentinel+ERA5+LST+SoilGrids), acceso MPC, el dron propio (T50), la relación con el fondo.
⛏️ Falta: granularidad por árbol, histórico largo Sentinel, módulo de visión (censo dron), el target del fondo, el módulo de modelado/MLOps.

---

## Resumen para la sesión

> *"No vendemos un modelo mágico universal. Proponemos validar un MÉTODO multimodal —satélite por árbol + dron propio + rendimiento real del fondo— sobre vuestras 2.300 ha de olivar, empezando por una Fase 0 de factibilidad de semanas. Si correlaciona, escalamos a predicción de rendimiento y de ventana de cosecha; y el método se replica a cítrico, frutal y lo que venga, re-entrenando con los datos de cada cliente. El olivar es el banco de pruebas; el negocio es la fábrica de modelos. MPC asesora; SystemRapid pone la ingeniería; el fondo, los datos y el capital."*
