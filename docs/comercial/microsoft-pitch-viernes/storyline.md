# Storyline · Presentación universal AgroM/FitoLink
**Snapshot:** 2026-06-09 · 14:30 Madrid · v0.2 audience-agnostic

**Decisión PM JuanCho 9-jun 14:30**: este storyline es **universal**. Sirve para Microsoft viernes 12-jun, para una cooperativa el lunes siguiente, para una aseguradora dentro de un mes. La demo va sobre **lo nuestro** · cero dependencia de KMZ externos · cero asunciones sobre la audiencia.

Caso uso inmediato: **discovery Zoom 12-jun-2026 · JuanCho + Jorge (socio del fondo) + invitado de Microsoft**. Pero el material se usa después en cualquier reunión equivalente.

Naturaleza típica: **descubrimiento exploratorio** · NO pitch formal de cierre.
Objetivo único de la primera reunión: **conseguir una segunda reunión** · NO cerrar nada el primer día.

---

## § AJUSTE ÚNICO DEPENDIENDO DE AUDIENCIA · solo intro 30s

| Tipo audiencia | Hook intro (sustituir frase apertura) |
|---|---|
| Inversor financiero / VC | *"Lo que voy a enseñar es FitoLink · producto LIVE · 26 parcelas SIGPAC catastral real · 8 fuentes externas integradas · 4 buyers institucionales en campaña comercial 2026."* |
| Tech partner (Microsoft Azure / Google / similar) | *"Lo que voy a enseñar es FitoLink · ya consumimos Microsoft Planetary Computer en producción · 8 fuentes externas integradas · stack 100% gratuito que escala con cualquier proveedor cloud."* |
| Cliente institucional (cooperativa / regantes / ADV) | *"Voy a enseñarle cómo tres compañeros gestionan ya su cartera de socios con FitoLink · vista agregada · decisión de riego · reportes formales descargables · cero papeleo añadido."* |
| Cliente individual (agricultor) | *"Voy a enseñarle cómo informamos a un agricultor cada mañana sobre el estado real de sus parcelas · 6 índices satelitales · meteo a 7 días · avisos de plagas de su comarca · todo en un correo."* |

**Lo demás del storyline (problema · solución · demo · tracción) es IDÉNTICO**.

---

## § STORYLINE · 7 MIN

### 0:00 – 0:15 · ENTRADA
> *"Buenos días Jorge, [Nombre Microsoft]. Gracias por el tiempo. Vamos a hacer 5-7 minutos de contexto + una demo en vivo, y después abrimos a vuestras preguntas — que es lo que más me interesa."*

**Tono**: cálido, profesional, no comercial. NO arrancar con deck. Decir el plan claro.

---

### 0:15 – 0:45 · QUIÉN SOMOS (30s · contexto rápido)

> *"AgroM es una empresa española de inteligencia agraria. Operamos tres productos: **FitoLink** (SaaS satélite + IA + alertas · LIVE), **DroneHub** (red de pilotaje certificado · LIVE), y **AgroOps** (operativa de tratamientos · aparcado). El que les enseño hoy es FitoLink, foco campaña 2026."*

> *"Mi nombre es JuanCho Gutiérrez · 25 años de PM en transformación digital · pasé por Telefónica, IBM España, IBM LATAM. Mi socio en operación es Jonh Russo · piloto AESA certificado · cliente real de FitoLink en pistacho 348 hectáreas Toledo."*

**Punto que NO se dice todavía** (mantener para Q&A si surge): AgroM bajo paraguas Drovinci como operador legal.

---

### 0:45 – 1:30 · POR QUÉ AHORA (45s · timing thesis · el "wave")

> *"Lo que hace que este sea el momento de FitoLink no es la idea. La idea es vieja. Lo que es nuevo es la **confluencia de cuatro cosas que nunca se habían dado a la vez en España**:"*

1. **Sequía sostenida 2024-2026** · primera vez RD 950/2024 obliga reducción 20% agua. Cada gerente de Comunidad de Regantes (≈ 2.500 en España) **necesita** saber a quién darle agua y a quién no.
2. **Sentinel-2 cada 5 días gratis** + Copernicus openEO con stack JSON Process Graphs. Hace 3 años esto costaba 50€/parcela/mes con proveedores privados. Hoy es 0€.
3. **Regulación dron sanidad vegetal habilitada · mayo 2024** · AESA PDRA-S01[F]. España fue el primer país europeo en habilitar fumigación con dron de forma sistemática.
4. **Microsoft Planetary Computer + NASA Earthdata + ISRIC SoilGrids** maduran 2026. Stack 100% gratuito que un equipo de 1-2 personas puede integrar.

> *"FitoLink integra los 4. Hoy. En producción."*

**Punch line memorable**: *"Si no construyo FitoLink ahora, alguien lo construye en 18 meses."*

---

### 1:30 – 2:30 · QUÉ HEMOS CONSTRUIDO (60s · sustancia)

> *"FitoLink hoy es producto LIVE en fitolink.agrom.es. No es maqueta, no es prototipo. Lo van a ver vivo en un minuto."*

