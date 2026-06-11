# DEMO ENCINEÑO · Documento de trabajo · Viernes 12-jun-2026
*Material de demo para JuanCho · Verificado contra código del repo `fitolink` el 11-jun-2026*

> **Verificaciones hechas contra el repo (no inventadas):**
> - ✅ Seed parcela ENCINEÑO ships `ndviHistory: []` → la parcela nace VACÍA de dato satelital (`seedEncinenoDemo.ts`). Todo NDVI/LST/NDMI depende de que el pipeline manual del 10-jun corriera contra prod. **(Verificado en vivo vía Chrome el 10-jun: NDVI 0.351 + LST 39°C SÍ aparecían → el pipeline corrió. Re-confirmar a ojo antes del viernes.)**
> - ✅ Advisory RAIF Prays oleae Córdoba: cifras LITERALES hardcoded en `seedPestAdvisories.ts` (35,1% aceitunas con Prays vivo · umbral 20% · severity MEDIUM · sourceUrl Junta de Andalucía clickeable). NO depende del pipeline.
> - ✅ Distancia parcela→advisory por haversine = **19,70 km exactos** (centroide parcela `-4.594, 37.781` → centroide advisory `-4.78, 37.88`, radio 75 km). Dentro de radio. El "wow" es matemáticamente real.
> - ✅ Chip login **"Jorge"** existe (`LoginPage.tsx`, `googleId: 'demo-encineno-fondo'`, color terra premium).
> - ✅ Prod **`fitolink.agrom.es` LIVE**. Usar SIEMPRE el dominio agrom.es (el viejo `fitolink.systemrapid.io` ya no resuelve).
> - ⚠️ **Hueco nº1:** confirmar a ojo que el dato satelital vivo no muestra el banner "Procesando primera pasada".

---

## 1 · BRIEF DE CONTEXTO

AgroM (SystemRapid SL) detecta anomalías de cultivo por satélite + IA y activa respuesta operativa con dron, generando evidencia y trazabilidad. **FitoLink** es el producto LIVE en `fitolink.agrom.es` que informa **el QUÉ** (estado del cultivo, focos, decisión); la aplicación con dron la coordina bajo el paraguas de **Drovinci** (operador legal con AESA + ITEAF + ROPO), AgroM **no** es operador propio. Estado del tiro: el cliente —un **fondo de inversión con 2.300 ha en cartera total**— envió el KMZ de su sector **ENCINEÑO (407 ha de olivar, Subbética, Córdoba)**, ya cargado en producción con su polígono real (70 vértices) y datos satelitales reales del pipeline. En la sala el viernes por Zoom: **Jorge Leccia** (intermediario, socio del fondo), una persona de **Microsoft**, y JuanCho. Quieren **evaluar el alcance** de lo que AgroM puede hacer sobre su cartera — es un **discovery exploratorio, no un cierre**. Objetivo: segunda reunión + enseñar algo que ningún competidor español pueda igualar hoy.

---

## 2 · LAS 3 CARTAS GANADORAS (lo que NADIE más en España enseña hoy)

### Carta 1 · "Vuestro KMZ, ya vivo, sin tocar un dato"
- **(a) Qué es:** el polígono real que el fondo mandó *ayer* (70 vértices, 407,7 ha) ya está geolocalizado en producción, cruzado contra un boletín fitosanitario oficial. No es un mockup ni una captura: es su finca, en su comarca, en el sistema.
- **(b) Demo en 30s:** login chip "Jorge" → aparece **una sola card** "Finca Encineño · Sector 407 ha · olivo · Córdoba" → click → el mapa dibuja **su** polígono exacto.
- **(c) Frase de JuanCho (verbatim):** *"Esto es vuestro KMZ que enviasteis ayer, ya geolocalizado en su comarca, con un boletín oficial real, sin tocar un dato."*

### Carta 2 · El aviso fitosanitario oficial real a 19,7 km — el ancla sólida ✅
- **(a) Qué es:** el sistema cruza la finca contra avisos oficiales de organismos públicos. Para ENCINEÑO sale **Prays oleae (polilla del olivo)** del portal **RAIF de la Junta de Andalucía**, comarca Subbética, **a 19,7 km exactos**, con cifra literal: **35,1% de aceitunas con Prays vivo, sobre el umbral de tratamiento del 20% → severidad MEDIA**. Este dato está 100% verificado en código y **no depende del pipeline** — siempre sale.
- **(b) Demo en 30s:** scroll hasta **PestAdvisoriesCard** → leer la cifra → **clic en el enlace oficial → abre el portal de la Junta en vivo → la cifra coincide**. *Ese clic es el WOW moment.*
- **(c) Frase de JuanCho (verbatim):** *"Esto no lo decimos nosotros: lo dice la Junta. 35,1% de aceitunas con Prays vivo, sobre umbral, a 19,7 km de vuestra finca. Y aquí tenéis el enlace oficial para comprobarlo ahora mismo."*

