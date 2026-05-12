#!/usr/bin/env node
/**
 * AgroM · FitoLink — Informe de Capacidades
 * Pitch deck 5 slides para cliente pistacho (mediado por John).
 *
 * Identidad AgroM Identity Sprint v0.1.
 * Generado con pptxgenjs.
 */
const pptxgen = require('pptxgenjs');
const path = require('path');

// ── Brand tokens (AgroM Identity Sprint v0.1) ─────────────────────────
const C = {
  deep:    '1B4332',
  terra:   'E07A3C',
  ink:     '0F2A22',
  paper:   'F4F0E8',
  parch:   'E8DDC9',
  rule:    'C9A876',
  muted:   '6B6B5C',
};

// Fonts (with system fallback chains via the PPTX font face name).
const F = {
  display: 'Georgia',          // Fraunces fallback for max compatibility
  body:    'Calibri',          // IBM Plex Sans fallback
  mono:    'Consolas',         // IBM Plex Mono fallback
};

// ── Brand assets (local PNGs) ──────────────────────────────────────────
const ASSET_DIR = '/Users/juanguti/dev/srs/fitolink/apps/web/public/brand';
const WORDMARK = path.join(ASSET_DIR, 'agrom-wordmark.png');
const MONOGRAM = path.join(ASSET_DIR, 'agrom-monogram.png');

// ── Layout constants (LAYOUT_WIDE: 13.333" × 7.5") ─────────────────────
const W = 13.333;
const H = 7.5;
const MARGIN = 0.6;          // outer margin

// ── Helper builders ────────────────────────────────────────────────────
function setBackground(slide) {
  slide.background = { color: C.paper };
}

function eyebrow(slide, text, x, y, w = 6) {
  slide.addText(text, {
    x, y, w, h: 0.3,
    fontFace: F.mono,
    fontSize: 10,
    color: C.muted,
    bold: true,
    charSpacing: 4,
    align: 'left',
    margin: 0,
  });
}

function hairline(slide, x, y, w, color = C.rule) {
  slide.addShape('line', {
    x, y, w, h: 0,
    line: { color, width: 0.75 },
  });
}

function footer(slide) {
  // Hairline above footer
  hairline(slide, MARGIN, H - 0.55, W - MARGIN * 2);
  slide.addText('AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN · 2026', {
    x: MARGIN, y: H - 0.45, w: W - MARGIN * 2, h: 0.3,
    fontFace: F.mono,
    fontSize: 8,
    color: C.muted,
    charSpacing: 4,
    align: 'left',
    margin: 0,
  });
  slide.addText('agrom.es · fitolink.systemrapid.io', {
    x: MARGIN, y: H - 0.45, w: W - MARGIN * 2, h: 0.3,
    fontFace: F.mono,
    fontSize: 8,
    color: C.muted,
    charSpacing: 2,
    align: 'right',
    margin: 0,
  });
}

// ────────────────────────────────────────────────────────────────────────
// SETUP
// ────────────────────────────────────────────────────────────────────────
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'AgroM';
pres.title = 'AgroM · FitoLink — Informe de Capacidades';