> *"Integramos **8 fuentes externas públicas** sin partner privado en el path crítico: Sentinel-2 (Copernicus openEO) · MODIS baseline (Microsoft Planetary Computer) · ERA5 clima (MPC) · Landsat thermal LST (MPC) · NASA FIRMS focos térmicos · ISRIC SoilGrids 250m · Open-Meteo ECMWF forecast · SIGPAC catastral oficial MAPA."*

> *"Tenemos **7 roles activos** en producto: agricultor, piloto certificado, agrónomo, aseguradora, admin, cooperativa, ADV (Agrupación de Defensa Vegetal), comunidad de regantes."*

> *"Y un **HITO único que no he visto en ningún competidor español**: cada una de nuestras 26 parcelas demo está sobre una **referencia SIGPAC catastral REAL, auditable**. Cero polígonos sintéticos. Cero invento. Esto importa porque cuando un gerente de cooperativa entra al producto, no le enseñamos un cuadrado simulado · le enseñamos SU parcela tal y como aparece en el visor oficial del Ministerio."*

**Diferenciadores explícitos (3 cosas únicas que se memorizan)**:
1. **Cero invento** · regla operativa nº 1 del proyecto · todo verificable contra fuentes oficiales
2. **Multi-rol agregador** · cooperativas, regantes y ADVs ven cartera completa de socios · diferencial vs Agroptima/Hispatec que son single-farmer
3. **BUMM Decisión de Riego** · cupo m³ exacto + RD 950/2024 −20% + análisis narrativo server-side (NO LLM) → convierte datos técnicos en UNA decisión accionable para el gerente

---

### 2:30 – 5:30 · DEMO LIVE (3 min · WOW)

> *"Voy a compartir pantalla. ¿Visible?"*

**Variante A · si Jorge mandó KMZ** (ver `demo-guion.md` sección A):
1. Abrir cuenta `jorge-demo-001` · entrar
2. Ver sus parcelas reales en mapa
3. Click en una · ver decisión de riego viva
4. Mostrar cupo m³ + RD 950/2024
5. Cerrar volviendo a vista cartera

**Variante B · si no hay KMZ** (ver `demo-guion.md` sección B):
1. **Hook 1 (60s) · Visor SIGPAC público en vivo** · `fitolink.agrom.es/sigpac`
   - Pedir a Jorge dirección/municipio
   - Buscar en vivo · aparece SU parcela
   - "Esto lo ofrecemos gratis al mundo. Lead magnet. SEO masivo. Servicio público."
2. **Hook 2 (90s) · Login cuenta Comunidad de Regantes Demo Vega Baja del Segura**
   - 4 socios · 8 parcelas SIGPAC reales Levante
   - KPI strip · hectáreas regables · % en estrés · NDVI medio
   - Click socio prioritario → mapa hace flyTo
3. **Hook 3 (30s) · BUMM Decisión de Riego en ParcelDetail**
   - Click parcela específica
   - Banner "§ DECISIÓN DE RIEGO" con cupo m³ + análisis integrado server-side

**Lo que NO se hace en demo**:
- NO mostrar admin panel (información interna)
- NO mostrar 7 roles uno a uno (demasiado · pierde foco)
- NO explicar pipeline V2 técnico (off-topic salvo Q&A)

---

### 5:30 – 6:15 · TRACCIÓN + PROSPECTS 2026 (45s)

> *"Estamos en campaña comercial 2026 con **4 buyers institucionales prioritarios**:"*

1. **Agricultor familiar tipo A/B** · 45-65 años · explotación 50-500 ha · vía Drovinci comercial coordinado por Jonh
2. **Cooperativa olivar mediana** · piloto en marcha DOP Estepa
3. **Comunidad de Regantes Levante** · presión RD 950/2024 · cliente premium · ⭐⭐⭐
4. **ADV · Agrupación de Defensa Vegetal** · cliente institucional · validación pública del propio Servei de Sanitat Vegetal (Cataluña) que recomienda integrarse en ADV para asesoramiento individualizado

> *"Validaciones vivas hoy: (1) cliente real pistacho 348 ha Toledo intermediado por Jonh · (2) Gregorio Becerra de Agrodex mete FitoLink en sus cursos de formación de agricultores · (3) Aula Jaén utiliza la cuenta demo para enseñanza."*

> *"No tenemos ARR todavía. Es campaña 2026 desde cero. El producto está · el pipeline comercial está arrancando."*

**Tono**: honestidad total. NO inflar números. NO mentir sobre tracción.

---

### 6:15 – 6:45 · QUÉ HABLAMOS HOY · QUÉ HABLAMOS DESPUÉS (30s · honesto sobre ask)

> *"Hoy no vengo con un ask específico. Vengo a entender qué tipo de colaboración podría tener sentido para vosotros. En mi cabeza hay tres caminos posibles, no excluyentes:"*

1. **Inversión seed** que acelere la campaña comercial 2026 (no construcción técnica · escalado outbound + agrónomo senior)
2. **Partnership Microsoft Azure / Planetary Computer** · ya consumimos MPC en producción · ampliar a Azure GPU cuando entrenemos los detectores ML por cultivo
3. **Acceso a red de prospects institucionales** que Microsoft / fondo conozcan (cooperativas grandes, regantes Mancha/Levante, govtech agro autonómicos)