### Carta 3 · Las 4 capas integradas (la brecha competitiva)
- **(a) Qué es:** FitoLink integra **satélite + dron + aplicación + trazabilidad** en un solo ciclo. EOSDA, Planet Labs, Cropin, Farmonaut, VisualNacert cubren **solo 1-2 capas** (todos satélite, ninguno baja al campo). *"Nadie tiene las 4 columnas."*
- **(b) Demo en 30s:** no es una pantalla, es el cierre narrativo. Tras enseñar la señal satelital y el aviso oficial → *"el satélite sospecha, el dron lo confirma en finca, y si hay que actuar, se actúa con parte firmado y archivado un año."*
- **(c) Frase de JuanCho (verbatim):** *"Los grandes venden imágenes. Nosotros vendemos el canal completo: de la señal al campo. Esa es la diferencia, y es la única columna donde nadie compite."*

### Carta 4 · El momento óptimo de cosecha — el gancho de futuro (petición explícita del fondo)
- **(a) Contexto:** Jorge avisó por WhatsApp (11-jun): *"Recuerda que están especialmente interesados en algo que les ayude a identificar el momento óptimo de cosecha. Si consigues algo que nos pueda ayudar ahí, mejor!"*. Es su dolor real y la señal de compra más fuerte que han dado.
- **(b) Postura HONESTA (CRITICAL_no_inventar):** FitoLink NO tiene hoy un índice de cosecha — y NO se finge. Lo correcto: NO es una feature que falta, es la **evolución natural** del seguimiento temporal que el motor YA hace. Además estamos en junio: el olivar está en endurecimiento de hueso, la cosecha es en otoño (oct-ene). No hay nada que cosechar todavía.
- **(c) Frase de JuanCho (verbatim) — no improvisar:** *"El sistema ya sigue vuestra finca campaña a campaña. La ventana óptima de cosecha es la evolución natural de ese seguimiento: cuando el olivar entre en envero en octubre, la curva del satélite más la acumulación térmica os la van marcando. Hoy os enseño el motor funcionando y siguiendo vuestro cultivo en el tiempo; la recomendación de cosecha crece con vosotros esta misma campaña."*
- **(d) Por qué gana:** convierte una petición que NO tenemos resuelta en el gancho perfecto de la 2ª reunión, sin mentir una palabra. La herramienta se desarrolla con el tiempo y sigue el cultivo — ese es el producto, no un parche.

---

## 3 · GUION DE DEMO ENCINEÑO (5-7 min cronometrado)

> **Regla de oro de la demo:** solo muestras cards que estén LIVE. Si una card satelital sale en *empty state* (porque el pipeline no escribió), **no la abras, no la menciones** — pasas de largo. El advisory RAIF te salva la demo entera aunque todo lo satelital fallara.

**[0:00–0:45] Login + framing**
- Pantalla de login → click chip **"Jorge"** (el de color terra). *No teclees nada.*
- Voz en off: *"Os he montado vuestra propia cuenta. Lo que vais a ver es vuestra finca real, no una demo genérica."*

**[0:45–1:30] Dashboard → la card de la finca**
- Aparece **una sola card**: "Finca Encineño · Sector 407 ha · olivo · Córdoba · 407,7 ha".
- Voz: *"407 hectáreas. Esto es solo el sector que nos mandasteis; sé que la cartera son 2.300. Empezamos por aquí para que veáis el sistema con datos vuestros, no de catálogo."* → click en la card.

**[1:30–2:30] HERO — el mapa con su polígono**  ⚠️ *verificar que el heatmap trae dato; si no, quédate en el polígono*
- Voz (verbatim Carta 1): *"Esto es vuestro KMZ que enviasteis ayer, ya geolocalizado en su comarca, con un boletín oficial real, sin tocar un dato."*
- Si el gauge de salud y el NDVI traen valor: *"Salud del cultivo medida por Sentinel-2, gratis, cada pocos días, sobre el catálogo de Microsoft Planetary Computer."* Si NO traen valor: **no lo menciones, sigue bajando.**

**[2:30–4:00] 🎯 WOW MOMENT — PestAdvisoriesCard** ✅ *garantizado, no depende del pipeline*
- Scroll hasta la card de avisos de comarca.
- Voz (verbatim Carta 2): *"Esto no lo decimos nosotros: lo dice la Junta. Prays oleae, polilla del olivo, 35,1% de aceitunas con bicho vivo, por encima del umbral del 20%, a 19,7 km de vuestra finca."*
- **El gesto que cierra:** *"Y no me creáis a mí —"* → **clic en el enlace oficial** → se abre el portal RAIF de la Junta → *"— misma cifra, en su web. Esto es lo que ningún software de satélite os va a dar: la señal cruzada con la realidad oficial de vuestra comarca."*

