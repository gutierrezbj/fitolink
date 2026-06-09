# Demo guion · Producto AgroM/FitoLink universal
**Snapshot:** 2026-06-09 · 14:30 Madrid · v0.2 audience-agnostic

3 minutos de demo en vivo · **lo nuestro · 100% independiente de la audiencia**.
Sirve para Microsoft viernes · para una cooperativa el lunes · para Rita la cantaora cuando le toque.
**Acompaña al storyline · este documento contiene los clicks y la voz en off.**

**Decisión PM JuanCho 9-jun 14:30**: eliminada la variante "demo con KMZ del invitado" (paja mental · depende de un externo · no demuestra lo nuestro). Esta versión arranca SIEMPRE con visor SIGPAC público + cuenta demo Regantes Vega Baja como flujo principal.

---

## § REGLA DE ORO

Hablar **antes de hacer click**. NO mostrar lo siguiente sin haber dicho qué van a ver primero.
*"Ahora les enseño X y van a notar Y"* · click · espera 2 segundos · explica lo que aparece.

---

## § SETUP TÉCNICO · checklist 5 min antes del Zoom

- [ ] Chrome o Brave en pantalla compartida (Safari renderiza distinto · evitar)
- [ ] Pestaña 1 · `https://fitolink.agrom.es/login?demo`
- [ ] Pestaña 2 · `https://fitolink.agrom.es/sigpac`
- [ ] Pestaña 3 · (opcional) `https://github.com/gutierrezbj/fitolink` por si preguntan tech
- [ ] Cerrar pestañas extra · escritorio limpio
- [ ] Notificaciones macOS en NO MOLESTAR
- [ ] Cookies aceptadas previamente · no caer en un banner durante la demo
- [ ] Resolución cómoda · zoom navegador 110-120% para que se lea en Zoom
- [ ] Sound check · audio funciona, video funciona
- [ ] Tener `demo-guion.md` abierto en segunda pantalla / móvil · solo como red de seguridad

---

## § FLUJO PRINCIPAL · 3 minutos · lo nuestro

### Hook 1 · Visor SIGPAC público en vivo (60s)

> *"Voy a empezar enseñándoles algo que TODA España puede usar gratis · sin registrarse · sin pagar. Es nuestro segundo regalo al mercado."*

- Click pestaña 2 · `fitolink.agrom.es/sigpac`
- Mostrar landing del visor (3 segundos · que vean el lenguaje editorial sobrio)

> *"Es el Visor SIGPAC público de AgroM. Cualquier agricultor de España entra y consulta su parcela catastral en segundos. Hoy hay que conocer la web del Ministerio · saber tu provincia, municipio, polígono, parcela, recinto · ir a 4 sitios distintos. Aquí: una sola caja."*

- Pedir a la audiencia (si conviene generar engagement):
  > *"¿De dónde eres? ¿Conoces algún municipio con tierras? Dime uno cualquiera."*
- Si responden rápido → escribir provincia + muni en los selectores
- Si no responden o no aplica → **usar ejemplo predefinido seguro**: Sevilla / Estepa / Casariche (zona donde está el demo Coop Estepa · referencia ya verificada)
- **NUNCA improvisar con una provincia que no hemos probado en demo previa** · usar SOLO zonas conocidas

> *"Cuando la encontremos, aparece sobre el satélite. Pueden descargar KML para Google Earth, GeoJSON para QGIS, compartir por WhatsApp con un solo click."*

- Mostrar la parcela aparecida sobre el mapa
- Hacer click en el botón WhatsApp · que vean cómo se construye el mensaje (NO enviar)

> *"Esto en SEO nos da entre 1.500 y 5.000 URLs únicas indexables al año. Cada agricultor que busca su parcela puede caer aquí. Lead magnet. Servicio público. Y a la vez, una pista de quién es nuestro usuario potencial."*

### Hook 2 · Login Comunidad de Regantes Demo (90s)

> *"Ahora les llevo dentro del producto, cuenta real, datos vivos. Una Comunidad de Regantes de Levante."*

- Volver a pestaña 1 · LoginPage
- Click botón "Comunidad Regantes" en el chip-row demo · azul agua
- Aterriza en RegantesDashboardHome