> *"Si después de hoy os interesa profundizar en uno, tengo agenda flexible para una segunda reunión más concreta la próxima semana."*

---

### 6:45 – Q&A · cierre abierto

> *"Eso es FitoLink. Antes de las preguntas, ¿hay algo que no haya quedado claro o que queráis que reabra?"*

---

## § Q&A · BANCO DE PREGUNTAS ANTICIPADAS

### Técnicas
- **"¿Por qué no usáis [GPT/Claude] en lugar de plantillas server-side?"**
  > *"Por la regla nº 1 del proyecto: CRITICAL_no_inventar. Un LLM alucinaría diagnósticos agrícolas que el agricultor o el técnico ADV firmaría sin saber. Riesgo regulatorio brutal. Las plantillas server-side cruzan 6-8 variables verificables y componen 3-5 frases. Pierde elegancia pero gana defensibilidad."*

- **"¿Cómo escaláis cuando os pidan procesar 10.000 parcelas?"**
  > *"Pipeline V2 en Python con GDAL + Copernicus openEO Process Graphs. Es batch · cron · cada parcela tarda ~30s. Para 10.000 parcelas: 1 nodo medio procesa todo en ~3h una vez al día. Migrable a Azure Batch o equivalent cuando llegue."*

- **"¿Qué pasa cuando Google / Microsoft entran al espacio?"**
  > *"Su core no es agro vertical · no van a hacer un BUMM Decisión de Riego con cupo RD 950/2024 + análisis fenológico por cultivo. Su valor para nosotros es la capa horizontal (Earth Engine / Planetary Computer · que YA USAMOS). Vertical es nuestro."*

### Comerciales
- **"¿Cuál es vuestro ARR target 2027?"**
  > *"Honestamente todavía es campaña 2026 desde cero. Si validamos pricing con 5 cooperativas + 5 regantes + 5 ADVs en 2026, llegamos a 2027 con ~200K€ ARR. Si Microsoft / vosotros nos abrís puertas institucionales, ese número se multiplica."* (NO inventar cifras concretas si no las tienes claras · ser honesto.)

- **"¿Cuál es vuestro CAC?"**
  > *"No lo tenemos medido todavía con suficiente N. Honestidad: estamos en validación pre-CAC. Es uno de los aprendizajes 2026."*

- **"¿Quién es vuestra competencia?"**
  > *"Agroptima · Hispatec · 365FarmNet · TimacAgro. Diferenciamos en multi-rol agregador (no single-farmer) + cero invento (verificable) + BUMM Decisión de Riego específico + visor SIGPAC público como lead magnet."*

### Equipo
- **"¿Cuánta gente sois?"**
  > *"Equipo técnico: yo + Jonh operativo. Plus colaboradores ocasionales (agrónomo · diseño · admin). 2-3 personas tiempo completo, otros part-time."* (Honestidad total. NO inflar.)

- **"¿Qué hacéis con dinero si invertimos?"**
  > *"NO construcción técnica · el producto está. Escalado comercial campaña 2026 + agrónomo senior contratado + outbound institucional + posible expansión LATAM 2027 (Colombia + Federación Cafeteros + Panamá)."*

### Regulatorio
- **"¿Cómo manejáis la responsabilidad si una alerta vuestra falla?"**
  > *"Capa de mediación con fuentes oficiales. La regla CRITICAL_no_inventar: TODO advisory fitosanitario tiene `source + sourceRef + sourceUrl` apuntando al boletín oficial (RAIF Junta Andalucía, DARP Generalitat Catalunya). NOSOTROS no diagnosticamos · transmitimos info pública + la geo-localizamos en TU parcela. La diligencia recae en el servicio oficial."*

- **"¿Operáis legalmente con dron?"**
  > *"AgroM opera bajo el paraguas de Drovinci · operador AESA + ITEAF + ROPO + seguros propios. Drovinci es Ana Gomez Ferrer. Tenemos compliance regulatorio de los 3 bloques (AESA + ITEAF + fitosanitario) cubierto vía Drovinci hoy. Camino a operador propio: 2027+."*

---

## § DESPUÉS DE LA LLAMADA · seguimiento (sin esperar 1 semana)

Email de seguimiento ese mismo viernes por la tarde:
- Recap 3 puntos clave de la conversación
- Link al visor SIGPAC público · que lo prueben tranquilos
- Link a 1 informe Pistachar (si Jonh autoriza) o caso Aula Jaén (anonimizado)
- Propuesta abierta de 2ª reunión semana siguiente

---

## § FUERA DE STORYLINE · NO MENCIONAR (a menos que pregunten)

- AgroOps · APARCADO · no es relevante para campaña 2026
- Aseguradoras como buyer · APARCADAS hasta 2027+
- Cuenta demo Cataluña · NO existe todavía (los DARP están en BD pero sin parcelas Cataluña no se ven)
- Elevenais blockchain eIDAS · descartado de roadmap
- Detalles Drovinci modelo operativo · solo si preguntan por compliance específicamente