// ════════════════════════════════════════════════════════════════════════
// SLIDE 1 · PORTADA
// ════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setBackground(s);

  // Wordmark — agrom-wordmark.png is 1600×500 aspect ratio (3.2:1)
  // Display ~5" wide → 1.56" tall
  const logoW = 5.0;
  const logoH = logoW / 3.2;
  s.addImage({
    path: WORDMARK,
    x: (W - logoW) / 2,
    y: 1.8,
    w: logoW,
    h: logoH,
  });

  // Hairline below logo
  hairline(s, (W - 1.2) / 2, 3.7, 1.2);

  // Main title
  s.addText('Inteligencia agraria de precisión', {
    x: 1, y: 3.9, w: W - 2, h: 0.9,
    fontFace: F.display,
    fontSize: 44,
    color: C.deep,
    align: 'center',
    bold: false,
    margin: 0,
  });

  // Subtitle (italic)
  s.addText('Para su explotación de pistacho', {
    x: 1, y: 4.85, w: W - 2, h: 0.6,
    fontFace: F.display,
    fontSize: 22,
    color: C.muted,
    italic: true,
    align: 'center',
    margin: 0,
  });

  // Single footer eyebrow — combines brand & url, anchored low
  s.addText('AGROM · INFORME DE CAPACIDADES · 2026   ·   agrom.es', {
    x: 1, y: 6.95, w: W - 2, h: 0.3,
    fontFace: F.mono,
    fontSize: 10,
    color: C.muted,
    charSpacing: 4,
    align: 'center',
    margin: 0,
  });
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 2 · EL PROBLEMA
// ════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setBackground(s);

  // Eyebrow
  eyebrow(s, '§ 01 · CONTEXTO', MARGIN, MARGIN);

  // Titular
  s.addText('Hoy se trata el campo a ciegas.', {
    x: MARGIN, y: MARGIN + 0.4, w: W - MARGIN * 2, h: 0.9,
    fontFace: F.display,
    fontSize: 40,
    color: C.deep,
    align: 'left',
    margin: 0,
  });

  // Hairline
  hairline(s, MARGIN, MARGIN + 1.35, 0.8);

  // Three blocks horizontal layout
  const colW = (W - MARGIN * 2 - 0.8) / 3;
  const colGap = 0.4;
  // Titles rewritten so all three wrap to ~2 lines at fontSize 19 within colW.
  // Keeps the horizontal grid aligned (subagent flagged inconsistent wrapping).
  const blocks = [
    {
      eb: '§ 01.1',
      title: 'Aplicación uniforme,\nsin diagnóstico previo',
      body: 'El tratamiento se aplica igual en toda la parcela aunque solo una parte lo necesite. Más producto del necesario, más coste, más impacto ambiental.',
    },
    {
      eb: '§ 01.2',
      title: 'Sin evidencia técnica\npara PAC ni seguros',
      body: 'Cuando llega una inspección o un siniestro, no hay historial verificable del estado del cultivo antes del evento.',
    },
    {
      eb: '§ 01.3',
      title: 'Reacción tardía\na plagas y estrés',
      body: 'Para cuando el daño se ve a simple vista, ya está hecho. Falta una vigilancia continua que avise antes.',
    },
  ];

  blocks.forEach((b, i) => {
    const x = MARGIN + i * (colW + colGap);
    const y = MARGIN + 2;

    // Mini eyebrow terra
    s.addText(b.eb, {
      x, y, w: colW, h: 0.3,
      fontFace: F.mono,
      fontSize: 9,
      color: C.terra,
      bold: true,
      charSpacing: 3,
      align: 'left',
      margin: 0,
    });

    // Block title — reserved height for 2 lines so body anchors stay aligned
    s.addText(b.title, {
      x, y: y + 0.4, w: colW, h: 1.3,
      fontFace: F.display,
      fontSize: 19,
      color: C.deep,
      align: 'left',
      valign: 'top',
      margin: 0,
    });

    // Body — anchored just below the reserved title area
    s.addText(b.body, {
      x, y: y + 1.85, w: colW, h: 2.0,
      fontFace: F.body,
      fontSize: 13,
      color: C.ink,
      align: 'left',
      valign: 'top',
      margin: 0,
      paraSpaceAfter: 4,
    });
  });

  footer(s);
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 3 · CÓMO FUNCIONA (4 capas)
// ════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setBackground(s);

  // Eyebrow
  eyebrow(s, '§ 02 · MÉTODO', MARGIN, MARGIN);

  // Titular
  s.addText('Cuatro capas que se activan en cadena.', {
    x: MARGIN, y: MARGIN + 0.4, w: W - MARGIN * 2, h: 0.9,
    fontFace: F.display,
    fontSize: 38,
    color: C.deep,
    align: 'left',
    margin: 0,
  });

  // Hairline
  hairline(s, MARGIN, MARGIN + 1.35, 0.8);

  // 4 columns
  const colW = (W - MARGIN * 2 - 0.3 * 3) / 4;  // 4 cols with 3 gaps of 0.3
  const colGap = 0.3;
  const steps = [
    {
      num: 'I',
      name: 'SATÉLITE COPERNICUS',
      body: 'Cada 5 días, imagen del Sentinel-2 europeo sobre sus parcelas. Calculamos cinco índices del estado del cultivo, incluida la zona infrarroja que el ojo no ve.',
    },
    {
      num: 'II',
      name: 'INTELIGENCIA ARTIFICIAL',
      body: 'Un modelo entrenado con miles de patrones detecta caídas anómalas en cada parcela, cruzando datos del histórico de 5 años y del clima reciente.',
    },
    {
      num: 'III',
      name: 'DRON DE PRECISIÓN',
      body: 'Donde hace falta, un piloto certificado aplica solo en las zonas afectadas. Tasa variable basada en datos reales, no en cálculo a ojo.',
    },
    {
      num: 'IV',
      name: 'CUADERNO DIGITAL',
      body: 'Cada aplicación queda registrada con firma electrónica y trazabilidad. Cumple normativa PAC sin papeleo añadido.',
    },
  ];

  steps.forEach((step, i) => {
    const x = MARGIN + i * (colW + colGap);
    const y = MARGIN + 1.9;

    // Big roman number in terra
    s.addText(step.num, {
      x, y, w: colW, h: 1.2,
      fontFace: F.display,
      fontSize: 64,
      color: C.terra,
      align: 'left',
      margin: 0,
    });

    // Step name uppercase — fontSize 13 + tighter charSpacing so even the
    // longest ("INTELIGENCIA ARTIFICIAL") fits on a single line, keeping
    // the body anchors aligned across all 4 columns.
    s.addText(step.name, {
      x, y: y + 1.25, w: colW, h: 0.5,
      fontFace: F.display,
      fontSize: 13,
      color: C.deep,
      bold: true,
      charSpacing: 0,
      align: 'left',
      valign: 'top',
      margin: 0,
    });

    // Body
    s.addText(step.body, {
      x, y: y + 1.85, w: colW, h: 2.2,
      fontFace: F.body,
      fontSize: 11,
      color: C.ink,
      align: 'left',
      margin: 0,
      paraSpaceAfter: 3,
    });

    // Vertical separator hairline between columns (skip after last)
    if (i < steps.length - 1) {
      const sepX = x + colW + colGap / 2;
      s.addShape('line', {
        x: sepX, y: y, w: 0, h: 3.5,
        line: { color: C.rule, width: 0.5 },
      });
    }
  });

  footer(s);
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 4 · QUÉ RECIBE CADA MAÑANA
// ════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setBackground(s);

  // Eyebrow
  eyebrow(s, '§ 03 · ENTREGABLE PRINCIPAL', MARGIN, MARGIN);

  // Titular
  s.addText('Un informe diario en su correo, a las 7 de la mañana.', {
    x: MARGIN, y: MARGIN + 0.4, w: W - MARGIN * 2, h: 0.9,
    fontFace: F.display,
    fontSize: 32,
    color: C.deep,
    align: 'left',
    margin: 0,
  });

  // Hairline
  hairline(s, MARGIN, MARGIN + 1.35, 0.8);

  // Layout: left email mockup 55%, right summary 45%
  // contentY moved up + contentH increased so the mockup has room for all
  // three sections without overflowing (subagent flagged overflow bug).
  const contentY = MARGIN + 1.55;
  const contentH = H - contentY - 0.75;
  const totalW = W - MARGIN * 2;
  const leftW = totalW * 0.55 - 0.3;
  const rightW = totalW * 0.45 - 0.3;
  const leftX = MARGIN;
  const rightX = MARGIN + leftW + 0.6;

  // ── LEFT: email mockup ──
  // White box with rule border
  s.addShape('rect', {
    x: leftX, y: contentY, w: leftW, h: contentH,
    fill: { color: 'FFFFFF' },
    line: { color: C.rule, width: 1 },
  });

  // Header of email
  const padding = 0.3;
  let emailY = contentY + padding;

  s.addText('─── AgroM · Inteligencia agraria ───', {
    x: leftX, y: emailY, w: leftW, h: 0.25,
    fontFace: F.mono,
    fontSize: 8,
    color: C.muted,
    align: 'center',
    margin: 0,
  });
  emailY += 0.3;

  s.addText('INFORME DE CAMPO', {
    x: leftX, y: emailY, w: leftW, h: 0.3,
    fontFace: F.display,
    fontSize: 16,
    color: C.deep,
    bold: true,
    charSpacing: 2,
    align: 'center',
    margin: 0,
  });
  emailY += 0.35;

  s.addText('12 de mayo de 2026', {
    x: leftX, y: emailY, w: leftW, h: 0.22,
    fontFace: F.body,
    fontSize: 10,
    color: C.muted,
    align: 'center',
    margin: 0,
  });
  emailY += 0.35;

  hairline(s, leftX + padding, emailY, leftW - padding * 2);
  emailY += 0.12;

  // Helper: render a section block with eyebrow + body. Compact heights to
  // keep all three sections inside the white card without overflow.
  const sections = [
    {
      eb: '§ 01 · ESTADO DE SUS PARCELAS',
      body: 'Una de sus parcelas presenta tendencia descendente. Si se mantiene, entra en zona crítica alrededor del 22 de mayo. El resto se mantiene estable.',
    },
    {
      eb: '§ 02 · METEO PARA LA SEMANA',
      body: 'Viernes y sábado: ola de calor (35-37°). Sin lluvia prevista 7 días. Riegue antes del jueves. Ventana dron apta: jueves 14h y sábado 9h.',
    },
    {
      eb: '§ 03 · AVISO FITOSANITARIO',
      body: 'Actividad de polilla detectada en su zona esta semana. Severidad media. Sus parcelas en seguimiento reforzado los próximos 7 días.',
    },
  ];

  sections.forEach((sec) => {
    s.addText(sec.eb, {
      x: leftX + padding, y: emailY, w: leftW - padding * 2, h: 0.25,
      fontFace: F.mono,
      fontSize: 9,
      color: C.terra,
      bold: true,
      charSpacing: 2,
      align: 'left',
      margin: 0,
    });
    emailY += 0.28;
    s.addText(sec.body, {
      x: leftX + padding, y: emailY, w: leftW - padding * 2, h: 0.85,
      fontFace: F.body,
      fontSize: 10,
      color: C.ink,
      align: 'left',
      valign: 'top',
      margin: 0,
      paraSpaceAfter: 2,
    });
    emailY += 0.92;
  });

  // ── RIGHT: summary blocks ──
  const summaryBlocks = [
    {
      eb: '§ ESTADO DE CULTIVO',
      body: 'Tendencia satelital semanal con proyección de cuándo entrará en zona crítica.',
    },
    {
      eb: '§ METEOROLOGÍA OPERATIVA',
      body: 'Las ventanas reales para regar o aplicar con dron, con 7 días de antelación.',
    },
    {
      eb: '§ AVISOS DE SU COMARCA',
      body: 'Alertas de plagas detectadas oficialmente cerca de sus parcelas.',
    },
  ];

  const blockH = contentH / 3 - 0.1;
  summaryBlocks.forEach((b, i) => {
    const y = contentY + i * (blockH + 0.15);
    // Hairline top
    hairline(s, rightX, y, rightW);

    s.addText(b.eb, {
      x: rightX, y: y + 0.15, w: rightW, h: 0.3,
      fontFace: F.mono,
      fontSize: 9,
      color: C.terra,
      bold: true,
      charSpacing: 3,
      align: 'left',
      margin: 0,
    });

    s.addText(b.body, {
      x: rightX, y: y + 0.55, w: rightW, h: blockH - 0.55,
      fontFace: F.body,
      fontSize: 12,
      color: C.ink,
      align: 'left',
      margin: 0,
      paraSpaceAfter: 4,
    });
  });

  footer(s);
}

