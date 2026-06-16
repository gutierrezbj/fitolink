// Deck · ESTUDIO DE VIABILIDAD TÉCNICA — motor predictivo de cosecha (olivar).
// Registro: consultor de negocio senior / ingenieros, ante un fondo que sabe.
// NO venta. Supuesto, no hechos. "Datos abiertos" (no gratis). Muestreo (no
// cesión total). Viabilidad técnica (no convencer). Ejecutar:
//   node docs/comercial/_build-piloto-cosecha.mjs
import pptxgen from 'pptxgenjs';

const DEEP = '1B4332', TERRA = 'E07A3C', INK = '0F2A22', PAPER = 'F4F0E8',
      RULE = 'C9A876', MUTED = '6B6B5C', WHITE = 'FFFFFF', CREAM = 'CFE0C8';
const DISP = 'Georgia', BODY = 'Calibri', MONO = 'Courier New';
const CHART = '/Users/juanguti/dev/srs/fitolink/sandbox/modelo-cosecha';

const pptx = new pptxgen();
pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
pptx.layout = 'W';
pptx.author = 'AgroM · SystemRapid SL';
pptx.title = 'Motor predictivo de cosecha · Estudio de viabilidad técnica';

function base(eyebrow) {
  const s = pptx.addSlide();
  s.background = { color: PAPER };
  if (eyebrow) s.addText(eyebrow, { x: 0.6, y: 0.4, w: 12, h: 0.3, fontFace: MONO,
    fontSize: 10, color: MUTED, charSpacing: 2 });
  s.addText('AGROM · INTELIGENCIA AGRARIA APLICADA · 2026', {
    x: 0.6, y: 7.08, w: 12, h: 0.3, fontFace: MONO, fontSize: 7, color: MUTED, charSpacing: 2 });
  return s;
}
function dark(eyebrow) {
  const s = pptx.addSlide();
  s.background = { color: DEEP };
  if (eyebrow) s.addText(eyebrow, { x: 0.7, y: 0.5, w: 12, h: 0.3, fontFace: MONO,
    fontSize: 10, color: TERRA, charSpacing: 3 });
  return s;
}
function rule(s, y, x = 0.6, w = 1.2, color = RULE) {
  s.addShape(pptx.ShapeType.line, { x, y, w, h: 0, line: { color, width: 1.5 } });
}
function title(s, t, y = 0.78, color = DEEP, size = 28) {
  s.addText(t, { x: 0.6, y, w: 12.1, h: 1.0, fontFace: DISP, fontSize: size, color, bold: true });
}
function block(s, { x, y, w, h, label, lines, accent = TERRA }) {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.05,
    fill: { color: WHITE }, line: { color: RULE, width: 0.75 } });
  s.addText(label, { x: x + 0.2, y: y + 0.16, w: w - 0.35, h: 0.3, fontFace: MONO,
    fontSize: 9, color: accent, charSpacing: 1.5, bold: true });
  const runs = lines.map((ln) => ({ text: ln.t ?? ln, options: {
    fontFace: ln.mono ? MONO : BODY, fontSize: ln.s ?? 12.5, color: ln.c ?? INK,
    bold: ln.b ?? false, breakLine: true, paraSpaceAfter: ln.sp ?? 5 } }));
  s.addText(runs, { x: x + 0.2, y: y + 0.52, w: w - 0.4, h: h - 0.66, valign: 'top' });
}

// ── 1 · PORTADA ─────────────────────────────────────────────────────────
{
  const s = pptx.addSlide(); s.background = { color: DEEP };
  s.addText('AgroM', { x: 0.7, y: 0.55, w: 4, h: 0.6, fontFace: DISP, fontSize: 26, color: WHITE, bold: true });
  s.addText('INTELIGENCIA AGRARIA APLICADA', { x: 2.0, y: 0.73, w: 5, h: 0.3, fontFace: MONO, fontSize: 10, color: TERRA, charSpacing: 2 });
  rule(s, 1.4, 0.72, 1.4);
  s.addText('Hacia un motor predictivo\nde cosecha de olivar', {
    x: 0.7, y: 2.0, w: 12, h: 1.5, fontFace: DISP, fontSize: 38, color: WHITE, bold: true });
  s.addText('Estudio de viabilidad técnica · Fase 0', {
    x: 0.7, y: 3.7, w: 11, h: 0.6, fontFace: DISP, fontSize: 22, color: CREAM, italic: true });
  s.addText('Documento de trabajo · 17 jun 2026', {
    x: 0.7, y: 5.7, w: 11, h: 0.4, fontFace: BODY, fontSize: 14, color: CREAM });
  s.addText('agrom.es · fitolink.agrom.es', { x: 0.7, y: 6.95, w: 7, h: 0.3, fontFace: MONO, fontSize: 9, color: 'E8EFE2', charSpacing: 2 });
}

