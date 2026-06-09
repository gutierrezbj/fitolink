# Demo guion · Discovery Microsoft viernes
**Snapshot:** 2026-06-09 · 12:00 Madrid · v0.1 borrador inicial

3 minutos de demo en vivo · WOW factor + sustancia editorial.
**Acompaña al storyline · este documento contiene los clicks y la voz en off.**

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

## § VARIANTE A · CON KMZ de Jorge (preferida si llega)

**Pre-requisito** · trabajo del miércoles/jueves:
- Jorge manda KMZ
- Crear cuenta `jorge-demo-001` en producción
- Importar parcelas a su cuenta
- Esperar 1-2 pasadas pipeline Sentinel-2 (si las parcelas son nuevas zona) · si no llega tiempo, plan B sembrar `ndviHistory` plausible con disclaimer honesto

### Click-by-click

**[0:00 – 0:30] Hook personal**

> *"Jorge me mandó las coordenadas de sus parcelas. Las hemos importado a una cuenta dedicada en producción. Lo que verán es FitoLink procesando datos reales sobre las parcelas reales de Jorge."*

- Click pestaña Login
- Email field · escribir `jorge-demo-001` · botón Entrar
- Aterriza en DashboardHome

**[0:30 – 1:30] Mapa cartera + KPIs**

> *"Aquí ve sus parcelas todas localizadas sobre SIGPAC oficial · referencias catastrales reales · cuando le decimos a Jorge que está viendo su parcela, está viendo SU parcela, no un cuadrado simulado."*

- Pausar en el mapa 5 segundos
- Mover el cursor sobre KPI strip · destacar `NDVI medio cartera` y `% parcelas en alerta`

> *"Encima del mapa los KPIs de la cartera completa. NDVI medio cartera 0.XX. X% de las parcelas en alerta. Es la primera respuesta al gerente: ¿cómo está hoy lo mío?"*

**[1:30 – 2:30] Click parcela específica · BUMM Decisión de Riego**

> *"Voy a entrar en una parcela específica · esto es donde la conversación con un cliente cambia."*

- Click una parcela del mapa (preferir una con NDVI < 0.40 si la hay)
- Aterriza en ParcelDetailPage
- Scroll lento hasta el bloque "§ DECISIÓN DE RIEGO"

> *"Lo que verán aquí es una decisión, no datos. **BUMM Decisión de Riego**. Le dice al gerente: 'urgencia X · razón Y · cupo de agua sugerido Z metros cúbicos · con RD 950/2024 aplicado el cupo baja a W'. Y debajo, una sección de análisis integrado que cruza 6-8 variables: estado satelital + suelo + clima reciente + fenología del cultivo. Sin LLM. Plantillas server-side. Cero alucinación."*

- Subrayar visualmente con el cursor:
  - el bloque cupo m³ con border AgroM
  - la sección "§ ANÁLISIS INTEGRADO"

**[2:30 – 3:00] Cierre demo · vuelta a vista cartera**

- Botón back · vuelve al dashboard
- Wave general sobre el mapa

> *"Esto es lo que un gerente de Comunidad de Regantes o cooperativa ve cada mañana cuando entra a FitoLink. La promesa: convertir 8 fuentes externas en UNA decisión."*

**Cierre demo · vuelve al storyline § 5:30 Tracción**

---

## § VARIANTE B · SIN KMZ (plan B robusto)

**Activar si**: Jorge no manda KMZ a tiempo / parcelas zona nueva no procesadas / cualquier issue.

### Hook 1 · Visor SIGPAC público en vivo (60s)

> *"Voy a empezar enseñándoles algo que TODA España puede usar gratis · sin registrarse · sin pagar. Es nuestro segundo regalo al mercado."*

- Click pestaña 2 · `fitolink.agrom.es/sigpac`
- Mostrar landing del visor (3 segundos · que vean el lenguaje editorial sobrio)

> *"Es el Visor SIGPAC público de AgroM. Cualquier agricultor de España entra y consulta su parcela catastral en segundos. Hoy hay que conocer la web del Ministerio · saber tu provincia, municipio, polígono, parcela, recinto · ir a 4 sitios distintos. Aquí: una sola caja."*

- Pedir a Jorge que dicte:
  > *"Jorge, dime una provincia y un municipio donde tengas o conozcas alguna parcela. Cualquiera."*
- Mientras Jorge responde · escribir provincia + muni en los selectores
- Si Jorge no responde rápido → usar ejemplo de fallback: Sevilla / Estepa

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