// ════════════════════════════════════════════════════════════════════════
// SLIDE 5 · PRÓXIMO PASO
// ════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  setBackground(s);

  // Eyebrow
  eyebrow(s, '§ 04 · COLABORACIÓN', MARGIN, MARGIN);

  // Titular — explicit breakLine ensures the second sentence drops to its
  // own line (manual \n behaves inconsistently across PPTX renderers).
  s.addText([
    { text: 'Primero le demostramos el valor.', options: { breakLine: true } },
    { text: 'Después hablamos.' },
  ], {
    x: MARGIN, y: MARGIN + 0.4, w: W - MARGIN * 2, h: 1.8,
    fontFace: F.display,
    fontSize: 38,
    color: C.deep,
    align: 'left',
    valign: 'top',
    margin: 0,
  });

  // Subtitle — kept italic for editorial cue, now in deep (same hue as the
  // title) so it sits as voice-of-brand rather than fading into the paper.
  s.addText('Programa de validación de 60 días sin compromiso.', {
    x: MARGIN, y: MARGIN + 2.1, w: W - MARGIN * 2, h: 0.5,
    fontFace: F.display,
    fontSize: 19,
    color: C.deep,
    italic: true,
    align: 'left',
    margin: 0,
  });

  // Hairline
  hairline(s, MARGIN, MARGIN + 2.6, 0.8);

  // 3 bullets horizontal grid — eyebrow copy trimmed so all 3 fit in 1 line
  const bulletY = MARGIN + 2.95;
  const bulletH = 1.7;
  const bulletW = (W - MARGIN * 2 - 0.5 * 2) / 3;
  const bulletGap = 0.5;
  const bullets = [
    {
      eb: '· 60 DÍAS INCLUIDOS',
      body: 'Acceso completo al informe diario y al panel.',
    },
    {
      eb: '· APLICACIÓN A DEMANDA',
      body: 'Cobramos solo por la hectárea efectivamente tratada con dron.',
    },
    {
      eb: '· SIN PERMANENCIA',
      body: 'Si al cabo de los 60 días no le aporta valor, se cierra el ciclo sin papeleo.',
    },
  ];

  bullets.forEach((b, i) => {
    const x = MARGIN + i * (bulletW + bulletGap);

    // Eyebrow box height tightened so the body anchors directly underneath
    // (the previous 0.4 reservation left an unnatural ~0.4" gap).
    s.addText(b.eb, {
      x, y: bulletY, w: bulletW, h: 0.28,
      fontFace: F.mono,
      fontSize: 10,
      color: C.terra,
      bold: true,
      charSpacing: 2,
      align: 'left',
      valign: 'top',
      margin: 0,
    });

    s.addText(b.body, {
      x, y: bulletY + 0.32, w: bulletW, h: bulletH - 0.32,
      fontFace: F.body,
      fontSize: 14,
      color: C.ink,
      align: 'left',
      valign: 'top',
      margin: 0,
      paraSpaceAfter: 4,
    });
  });

  // Contact block on parch — short and clean, links live in master footer
  const contactY = MARGIN + 5.1;
  const contactH = 1.1;
  s.addShape('rect', {
    x: MARGIN, y: contactY, w: W - MARGIN * 2, h: contactH,
    fill: { color: C.parch },
    line: { type: 'none' },
  });

  // Eyebrow
  s.addText('CONTACTO', {
    x: MARGIN + 0.5, y: contactY + 0.2, w: W - MARGIN * 2 - 1.0, h: 0.3,
    fontFace: F.mono,
    fontSize: 10,
    color: C.deep,
    bold: true,
    charSpacing: 4,
    align: 'left',
    margin: 0,
  });

  // Two contact lines side by side
  const halfW = (W - MARGIN * 2 - 1.0) / 2;
  s.addText('Coordinación operativa — Jonh Yanga Núñez', {
    x: MARGIN + 0.5, y: contactY + 0.55, w: halfW, h: 0.4,
    fontFace: F.display,
    fontSize: 17,
    color: C.deep,
    align: 'left',
    margin: 0,
  });
  s.addText('Equipo técnico — AgroM', {
    x: MARGIN + 0.5 + halfW, y: contactY + 0.55,
    w: halfW, h: 0.4,
    fontFace: F.display,
    fontSize: 17,
    color: C.deep,
    align: 'left',
    margin: 0,
  });

  footer(s);
}

// ────────────────────────────────────────────────────────────────────────
const OUT = '/Users/juanguti/dev/srs/fitolink/docs/comercial/AgroM-FitoLink-Capacidades.pptx';
pres.writeFile({ fileName: OUT }).then((f) => {
  console.log('OK:', f);
}).catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