// ── 2 · EL PUNTO DE OPTIMIZACIÓN ────────────────────────────────────────
{
  const s = base('§ 01 · EL PUNTO DE OPTIMIZACIÓN');
  title(s, 'El momento de recogida condiciona el resultado');
  rule(s, 1.5);
  s.addText([
    { text: 'Recoger fuera de la ventana óptima puede penalizar una parte relevante del valor de la cosecha.', options: { breakLine: true, paraSpaceAfter: 10 } },
    { text: 'Las referencias de sector sitúan ese margen en el orden del 20–25%.', options: { italic: true, color: MUTED } },
  ], { x: 0.6, y: 1.9, w: 8.0, h: 2.0, fontFace: BODY, fontSize: 17, color: INK, valign: 'top' });
  block(s, { x: 9.1, y: 2.0, w: 3.6, h: 2.9, label: 'A ESCALA',
    lines: [
      { t: 'En 4.500 ha, optimizar la recogida parcela a parcela no es viable a ojo.', sp: 12 },
      { t: 'La logística tiende a imponerse sobre el óptimo agronómico, y parte de la superficie se recoge fuera de su ventana.' },
    ] });
  s.addText('Un punto de optimización con impacto potencial en el rendimiento.', {
    x: 0.6, y: 5.7, w: 8.2, h: 0.6, fontFace: DISP, fontSize: 18, color: DEEP, italic: true });
}

// ── 3 · MONITORIZAR vs PREDECIR ─────────────────────────────────────────
{
  const s = base('§ 02 · DOS CAPACIDADES DISTINTAS');
  title(s, 'Monitorizar y predecir no son lo mismo');
  rule(s, 1.5);
  block(s, { x: 0.6, y: 2.0, w: 5.9, h: 2.5, label: 'HOY · OPERATIVO', accent: MUTED,
    lines: [
      { t: 'Inteligencia agraria aplicada', b: true, s: 14, c: DEEP },
      { t: 'Monitorización del estado del cultivo, funcionando hoy sobre datos reales.', sp: 8 },
      { t: 'Es un servicio con otro destinatario (agricultor, cooperativa).', c: MUTED },
    ] });
  block(s, { x: 6.85, y: 2.0, w: 5.9, h: 2.5, label: 'LO QUE PROPONEMOS EXPLORAR', accent: TERRA,
    lines: [
      { t: 'Un motor predictivo', b: true, s: 14, c: DEEP },
      { t: 'Evolucionar esos sistemas para anticipar cuándo recoger y cuánto.', sp: 8 },
      { t: 'Objetivo: optimizar el momento y la planificación de la cosecha para mejorar el rendimiento.' },
    ] });
  s.addText('Es un desarrollo nuevo, distinto de lo que ya hacemos. Aquí evaluamos su viabilidad.', {
    x: 0.6, y: 4.85, w: 12, h: 0.5, fontFace: BODY, fontSize: 14, color: MUTED, italic: true });
}

// ── 4 · LO EXPLORADO, EN LABORATORIO ────────────────────────────────────
{
  const s = base('§ 03 · LO QUE YA HEMOS EXPLORADO');
  title(s, 'Somos gente de campo y gente digital');
  rule(s, 1.5);
  s.addText('La serie de Encineño es real (Sentinel-2, datos abiertos). Sobre ella, en laboratorio y con datos sintéticos, hemos probado la maquinaria del modelo — con resultados preliminares que invitan a continuar. No es un producto cerrado: es la hipótesis, ya en marcha.', {
    x: 0.6, y: 1.62, w: 12.1, h: 0.7, fontFace: BODY, fontSize: 13.5, color: INK });
  s.addImage({ path: `${CHART}/encineno_serie.png`, x: 1.55, y: 2.45, w: 10.2, h: 4.0 });
  s.addText('Vuestra finca, respirando en la herramienta.', {
    x: 0.6, y: 6.55, w: 12, h: 0.4, fontFace: BODY, fontSize: 13, color: DEEP, italic: true, align: 'center' });
}

// ── 4b · EL MOTOR, PROBADO EN LABORATORIO ───────────────────────────────
{
  const s = base('§ 04 · EL MOTOR, PROBADO EN LABORATORIO');
  title(s, 'El motor del «cuándo», probado en laboratorio');
  rule(s, 1.5);
  s.addImage({ path: `${CHART}/encineno_timing.png`, x: 1.12, y: 1.65, w: 11.1, h: 4.44 });
  s.addText([
    { text: 'Izquierda: sobre datos sintéticos, el motor predice la fecha óptima de recogida con ~4 días de error — valida el método, no el cultivo.', options: { breakLine: true, paraSpaceAfter: 3 } },
    { text: 'Derecha: la señal real de maduración (envero) de Encineño, que el motor lee. El resultado real llega con vuestro dato.', options: {} },
  ], { x: 0.6, y: 6.2, w: 12.1, h: 0.8, fontFace: BODY, fontSize: 11.5, color: MUTED, italic: true, align: 'center' });
}