> *"Esta es la pantalla del gerente de la Comunidad de Regantes Demo Vega Baja del Segura · 4 socios · 8 parcelas SIGPAC reales · 25 hectáreas. Zona Vega Baja en Murcia · una de las más afectadas por la sequía y el RD 950/2024."*

- Pausar 3 segundos en KPI strip
- Mover cursor sobre cada KPI mientras se lee

> *"Las 4 métricas que importan al gerente: **hectáreas regables totales** · **% de parcelas en estrés hídrico** (NDVI < 0.40) · **críticas que necesitan riego urgente** (NDVI < 0.30) · **NDVI medio cartera**."*

- Scroll bajo el mapa hasta "§ PRIORIDAD DE RIEGO"

> *"Y aquí la decisión operativa: la lista de socios ordenada por urgencia · no alfabéticamente. El gerente entra por la mañana, mira esto, y sabe a quién priorizar."*

- Click en el socio top de la lista
- El mapa hace flyTo a su parcela

> *"Click en un socio · el mapa va. Click en la parcela del mapa, en un momento."*

### Hook 3 · ParcelDetail · BUMM Decisión de Riego (30s)

- Click en la parcela ahora destacada del socio
- Aterriza en ParcelDetailPage
- Scroll directo al bloque "§ DECISIÓN DE RIEGO" (saltar visualmente lo demás)

> *"Lo que sale aquí es la decisión, no datos. **Urgencia X · razón Y · cupo de agua sugerido Z metros cúbicos · con RD 950/2024 menos 20% el cupo baja a W**. Debajo, análisis integrado que cruza 6-8 variables: estado satelital, suelo, clima reciente, fenología del cultivo. Sin LLM. Plantillas server-side cruzando datos. Cero alucinación. Defensible si un agrónomo lo cuestiona o si el día de mañana esto va a juicio."*

**Cierre Hook 3** → vuelta al storyline § 5:30 Tracción

---

## § VARIANTE C · DEMO EXPRESS si nos quedamos cortos de tiempo (90s)

Si el moderador / Microsoft corta el tiempo · plan B agresivo:

1. **Visor SIGPAC público · 20s** · solo enseñar el landing + un ejemplo · sin pedir dirección a Jorge
2. **Login Cooperativa · 30s** · solo la home con KPI strip
3. **ParcelDetail BUMM · 40s** · directo al bloque § DECISIÓN DE RIEGO

Total **90 segundos**. Sacrifica WOW pero deja claro qué hace el producto.

---

## § RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Internet inestable durante Zoom | Baja | Conexión cableada · móvil en hotspot listo como backup |
| App caída en mitad de demo | Muy baja | Pestaña abierta antes de Zoom · si cae, mostrar capturas de pantalla preparadas (TODO jueves) |
| Pregunta técnica que no sé | Media | Decir *"buena pregunta, lo verifico y te mando email esta tarde con el detalle"* · NO inventar |
| Pregunta sobre cifras / ARR / valoración | Alta | Honestidad: *"todavía no tenemos N suficiente · 2026 es campaña desde cero"* |
| Microsoft pregunta por Azure deeper | Media | Mencionar MPC ya consumido + apertura a Azure GPU para entrenar detectores ML por cultivo (próximo año) |
| Jorge interrumpe con tema que no es producto | Alta | Reconocer + redirigir suave: *"Buen punto Jorge, déjame terminar este flujo y lo cogemos en Q&A"* |
| Demo se cuelga | Muy baja | Cerrar pestaña, abrir nueva, navegar de nuevo · si toma >15s decir *"recargo · mientras les cuento [punto del storyline]"* |

---

## § CAPTURAS DE PANTALLA · BACKUP (TODO jueves)

Capturar el día anterior · NO confiar en demo vivo siempre:
- [ ] Landing Visor SIGPAC público
- [ ] Visor SIGPAC con parcela encontrada + botones share
- [ ] RegantesDashboardHome KPI strip + mapa + lista socios
- [ ] ParcelDetailPage bloque "§ DECISIÓN DE RIEGO" completo
- [ ] CooperativeMembersPage con filtros

Guardar en `docs/comercial/microsoft-pitch-viernes/capturas/`. Si la demo en vivo falla, compartir las capturas en pantalla.