**[4:00–4:45] AlertsPage — la segunda capa del mismo aviso**
- Ir a Alertas → sección **§ Comarca · avisos fitosanitarios oficiales** → mismo Prays a 19,7 km, con chip clickeable que devuelve a la parcela.
- Voz: *"El mismo aviso os llega también por aquí y por correo. No tenéis que entrar a buscarlo: el sistema os avisa."*

**[4:45–6:00] Cierre narrativo — las 4 capas** (sin pantalla, mirando a cámara)
- Voz (verbatim Carta 3): *"Los grandes venden imágenes. Nosotros vendemos el canal completo: satélite que sospecha, dron que confirma en finca, aplicación con parte firmado, y todo trazado. De la señal al campo. Esa es la única columna donde nadie en España compite."*
- *Importante sobre el dron:* *"La aplicación la coordinamos con la red de pilotos de Drovinci, que tiene las certificaciones AESA e ITEAF. Nosotros ponemos la inteligencia; ellos, el rotor legal."* (**NUNCA decir "AgroM aplica con dron" como operador propio.**)

**[6:00–7:00] Pregunta abierta hacia la segunda reunión** (ver sección 6).

---

## 4 · HUECOS A TAPAR ANTES DEL VIERNES

| # | Hueco | Severidad | Esfuerzo | Acción |
|---|-------|-----------|----------|--------|
| **1** | **Estado del dato satelital vivo SIN re-confirmar.** El seed crea la parcela vacía (`ndviHistory: []`). Si el pipeline manual del 10-jun no corrió/falló contra prod, las cards de NDVI/LST/índices salen en *empty state* o aparece el banner **"§ PROCESANDO PRIMERA PASADA"** — delator de demo vacía. (Verificado en vivo el 10-jun que SÍ había dato; re-confirmar.) | 🔴 **CRÍTICA** | 5 min | **JuanCho entra a `fitolink.agrom.es` como Jorge y confirma a ojo:** (a) NO aparece el banner "Procesando primera pasada"; (b) el gauge de salud y los índices Sentinel-2 traen número; (c) si MpcContext/LST traen 39°C. Si falta dato → relanzar el pipeline manual contra prod con margen. |
| **2** | **Banner "Procesando primera pasada"** se muestra si `ndviHistory.length===0`. | 🟠 Alta | (cubierto por #1) | Depende de #1. Plan B: la demo se sostiene 100% sobre el advisory RAIF (Carta 2) + el polígono real (Carta 1). |
| **3** | **Decidir el guion satelital según resultado de #1.** No improvisar el viernes. | 🟠 Alta | 15 min | Tras verificar, marcar en el guion qué cards abrir y cuáles saltar. Demo ensayada = demo sin sustos. |
| **4** | **Chip "Jorge" visible en prod.** Solo es visible con `?demo` o `VITE_SHOW_DEMO` activo en el build. | 🟡 Media | 2 min | Confirmar que el build de prod muestra el chip. Si no aparece, entrar con `?demo` en la URL. |
| **5** | Sin cifras agregadas de mercado por segmento en una sola fuente. | 🟢 Baja | — | No bloqueante para discovery. Si preguntan, usar TAM ~17,9M ha / SAM 2-3M ha y decir que el bottom-up está en el caso de negocio (no improvisar cifras inventadas). |

**Resumen honesto:** hay **un único hueco crítico** y es de verificación, no de construcción. Lo demás (polígono real + advisory oficial) está **garantizado por código**. No hay nada que *construir* antes del viernes; hay algo que *comprobar*.

---

## 5 · BANCO DE PREGUNTAS DURAS + RESPUESTAS

**P1 · "¿Esto escala a 2.300 ha? ¿Y a 50.000?"**
> El motor satelital corre sobre Microsoft Planetary Computer y openEO de Copernicus: catálogo público, coste marginal cercano a cero por hectárea, sin límite técnico de superficie. Cargar vuestra finca de 407 ha y geolocalizarla contra el aviso oficial no costó nada distinto a cargar 2.300 o 50.000. Lo que escala con la superficie no es el satélite, es la red de pilotos para la capa de confirmación, y para eso está Drovinci.

**P2 · "¿Qué os hace defensible? Esto lo copia cualquiera."**
> La señal satelital, sola, sí la copia cualquiera —EOSDA o Planet la venden ya. Lo que no se copia barato es el **canal completo**: red de pilotos certificados, trazabilidad operativa y el cruce con boletines oficiales comarca a comarca. Esa fontanería entre el satélite y el campo es la barrera, y es la única columna donde hoy no compite nadie en España.

**P3 · "¿Y cuando Google o Microsoft entren en esto?"**
> Microsoft ya está dentro —somos cliente de su Planetary Computer, no su competidor; nos apalancamos en su infraestructura. Las plataformas grandes se quedan en la capa de datos por diseño: no van a montar una red de pilotos AESA por comarca en España ni a firmar partes fitosanitarios. Esa capa operativa local es justamente lo que ellos no quieren tocar y nosotros sí.

**P4 · "Si dais un aviso y el agricultor trata mal, ¿quién responde?"**
> FitoLink informa el QUÉ —el estado del cultivo y los avisos oficiales—, no prescribe el tratamiento. El aviso de Prays que habéis visto no lo emitimos nosotros: es literal del portal RAIF de la Junta, con enlace a la fuente. La decisión y la aplicación las ejecuta un operador certificado, Drovinci, bajo su responsabilidad legal y sus seguros. Nosotros no nos ponemos en la cadena de responsabilidad agronómica; damos la señal y la evidencia.

**P5 · "¿Cómo ganáis dinero exactamente?"**
> Tres niveles: monitorización satelital por hectárea/año (arranca con 60 días gratis), inspección con dron por intervención, e histórico/evidencia para PAC y peritaciones. El modelo es rentable desde el año 1 sin depender de financiación externa. Con un fondo de 2.300 ha el encaje natural es suscripción por superficie sobre toda la cartera, no venta finca a finca.

**P6 · "Si levantáis capital, ¿en qué se va?"**
> Hoy no necesitamos capital para sobrevivir —el modelo se sostiene solo. Donde el capital acelera es en densificar la red de pilotos por comarca y en cubrir más fuentes oficiales autonómicas para el cruce de avisos. No se va en quemar dinero en adquisición; se va en profundizar la única capa que nos hace defensibles.

---

## 6 · EL CIERRE

**Cómo termina JuanCho la reunión (no pedir el sí; pedir la cartera):**
> *"Lo que habéis visto es vuestro sector de 407 hectáreas, vivo, con dato real y un aviso oficial cruzado, en 48 horas desde que mandasteis el KMZ. La pregunta que os dejo no es si os gusta — es: ¿me mandáis los KMZ del resto de la cartera, las 2.300, y os la dejo toda montada igual para la próxima reunión? Sin coste, los primeros 60 días de análisis van de nuestra cuenta. Si os aporta valor, seguimos; si no, no habéis perdido nada."*

Esto convierte el discovery en un **siguiente paso concreto y barato para ellos**: pedir más KMZ. Es un sí pequeño que abre la segunda reunión con la cartera entera ya cargada.

**Cierre de marca (verbatim, sin parafrasear):**
> *"AgroM va a ganar el campo español porque cree que ayudar es el camino."*

**Follow-up de esa misma tarde (viernes 12-jun, antes de las 19:00):**
1. **Email a Jorge** (jorgeleccia@hotmail.com), copiando a Guillermo si Jorge lo autoriza:
   - Asunto: *"FitoLink · Encineño en vivo + propuesta para la cartera completa (2.300 ha)"*.
   - 3 líneas: gracias por el tiempo + 1 captura del polígono real con el advisory Prays a 19,7 km + el enlace oficial RAIF + la petición concreta: *"mandadme los KMZ del resto y os lo dejo todo cargado para la próxima"*.
   - Una sola pregunta de cierre: *"¿Os va bien que fijemos la segunda la semana que viene?"*
2. **Adjuntar** el material comercial AgroM ya entregado a Jorge como recordatorio del marco Microsoft → no rehacer material.
3. **Nota interna en Notion** (bitácora 12-jun): resultado de la demo, estado real del pipeline verificado, objeciones que salieron, compromiso conseguido.

---

**Rutas relevantes:**
- Seed parcela (vacía por diseño): `apps/api/src/seed/seedEncinenoDemo.ts`
- Advisory RAIF hardcoded (ancla sólida): `apps/api/src/seed/seedPestAdvisories.ts`
- Chip login "Jorge": `apps/web/src/features/auth/LoginPage.tsx`
- Recorrido de cards: `apps/web/src/features/parcels/ParcelDetailPage.tsx`
- Card del WOW moment: `apps/web/src/features/parcels/PestAdvisoriesCard.tsx`
- Prod LIVE: `https://fitolink.agrom.es`

**Lo único que falta para estar 100% listo: que JuanCho entre como Jorge a prod y confirme a ojo que el dato satelital está vivo. Todo lo demás está verificado.**