// ── 5 · DE DÓNDE SALEN LOS DATOS ────────────────────────────────────────
{
  const s = base('§ 05 · LAS FUENTES');
  title(s, 'De dónde salen los datos');
  rule(s, 1.5);
  block(s, { x: 0.6, y: 2.0, w: 5.9, h: 2.5, label: 'DATOS ABIERTOS', accent: DEEP,
    lines: [
      { t: 'Satélite (Sentinel-2 · Copernicus) y clima (ERA5).', b: true, c: DEEP },
      { t: 'Acceso abierto · 10 m de resolución · revisita ~5 días.', sp: 8 },
      { t: 'Histórico de varios años disponible.', c: MUTED },
    ] });
  block(s, { x: 6.85, y: 2.0, w: 5.9, h: 2.5, label: 'INGESTA DE CAMPO', accent: TERRA,
    lines: [
      { t: 'Por dron, para el detalle que el satélite no alcanza.', b: true, c: DEEP },
      { t: 'Resolución a nivel de árbol.', sp: 8 },
      { t: 'En el piloto, lo volamos nosotros.' },
    ] });
}

// ── 6 · EL PILOTO = MUESTREO PARA VALIDAR ───────────────────────────────
{
  const s = base('§ 06 · QUÉ NECESITAMOS PARA VALIDAR');
  title(s, 'Qué necesitamos para validar el enfoque');
  rule(s, 1.5);
  s.addText('Sobre una muestra acotada de campañas — la necesaria para confirmar si la señal correlaciona con vuestro rendimiento:', {
    x: 0.6, y: 1.9, w: 12.0, h: 0.8, fontFace: BODY, fontSize: 16, color: INK });
  block(s, { x: 0.6, y: 3.0, w: 5.9, h: 2.2, label: 'DATOS',
    lines: [
      { t: 'Vuestro histórico de cosecha', b: true, s: 14, c: DEEP, sp: 7 },
      { t: 'Kilos, fechas de recogida e índice de madurez, de varias campañas.' },
    ] });
  block(s, { x: 6.85, y: 3.0, w: 5.9, h: 2.2, label: 'ACCESO',
    lines: [
      { t: 'A las parcelas piloto', b: true, s: 14, c: DEEP, sp: 7 },
      { t: 'Para la ingesta de campo por dron durante la campaña.' },
    ] });
  s.addText('Con eso establecemos —o descartamos— la viabilidad, sobre vuestro dato real.', {
    x: 0.6, y: 5.55, w: 12, h: 0.5, fontFace: DISP, fontSize: 18, color: DEEP, italic: true });
}

// ── 7 · QUÉ BUSCAMOS / EL SIGUIENTE PASO ────────────────────────────────
{
  const s = dark('§ 07 · EL SIGUIENTE PASO');
  s.addText('Saber si funciona requiere comprobarlo', {
    x: 0.7, y: 1.5, w: 12, h: 0.9, fontFace: DISP, fontSize: 32, color: WHITE, bold: true });
  rule(s, 2.55, 0.72, 1.4, TERRA);
  s.addText([
    { text: 'Este enfoque puede optimizar vuestros rendimientos. Es una hipótesis — y la única forma de confirmarla, o descartarla, es comprobarla sobre vuestro dato real.', options: { breakLine: true, paraSpaceAfter: 14 } },
    { text: 'Hay un interés legítimo y compartido en saberlo.', options: { breakLine: true, paraSpaceAfter: 14, color: 'E8EFE2' } },
    { text: 'El paso que proponemos es concreto: realizar el piloto.', options: { bold: true } },
  ], { x: 0.7, y: 3.0, w: 11.6, h: 3.2, fontFace: BODY, fontSize: 19, color: WHITE, valign: 'top' });
}

// ── 9 · CIERRE ──────────────────────────────────────────────────────────
{
  const s = dark('');
  s.addText('Comprobémoslo juntos', {
    x: 0.8, y: 1.6, w: 11.7, h: 0.9, fontFace: DISP, fontSize: 34, color: WHITE, bold: true });
  rule(s, 2.65, 0.82, 1.6, TERRA);
  s.addText([
    { text: 'Hay un interés legítimo y compartido: saber si este enfoque optimiza vuestra cosecha.', options: { breakLine: true, paraSpaceAfter: 14 } },
    { text: 'Con un esfuerzo conjunto lo comprobamos sobre vuestro dato real — y, si funciona, consolidamos el modelo.', options: {} },
  ], { x: 0.8, y: 3.1, w: 11.6, h: 2.2, fontFace: DISP, fontSize: 20, color: CREAM, valign: 'top' });
  s.addText('Coordinación: Jorge Leccia   ·   Equipo técnico: AgroM   ·   agrom.es · fitolink.agrom.es', {
    x: 0.8, y: 6.75, w: 11.7, h: 0.4, fontFace: MONO, fontSize: 10, color: 'E8EFE2', charSpacing: 1 });
}

const OUT = '/Users/juanguti/dev/srs/fitolink/docs/comercial/AgroM-Piloto-Cosecha-Fondo.pptx';
await pptx.writeFile({ fileName: OUT });
console.log('OK →', OUT);
