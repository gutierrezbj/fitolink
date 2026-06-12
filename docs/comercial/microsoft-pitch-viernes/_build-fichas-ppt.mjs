// Generador del PPTX técnico "Fichas de información de FitoLink" para reu de
// ingenieros (12-jun-2026). Datos verificados contra el código (file:line).
// Ejecutar: node docs/comercial/microsoft-pitch-viernes/_build-fichas-ppt.mjs
import pptxgen from 'pptxgenjs';

// ── Paleta AgroM ────────────────────────────────────────────────────────
const DEEP = '1B4332', TERRA = 'E07A3C', INK = '0F2A22', PAPER = 'F4F0E8',
      PARCH = 'E8DDC9', RULE = 'C9A876', MUTED = '6B6B5C', WHITE = 'FFFFFF';
const DISP = 'Georgia', BODY = 'Calibri', MONO = 'Courier New';

const pptx = new pptxgen();
pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
pptx.layout = 'W';
pptx.author = 'AgroM · SystemRapid SL';
pptx.title = 'FitoLink · Fichas de información — guía técnica';

const W = 13.333;

// ── Helpers ─────────────────────────────────────────────────────────────
function base(eyebrow) {
  const s = pptx.addSlide();
  s.background = { color: PAPER };
  if (eyebrow) {
    s.addText(eyebrow, { x: 0.6, y: 0.4, w: 11, h: 0.3, fontFace: MONO, fontSize: 10,
      color: MUTED, charSpacing: 2, bold: false });
  }
  // footer
  s.addText('AGROM · FITOLINK · INTELIGENCIA AGRARIA DE PRECISIÓN · 2026', {
    x: 0.6, y: 7.05, w: 12, h: 0.3, fontFace: MONO, fontSize: 7, color: MUTED, charSpacing: 2 });
  return s;
}
function rule(s, y, x = 0.6, w = 1.1) {
  s.addShape(pptx.ShapeType.line, { x, y, w, h: 0, line: { color: RULE, width: 1.5 } });
}
// Bloque técnico: caja parch con label mono + líneas (texto o mono).
function block(s, { x, y, w, h, label, lines, mono = false, accent = DEEP }) {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.05,
    fill: { color: WHITE }, line: { color: RULE, width: 0.75 } });
  s.addText(label, { x: x + 0.18, y: y + 0.12, w: w - 0.3, h: 0.28, fontFace: MONO,
    fontSize: 9, color: TERRA, charSpacing: 1.5, bold: true });
  const runs = lines.map((ln) => ({
    text: ln.t ?? ln, options: {
      fontFace: ln.mono ?? mono ? MONO : BODY,
      fontSize: ln.s ?? 12, color: ln.c ?? INK, bold: ln.b ?? false,
      breakLine: true, paraSpaceAfter: ln.sp ?? 4,
    },
  }));
  s.addText(runs, { x: x + 0.18, y: y + 0.46, w: w - 0.36, h: h - 0.58, valign: 'top' });
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 1 · PORTADA
// ════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  s.background = { color: DEEP };
  s.addText('AgroM', { x: 0.7, y: 0.6, w: 4, h: 0.6, fontFace: DISP, fontSize: 26, color: WHITE, bold: true });
  s.addText('FITOLINK', { x: 2.05, y: 0.78, w: 3, h: 0.3, fontFace: MONO, fontSize: 11, color: TERRA, charSpacing: 3 });
  rule(s, 1.45, 0.72, 1.4);
  s.addText('Las fichas de información de FitoLink', {
    x: 0.7, y: 2.4, w: 11.5, h: 1.0, fontFace: DISP, fontSize: 40, color: WHITE, bold: true });
  s.addText('Qué mide cada capa, de dónde sale y cómo se lee.', {
    x: 0.7, y: 3.5, w: 11, h: 0.6, fontFace: DISP, fontSize: 22, color: 'CFE0C8', italic: true });
  s.addText([
    { text: 'Documento técnico · sesión de ingeniería · 12 jun 2026', options: { breakLine: true, paraSpaceAfter: 6 } },
    { text: 'Cada dato citado está verificado contra el código fuente (sin estimaciones de marketing).', options: {} },
  ], { x: 0.7, y: 5.5, w: 11, h: 1, fontFace: BODY, fontSize: 14, color: 'CFE0C8' });
  s.addText('fitolink.agrom.es', { x: 0.7, y: 6.9, w: 6, h: 0.3, fontFace: MONO, fontSize: 9, color: RULE, charSpacing: 2 });
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 2 · ARQUITECTURA DE CAPAS
// ════════════════════════════════════════════════════════════════════════
{
  const s = base('§ 00 · ARQUITECTURA');
  s.addText('Nueve fuentes públicas, una parcela', {
    x: 0.6, y: 0.75, w: 12, h: 0.7, fontFace: DISP, fontSize: 30, color: DEEP, bold: true });
  rule(s, 1.5);
  s.addText('Todo el cómputo pesado vive en infraestructuras públicas (Copernicus, Microsoft Planetary Computer, NASA, ISRIC, Open-Meteo). El servidor de FitoLink orquesta, cruza y sirve — no procesa imágenes.', {
    x: 0.6, y: 1.65, w: 12.1, h: 0.6, fontFace: BODY, fontSize: 13, color: MUTED });
  const cols = [
    { label: 'SATÉLITE ÓPTICO', lines: [{t:'Sentinel-2 L2A · Copernicus (openEO)',b:true}, '5 índices · 10 m · revisita ~5 d'] },
    { label: 'SATÉLITE TÉRMICO', lines: [{t:'Landsat 8/9 C2 · MS Planetary Computer',b:true}, 'LST superficie · 30 m · ~8 d'] },
    { label: 'CLIMA', lines: [{t:'ERA5 (Open-Meteo Archive)',b:true}, 'Baseline 30 años + 30 d recientes'] },
    { label: 'SUELO', lines: [{t:'SoilGrids v2 · ISRIC',b:true}, 'Textura + agua útil · 250 m · 0-30 cm'] },
    { label: 'FUEGO', lines: [{t:'VIIRS · NASA FIRMS',b:true}, 'Focos térmicos · 375 m · radio 25 km'] },
    { label: 'METEO OPERATIVA', lines: [{t:'ECMWF (Open-Meteo Forecast)',b:true}, 'Semáforo de aplicación 7 d'] },
    { label: 'FITOSANITARIO', lines: [{t:'RAIF · DARP · IVIA · IMIDA · ITACYL',b:true}, '5 boletines oficiales · 5 CC.AA.'] },
    { label: 'CATASTRO', lines: [{t:'SIGPAC · MAPA',b:true}, 'Geometría de parcela real'] },
  ];
  const cw = 3.0, ch = 1.25, gx = 0.18, gy = 0.2, x0 = 0.6, y0 = 2.35;
  cols.forEach((c, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    block(s, { x: x0 + col * (cw + gx), y: y0 + row * (ch + gy), w: cw, h: ch, label: c.label, lines: c.lines });
  });
  s.addText('→ El cruce de estas capas sobre la misma geometría es lo que ningún visor oficial aislado ofrece.', {
    x: 0.6, y: 5.65, w: 12, h: 0.4, fontFace: BODY, fontSize: 13, color: DEEP, italic: true, bold: true });
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 3 · ÍNDICES SENTINEL-2 (fórmulas)
// ════════════════════════════════════════════════════════════════════════
{
  const s = base('§ 01 · ÍNDICES ESPECTRALES — SENTINEL-2');
  s.addText('Cinco índices, cada uno mira algo distinto', {
    x: 0.6, y: 0.75, w: 12, h: 0.7, fontFace: DISP, fontSize: 28, color: DEEP, bold: true });
  rule(s, 1.5);
  block(s, { x: 0.6, y: 1.7, w: 6.05, h: 2.55, label: 'FÓRMULAS (ÁLGEBRA DE BANDAS, openeo_client.py)', mono: true, lines: [
    { t: 'NDVI = (B08 − B04) / (B08 + B04)', s: 12.5, b: true },
    { t: 'NDRE = (B08 − B05) / (B08 + B05)', s: 12.5, b: true },
    { t: 'NDMI = (B08 − B11) / (B08 + B11)', s: 12.5, b: true },
    { t: 'EVI  = 2.5·(B08−B04)/(B08+6·B04−7.5·B02+1)', s: 11 },
    { t: 'SAVI = 1.5·(B08−B04)/(B08+B04+0.5)', s: 11 },
    { t: 'B04 Red · B05 RedEdge · B08 NIR · B11 SWIR · B02 Blue', s: 9.5, c: MUTED },
  ]});
  block(s, { x: 6.85, y: 1.7, w: 5.85, h: 2.55, label: 'QUÉ REPRESENTA CADA UNO', lines: [
    { t: 'NDVI — vigor / biomasa verde. El termómetro base.', sp: 5 },
    { t: 'NDRE — clorofila vía red-edge. Sensible a N foliar y a maduración.', sp: 5 },
    { t: 'NDMI — agua en la hoja. Cae 7-14 d antes que NDVI bajo estrés hídrico.', sp: 5 },
    { t: 'EVI — densidad de dosel, corregido suelo/atmósfera.', sp: 5 },
    { t: 'SAVI — NDVI ajustado por suelo (L=0.5). Clave en dosel disperso: olivar, pistacho.' },
  ]});
  block(s, { x: 0.6, y: 4.45, w: 12.1, h: 2.25, label: 'CÓMO SE LEE', lines: [
    { t: 'Rango físico [-1, 1] (EVI/SAVI pueden exceder ±1 en suelos brillantes).', b: true, sp: 6 },
    { t: '< 0.2 suelo desnudo / sin vegetación   ·   0.2–0.4 cobertura escasa o dispersa (olivar secano)   ·   0.4–0.6 cultivo activo   ·   > 0.6 dosel denso y vigoroso.', sp: 6 },
    { t: 'No se leen en absoluto: se leen CONTRA el rango estacional del cultivo (ficha 05) y CONTRA su propia serie temporal. Un olivar de secano a 0.35 en junio es normal; un cítrico a 0.35 es alarma.', c: DEEP, b: true },
  ]});
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 4 · FUENTE SENTINEL-2
// ════════════════════════════════════════════════════════════════════════
{
  const s = base('§ 02 · FUENTE — SENTINEL-2 / openEO');
  s.addText('Cómo llega el píxel limpio', {
    x: 0.6, y: 0.75, w: 12, h: 0.7, fontFace: DISP, fontSize: 28, color: DEEP, bold: true });
  rule(s, 1.5);
  block(s, { x: 0.6, y: 1.7, w: 6.05, h: 2.6, label: 'PROVEEDOR Y MALLA', lines: [
    { t: 'Copernicus CDSE · openEO (cómputo en nube)', b: true, sp: 5 },
    { t: 'Colección SENTINEL2_L2A (reflectancia BOA)', sp: 5 },
    { t: 'Resolución 10 m (B02/B04/B08) · 20 m (B05/B11)', sp: 5 },
    { t: 'Revisita ~5 días (S2A + S2B sobre España)', sp: 5 },
    { t: 'Histórico disponible: 2017 → hoy', },
  ]});
  block(s, { x: 6.85, y: 1.7, w: 5.85, h: 2.6, label: 'LIMPIEZA EN LA NUBE (NO EN NUESTRO SERVIDOR)', lines: [
    { t: '1 · Pre-filtro nubes < 50 % de escena', sp: 5 },
    { t: '2 · Máscara SCL descarta nube, sombra, cirro, nieve, saturado [0,1,3,8,9,10,11]', sp: 5 },
    { t: '3 · Cálculo de los 5 índices', sp: 5 },
    { t: '4 · Recorte al polígono de la parcela', sp: 5 },
    { t: '5 · Composite temporal "max" → el píxel más limpio de la ventana', },
  ]});
  block(s, { x: 0.6, y: 4.5, w: 12.1, h: 2.2, label: 'CÓMO SE LEE / QUÉ GARANTIZA', lines: [
    { t: 'Cada lectura trae mean / min / max / std / pixel_count / cloud_fraction. El "min–max" no es heterogeneidad real del cultivo: en parcelas grandes captura outliers (caminos, cortijos, ribera). La heterogeneidad real se ve en el heatmap intra-parcela (ficha siguiente).', sp: 6 },
    { t: 'Coste marginal por hectárea ≈ 0: el cómputo lo hace Copernicus. Escala a 400 ha o a 50.000 ha igual.', c: DEEP, b: true },
  ]});
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 5 · HEATMAP INTRA-PARCELA
// ════════════════════════════════════════════════════════════════════════
{
  const s = base('§ 03 · HEATMAP INTRA-PARCELA (NDVI grid)');
  s.addText('La lupa dentro de la parcela', {
    x: 0.6, y: 0.75, w: 12, h: 0.7, fontFace: DISP, fontSize: 28, color: DEEP, bold: true });
  rule(s, 1.5);
  block(s, { x: 0.6, y: 1.7, w: 6.05, h: 2.7, label: 'MÉTODO — MEDIA ZONAL (BINNING)', lines: [
    { t: 'Rejilla 20×20 sobre el bbox (hasta 400 celdas)', b: true, sp: 5 },
    { t: 'Cada píxel Sentinel-2 → su celda (np.bincount, O(n))', sp: 5 },
    { t: 'Celda = media REAL de sus píxeles (sin interpolar, sin suavizar)', sp: 5 },
    { t: 'Solo se emiten celdas con ≥1 píxel y centro dentro del polígono', sp: 5 },
    { t: 'ndvi_grid.py · resolución NDVI_GRID_RESOLUTION', s: 10, c: MUTED, mono: true },
  ]});
  block(s, { x: 6.85, y: 1.7, w: 5.85, h: 2.7, label: 'POR QUÉ BINNING Y NO INTERPOLACIÓN', lines: [
    { t: 'La versión previa usaba RBF denso O(n³): una parcela de 407 ha (~40.000 px) construía una matriz ~12 GB.', sp: 6 },
    { t: 'Saturaba la CPU del servidor (aviso del proveedor) y la finca grande quedaba sin heatmap.', sp: 6 },
    { t: 'Binning es O(n), exacto y ligero: escala a cualquier tamaño. Cada celda muestra el dato real, no una estimación.', c: DEEP, b: true },
  ]});
  block(s, { x: 0.6, y: 4.6, w: 12.1, h: 2.1, label: 'CÓMO SE LEE', lines: [
    { t: 'Mapa de calor por colores NDVI sobre la geometría real: verde = zonas vigorosas, ámbar/naranja = estrés, rojo = focos. En 400 ha despieza dónde actuar — imposible a ojo o con una visita.', sp: 6 },
    { t: 'A 20×20 cada celda ≈ 1-2 ha en una finca grande. La resolución es configurable (más fino = más celdas).', c: MUTED },
  ]});
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 6 · HEALTH GAUGE + DIAGNÓSTICO ESTACIONAL
// ════════════════════════════════════════════════════════════════════════
{
  const s = base('§ 04 · DIAGNÓSTICO — GAUGE + RANGO ESTACIONAL');
  s.addText('El NDVI no se lee solo: se lee por cultivo y mes', {
    x: 0.6, y: 0.75, w: 12.2, h: 0.7, fontFace: DISP, fontSize: 26, color: DEEP, bold: true });
  rule(s, 1.5);
  block(s, { x: 0.6, y: 1.7, w: 6.05, h: 2.5, label: 'GAUGE — NDVI → SCORE (HealthScoreGauge.tsx)', mono: false, lines: [
    { t: 'score = round(NDVI × 100)', mono: true, b: true, sp: 6 },
    { t: '≥ 60 Saludable   ·   40–59 Atención', sp: 4 },
    { t: '25–39 Riesgo   ·   < 25 Crítico', sp: 6 },
    { t: 'Precedencia contextual: Sin datos > Calibrando > En establecimiento > Normal estacional > score absoluto.', c: MUTED, s: 11 },
  ]});
  block(s, { x: 6.85, y: 1.7, w: 5.85, h: 2.5, label: 'RANGO ESTACIONAL POR GRUPO DE CULTIVO', lines: [
    { t: 'olive (olivar secano) — disperso, suelo desnudo', b: true, sp: 3 },
    { t: 'evergreen (cítrico regadío) — dosel denso', sp: 3 },
    { t: 'deciduous (frutal, viña, pistacho, almendro)', sp: 3 },
    { t: 'winter_annual (cereal, patata, remolacha)', sp: 3 },
    { t: 'summer_annual (girasol, maíz, algodón, arroz)', sp: 6 },
    { t: 'Cada grupo tiene su [min, max] de NDVI normal por mes.', c: MUTED, s: 11 },
  ]});
  block(s, { x: 0.6, y: 4.4, w: 12.1, h: 2.3, label: 'CÓMO SE LEE — EJEMPLO OLIVAR DE SECANO EN JUNIO', lines: [
    { t: 'Rango normal olive·junio = [0.25, 0.52]. Una finca a NDVI 0.35 cae DENTRO → "Normal", no "Riesgo".', b: true, c: DEEP, sp: 6 },
    { t: 'Si compartiera umbral con el cítrico de regadío (evergreen junio [0.38, 0.68]), ese mismo 0.35 saltaría como "8% por debajo / acción recomendada" — un falso positivo. Por eso el olivar de secano se separó como grupo propio (11-jun-2026).', sp: 6 },
    { t: 'El sistema señala "factores a revisar" (hídrico, suelo, sanitario) e invita a inspección — NUNCA nombra un patógeno que no ha detectado.', c: MUTED },
  ]});
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 7 · TÉRMICO LST (LANDSAT)
// ════════════════════════════════════════════════════════════════════════
{
  const s = base('§ 05 · TÉRMICO — LST LANDSAT (MS Planetary Computer)');
  s.addText('La temperatura de la planta delata el estrés antes', {
    x: 0.6, y: 0.75, w: 12.4, h: 0.7, fontFace: DISP, fontSize: 26, color: DEEP, bold: true });
  rule(s, 1.5);
  block(s, { x: 0.6, y: 1.7, w: 6.05, h: 2.7, label: 'FUENTE Y CONVERSIÓN (landsat_thermal.py)', mono: false, lines: [
    { t: 'Landsat 8/9 C2 L2 · banda lwir11 (térmico)', b: true, sp: 5 },
    { t: 'MS Planetary Computer (STAC, sin auth)', sp: 5 },
    { t: '30 m/píxel · ~8 días (L8+L9) · ventana 30 d', sp: 6 },
    { t: 'T_K = DN·0.00341802 + 149.0', mono: true, sp: 3 },
    { t: 'T_°C = T_K − 273.15', mono: true },
  ]});
  block(s, { x: 6.85, y: 1.7, w: 5.85, h: 2.7, label: 'QUÉ REPRESENTA', lines: [
    { t: 'LST = temperatura de la superficie del dosel.', sp: 6 },
    { t: 'Una planta con agua transpira y se enfría. Una planta en estrés hídrico cierra estomas y se calienta.', sp: 6 },
    { t: 'El delta LST − T_aire es un proxy directo de estrés: aparece 7-14 días ANTES de que el NDVI caiga.', c: DEEP, b: true },
  ]});
  block(s, { x: 0.6, y: 4.6, w: 12.1, h: 2.1, label: 'CÓMO SE LEE', lines: [
    { t: 'Ej. real Encineño: LST 39 °C con aire ~24 °C → delta +15 °C. Lectura: estrés térmico alto, coherente con olivar de secano en sequía estival.', sp: 6 },
    { t: 'Se cruza con NDMI (agua en hoja) y con la previsión de calor: si los tres apuntan a estrés, la alerta es sólida aunque el NDVI todavía no haya bajado.', c: MUTED },
  ]});
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 8 · CLIMA ERA5 / CONTEXTO HISTÓRICO
// ════════════════════════════════════════════════════════════════════════
{
  const s = base('§ 06 · CONTEXTO CLIMÁTICO — ERA5');
  s.addText('La normal de 30 años contra los últimos 30 días',
    { x: 0.6, y: 0.75, w: 12.4, h: 0.7, fontFace: DISP, fontSize: 26, color: DEEP, bold: true });
  rule(s, 1.5);
  block(s, { x: 0.6, y: 1.7, w: 6.05, h: 2.7, label: 'DOS LÍNEAS (climate_context.py)', lines: [
    { t: 'Baseline — ERA5 reanálisis 1995–2024 (ciclo WMO 30 años)', b: true, sp: 5 },
    { t: 'Reciente — ERA5 últimos 30 días reales', b: true, sp: 6 },
    { t: 'Variables: precip_sum · temp_mean/max/min · ET0 FAO', sp: 5 },
    { t: 'Fallback TerraClimate (MPC) si Open-Meteo cae', s: 10, c: MUTED },
  ]});
  block(s, { x: 6.85, y: 1.7, w: 5.85, h: 2.7, label: 'CÁLCULOS', mono: false, lines: [
    { t: 'precip_%_normal = 100 · (30d / normal_mes)', mono: true, s: 11, sp: 4 },
    { t: 'sequía = severe<25 · moderate<50 · mild<75', mono: true, s: 11, sp: 4 },
    { t: 'aridez = precip_anual / PET_anual (Köppen)', mono: true, s: 11, sp: 6 },
    { t: 'ET0 por FAO-56 (evapotranspiración de referencia).', s: 11, c: MUTED },
  ]});
  block(s, { x: 0.6, y: 4.6, w: 12.1, h: 2.1, label: 'CÓMO SE LEE', lines: [
    { t: 'Ej. real: 2 mm acumulados en 31 días, ET0 ~204 mm, 0 días de lluvia → déficit hídrico severo. Pone el NDVI/LST en contexto: el cultivo no está mal "porque sí", está en sequía documentada.', sp: 6 },
    { t: 'Es la memoria larga del sistema: distingue "año seco" de "parcela con problema".', c: MUTED },
  ]});
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 9 · SUELO SOILGRIDS
// ════════════════════════════════════════════════════════════════════════
{
  const s = base('§ 07 · SUELO — SoilGrids v2 (ISRIC)');
  s.addText('Qué hay bajo la parcela', { x: 0.6, y: 0.75, w: 12, h: 0.7, fontFace: DISP, fontSize: 28, color: DEEP, bold: true });
  rule(s, 1.5);
  block(s, { x: 0.6, y: 1.7, w: 6.05, h: 2.7, label: 'PROPIEDADES (soilService.ts · 0-30 cm)', lines: [
    { t: 'Textura USDA: arcilla / arena / limo (%)', b: true, sp: 4 },
    { t: 'Capacidad de campo (agua útil, wv0033)', sp: 4 },
    { t: 'Carbono orgánico (soc)', sp: 4 },
    { t: 'Densidad aparente (bdod)', sp: 6 },
    { t: 'Muestreo en el centroide · 250 m · media ponderada de capas 0-5, 5-15, 15-30 cm', s: 11, c: MUTED },
  ]});
  block(s, { x: 6.85, y: 1.7, w: 5.85, h: 2.7, label: 'QUÉ REPRESENTA', lines: [
    { t: 'La textura define cuánta agua retiene el suelo y cuánta drena.', sp: 6 },
    { t: 'La capacidad de campo alimenta el balance hídrico de la decisión de riego (ficha 11).', sp: 6 },
    { t: 'El carbono orgánico es proxy de fertilidad y estructura.', c: DEEP, b: true },
  ]});
  block(s, { x: 0.6, y: 4.6, w: 12.1, h: 2.1, label: 'CÓMO SE LEE', lines: [
    { t: 'Ej. real Encineño: "Franco arcilloso" (35,4% arcilla · 24,9% arena · 39,8% limo), agua útil 32%, carbono 15 g/kg, densidad 1,49. Un franco arcilloso retiene bien el agua pero drena lento.', sp: 6 },
    { t: 'No cambia con el tiempo: es el sustrato fijo sobre el que se interpreta todo lo demás.', c: MUTED },
  ]});
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 10 · METEO 7D / SEMÁFORO
// ════════════════════════════════════════════════════════════════════════
{
  const s = base('§ 08 · METEO OPERATIVA — SEMÁFORO DE APLICACIÓN');
  s.addText('Cuándo se puede volar y tratar', { x: 0.6, y: 0.75, w: 12, h: 0.7, fontFace: DISP, fontSize: 28, color: DEEP, bold: true });
  rule(s, 1.5);
  block(s, { x: 0.6, y: 1.7, w: 6.05, h: 3.1, label: 'MODO FITOSANITARIO (suitability.ts · estricto)', mono: false, lines: [
    { t: 'Viento  > 5 m/s prohibido · 3-5 precaución', s: 11, sp: 4 },
    { t: 'Ráfagas > 7 m/s prohibido', s: 11, sp: 4 },
    { t: 'Lluvia  > 0.1 mm o prob > 60% prohibido (lava producto)', s: 11, sp: 4 },
    { t: 'Temp    < 5 ó > 30 °C prohibido', s: 11, sp: 4 },
    { t: 'Humedad < 30% precaución (deriva por aire seco)', s: 11, sp: 6 },
    { t: 'Modo inspección: más permisivo (viento ≤10, nubes ≤80%, franja 10-16 h).', s: 10.5, c: MUTED },
  ]});
  block(s, { x: 6.85, y: 1.7, w: 5.85, h: 3.1, label: 'FUENTE Y LÓGICA', lines: [
    { t: 'Open-Meteo Forecast (ECMWF/IFS) · 7 días horarios.', sp: 5 },
    { t: 'Variables: viento, ráfagas, lluvia, prob, temp, humedad, nubes, ET0.', sp: 5 },
    { t: 'Precedencia: Prohibido > Precaución > OK > Ideal.', sp: 5 },
    { t: 'Horas laborables 8-18 h. Agregado diario = mejor ventana disponible del día.', c: DEEP, b: true },
  ]});
  block(s, { x: 0.6, y: 4.95, w: 12.1, h: 1.75, label: 'CÓMO SE LEE', lines: [
    { t: 'Semáforo por hora y por día: verde = ventana de aplicación, rojo = no volar. Convierte la previsión meteo en una decisión operativa directa para el piloto — sin que tenga que interpretar 7 variables a mano.', },
  ]});
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 11 · FOCOS FIRMS
// ════════════════════════════════════════════════════════════════════════
{
  const s = base('§ 09 · FOCOS TÉRMICOS — NASA FIRMS');
  s.addText('Fuego cerca de la parcela, casi en tiempo real', { x: 0.6, y: 0.75, w: 12.4, h: 0.7, fontFace: DISP, fontSize: 26, color: DEEP, bold: true });
  rule(s, 1.5);
  block(s, { x: 0.6, y: 1.7, w: 6.05, h: 2.7, label: 'FUENTE (fireService.ts)', lines: [
    { t: 'VIIRS Suomi-NPP + NOAA-20 · 375 m', b: true, sp: 5 },
    { t: 'NASA FIRMS · cuasi-tiempo-real (~3 h)', sp: 5 },
    { t: 'Ventana 5 días · radio 25 km del centroide', sp: 5 },
    { t: 'Distancia por haversine · filtra confidence "low"', sp: 5 },
    { t: 'Campos: brightness (K) · FRP (MW) · día/noche', s: 11, c: MUTED },
  ]});
  block(s, { x: 6.85, y: 1.7, w: 5.85, h: 2.7, label: 'QUÉ REPRESENTA', lines: [
    { t: 'Cada punto es un píxel donde el sensor térmico detecta una anomalía de calor (fuego activo).', sp: 6 },
    { t: 'FRP (Fire Radiative Power) es la intensidad energética del foco; brightness el brillo del canal de 4 µm.', sp: 6 },
    { t: 'Confidence "low" se descarta por defecto (reflejos industriales, falsos positivos).', c: MUTED },
  ]});
  block(s, { x: 0.6, y: 4.6, w: 12.1, h: 2.1, label: 'CÓMO SE LEE', lines: [
    { t: '"Sin focos activos en su zona" = tranquilidad verificada. Si aparece un foco, se ordena por distancia y por brillo: lo primero que ve el agricultor es el fuego más cercano e intenso.', sp: 6 },
    { t: 'Es una capa de seguridad, no agronómica: protege la cosecha de un riesgo externo.', c: MUTED },
  ]});
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 12 · ANÁLISIS PREDICTIVO
// ════════════════════════════════════════════════════════════════════════
{
  const s = base('§ 10 · PROYECCIÓN — ANÁLISIS PREDICTIVO');
  s.addText('Hacia dónde va la tendencia', { x: 0.6, y: 0.75, w: 12, h: 0.7, fontFace: DISP, fontSize: 28, color: DEEP, bold: true });
  rule(s, 1.5);
  block(s, { x: 0.6, y: 1.7, w: 6.05, h: 2.7, label: 'MÉTODO (predictiveInsightService.ts)', mono: false, lines: [
    { t: 'Regresión lineal por mínimos cuadrados', b: true, sp: 4 },
    { t: 'Ventana: últimas 5 lecturas (mín. 3)', sp: 4 },
    { t: 'slope/día → tendencia:', sp: 3 },
    { t: '< −0.001 descendente · ±0.001 estable · > +0.001 ascendente', mono: true, s: 10, sp: 6 },
    { t: 'Sin LLM. Transparente y explicable.', s: 11, c: MUTED },
  ]});
  block(s, { x: 6.85, y: 1.7, w: 5.85, h: 2.7, label: 'PROYECCIÓN A UMBRAL', mono: false, lines: [
    { t: 'días_a_crítico = (NDVI − floor) / |slope|', mono: true, s: 11, sp: 6 },
    { t: 'floor = SEASONAL_FLOOR del cultivo/mes (olivar secano junio = 0.25).', sp: 6 },
    { t: 'Confianza atada al nº de lecturas: 5→alta, 4→media, 3→baja. No infla certeza con pocos puntos.', c: DEEP, b: true },
  ]});
  block(s, { x: 0.6, y: 4.6, w: 12.1, h: 2.1, label: 'CÓMO SE LEE', lines: [
    { t: '"Tendencia estable · 0.35 / floor 0.25 · confianza baja (3 lecturas)" → el cultivo no se desvía y aún hay poco histórico. Cuando la serie crece, la proyección gana fiabilidad sola.', sp: 6 },
    { t: 'Honesto por diseño: con pocas lecturas dice "confianza baja", no inventa una fecha crítica.', c: MUTED },
  ]});
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 13 · DECISIÓN DE RIEGO
// ════════════════════════════════════════════════════════════════════════
{
  const s = base('§ 11 · DECISIÓN DE RIEGO (BUMM)');
  s.addText('Del dato al metro cúbico', { x: 0.6, y: 0.75, w: 12, h: 0.7, fontFace: DISP, fontSize: 28, color: DEEP, bold: true });
  rule(s, 1.5);
  block(s, { x: 0.6, y: 1.7, w: 6.05, h: 2.7, label: 'BALANCE HÍDRICO (irrigationDecisionService.ts)', mono: false, lines: [
    { t: 'Entradas: NDVI · suelo (AWC) · clima 14 d · Kc cultivo · superficie', b: true, sp: 5 },
    { t: 'Kc FAO-56: olivo 0.55 · cítrico 0.75 · maíz 1.05 …', s: 11, sp: 4 },
    { t: 'AWC = capacidad_campo · 0.30 m · 1000 (mm)', mono: true, s: 10.5, sp: 4 },
    { t: 'ET0 ≈ clamp(2,8, 0.2·Tmedia − 0.5) mm/día', mono: true, s: 10.5 },
  ]});
  block(s, { x: 6.85, y: 1.7, w: 5.85, h: 2.7, label: 'NORMATIVA Y SALIDA', lines: [
    { t: 'Cupo libre y cupo con RD 950/2024 (−20% por sequía).', b: true, sp: 5 },
    { t: 'Urgencia: urgente / pronto / vigilar / suficiente.', sp: 5 },
    { t: 'Narrativa determinística (plantillas, NO LLM) → cero alucinación, incluye nota fenológica del cultivo/mes.', c: DEEP, b: true },
  ]});
  block(s, { x: 0.6, y: 4.6, w: 12.1, h: 2.1, label: 'CÓMO SE LEE', lines: [
    { t: 'Para roles agregadores (comunidad de regantes): déficit estimado en mm, cupo recomendado en m³, y el recorte legal del RD ya aplicado. Convierte teledetección en una cifra accionable y conforme a normativa.', sp: 6 },
    { t: 'El "cómo" operativo (tratamiento, dron) queda fuera: FitoLink informa el QUÉ; la aplicación la coordina la red de pilotos certificados.', c: MUTED },
  ]});
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 14 · AVISOS FITOSANITARIOS
// ════════════════════════════════════════════════════════════════════════
{
  const s = base('§ 12 · AVISOS FITOSANITARIOS OFICIALES');
  s.addText('El canal oficial cruzado con tu parcela', { x: 0.6, y: 0.75, w: 12.3, h: 0.7, fontFace: DISP, fontSize: 26, color: DEEP, bold: true });
  rule(s, 1.5);
  block(s, { x: 0.6, y: 1.7, w: 6.05, h: 2.7, label: '5 FUENTES OFICIALES (pestAdvisoryService.ts)', lines: [
    { t: 'RAIF (Andalucía) · DARP (Cataluña)', b: true, sp: 4 },
    { t: 'SAIF/IVIA (C. Valenciana) · SIAM/IMIDA (Murcia)', b: true, sp: 4 },
    { t: 'ITACYL (Castilla y León)', b: true, sp: 6 },
    { t: 'Curación: el equipo técnico transcribe el boletín oficial (cifras literales) — no scraping a ciegas. Idempotente por fingerprint.', s: 11, c: MUTED },
  ]});
  block(s, { x: 6.85, y: 1.7, w: 5.85, h: 2.7, label: 'MATCHING PARCELA ↔ AVISO', mono: false, lines: [
    { t: '1 · Coincidencia de cultivo + vigente', sp: 5 },
    { t: '2 · haversine(parcela, foco_aviso) ≤ radiusKm', mono: true, s: 11, sp: 5 },
    { t: 'Cada aviso lleva centroide + radio de la comarca afectada y enlace a la fuente oficial.', sp: 5 },
    { t: 'Solo te llega lo de TU comarca y TU cultivo.', c: DEEP, b: true },
  ]});
  block(s, { x: 0.6, y: 4.6, w: 12.1, h: 2.1, label: 'CÓMO SE LEE', lines: [
    { t: 'Ej. real: Prays oleae (polilla del olivo), comarca Subbética, 35,1% de aceitunas con bicho vivo sobre umbral 20%, a 19,7 km de la finca — cifra literal del RAIF, con enlace al boletín de la Junta.', sp: 6 },
    { t: 'Principio: vendemos el CANAL, no el diagnóstico. El dato es del organismo oficial; nosotros lo geolocalizamos.', c: MUTED },
  ]});
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 15 · SÍNTESIS → MOMENTO ÓPTIMO DE COSECHA
// ════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  s.background = { color: DEEP };
  s.addText('§ SÍNTESIS · HACIA LA VENTANA DE COSECHA', { x: 0.7, y: 0.5, w: 11, h: 0.3, fontFace: MONO, fontSize: 10, color: RULE, charSpacing: 2 });
  s.addText('Cómo todo esto converge en la cosecha', { x: 0.7, y: 0.95, w: 12, h: 0.8, fontFace: DISP, fontSize: 30, color: WHITE, bold: true });
  rule(s, 1.85, 0.72, 1.4);
  s.addText([
    { text: 'La pregunta del fondo — el momento óptimo de recolección de la aceituna — no es una ficha más: es la convergencia de varias capas a lo largo del tiempo.', options: { fontSize: 15, color: 'CFE0C8', breakLine: true, paraSpaceAfter: 14, bold: true } },
    { text: '· NDRE (clorofila vía red-edge) traza la maduración: desciende cuando el fruto entra en envero.', options: { fontSize: 13.5, color: WHITE, breakLine: true, paraSpaceAfter: 7 } },
    { text: '· NDMI (agua en hoja) y LST (térmico) marcan el estado hídrico de la campaña.', options: { fontSize: 13.5, color: WHITE, breakLine: true, paraSpaceAfter: 7 } },
    { text: '· La acumulación térmica (ERA5) y la fenología por cultivo sitúan la fase: en olivo, jun-ago es endurecimiento de hueso; el envero llega en otoño.', options: { fontSize: 13.5, color: WHITE, breakLine: true, paraSpaceAfter: 7 } },
    { text: '· La serie temporal de cada índice — que hoy se construye cada ~5 días — es la base sobre la que, con campañas acumuladas, se afina la ventana óptima.', options: { fontSize: 13.5, color: WHITE, breakLine: true, paraSpaceAfter: 14 } },
    { text: 'Posición honesta: FitoLink no entrega hoy un "índice de cosecha" cerrado. Entrega las capas que lo componen, midiéndose ya sobre la finca real. La recomendación de cosecha es la evolución natural de este seguimiento — no una promesa de marketing.', options: { fontSize: 13.5, color: RULE, italic: true } },
  ], { x: 0.7, y: 2.15, w: 12, h: 4.4, valign: 'top' });
  s.addText('AgroM · FitoLink · fitolink.agrom.es', { x: 0.7, y: 7.0, w: 8, h: 0.3, fontFace: MONO, fontSize: 8, color: MUTED, charSpacing: 2 });
}

// ── Guardar ─────────────────────────────────────────────────────────────
const out = 'docs/comercial/microsoft-pitch-viernes/AgroM-FitoLink-Fichas-Tecnicas.pptx';
await pptx.writeFile({ fileName: out });
console.log('OK →', out);
