// Informe técnico (resumen) + plan de trabajo (Fase 0, en días, sin fechas)
// para el estudio de viabilidad del motor predictivo de cosecha. Registro de
// consultor, honesto. Ejecutar: node docs/comercial/_build-informe-plan.mjs
import fs from 'fs';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType,
  ImageRun, Footer, PageNumber,
} from 'docx';

const DEEP = '1B4332', TERRA = 'E07A3C', INK = '0F2A22', MUTED = '6B6B5C', WHITE = 'FFFFFF';
const SERIF = 'Georgia', SANS = 'Arial';
const LOGO = '/Users/juanguti/dev/srs/fitolink/apps/web/public/brand/agrom-wordmark.png';
const OUT = '/Users/juanguti/dev/srs/fitolink/docs/comercial/AgroM-Informe-Plan-Cosecha.docx';

const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const P = (t, opts = {}) => new Paragraph({
  spacing: { after: 140, line: 276 },
  children: [new TextRun({ text: t, font: SANS, size: 22, color: opts.color ?? INK, italics: opts.italic, bold: opts.bold })],
});
const LIb = (lead, t) => new Paragraph({
  numbering: { reference: 'b', level: 0 }, spacing: { after: 80, line: 264 },
  children: [
    new TextRun({ text: lead + ' — ', font: SANS, size: 22, color: DEEP, bold: true }),
    new TextRun({ text: t, font: SANS, size: 22, color: INK }),
  ],
});
const eyebrow = (t) => new Paragraph({ spacing: { after: 40 },
  children: [new TextRun({ text: t, font: SANS, size: 16, color: MUTED, characterSpacing: 30 })] });
const kv = (k, v) => new Paragraph({ spacing: { before: 120, after: 120 }, children: [
  new TextRun({ text: k + ' ', font: SANS, size: 22, bold: true, color: DEEP }),
  new TextRun({ text: v, font: SANS, size: 22, color: INK }) ] });

const tcell = (t, { w, head = false, bold = false } = {}) => new TableCell({
  width: { size: w, type: WidthType.DXA },
  shading: { fill: head ? DEEP : 'F4F0E8', type: ShadingType.CLEAR },
  margins: { top: 90, bottom: 90, left: 130, right: 130 },
  children: [new Paragraph({ children: [new TextRun({ text: t, font: SANS, size: head ? 19 : 20, color: head ? WHITE : INK, bold: head || bold })] })],
});
const COLS = [3100, 1450, 4810];
const mkTable = (rows) => new Table({
  width: { size: 9360, type: WidthType.DXA }, columnWidths: COLS,
  rows: rows.map((r, i) => new TableRow({ tableHeader: i === 0,
    children: r.map((txt, j) => tcell(txt, { w: COLS[j], head: i === 0, bold: i > 0 && j === 0 })) })),
});
const tableA = mkTable([
  ['Bloque', 'Días', 'Actividad'],
  ['A1 · Datos', 'Día 1–5', 'Estructuración del histórico de cosecha aportado por el fondo + ingesta del satélite (Sentinel-2) y clima de las parcelas muestra.'],
  ['A2 · Modelado', 'Día 4–12', 'Ingeniería de variables, entrenamiento del modelo y validación por backtesting temporal.'],
  ['A3 · Viabilidad', 'Día 12–15', '¿Correlaciona la señal con el rendimiento real? Informe de viabilidad y presentación.'],
]);
const tableB = mkTable([
  ['Bloque', 'Días', 'Actividad'],
  ['B1 · Vuelo', 'Día 1 · 1 jornada', 'Vuelo fotogramétrico de las parcelas piloto con dron Mavic 3E propio. Ventana estable en verano.'],
  ['B2 · Procesado', 'Día 2–5', 'Ortomosaico (Metashape, acelerado por GPU) + censo de árboles e índices por copa.'],
]);

const doc = new Document({
  styles: {
    default: { document: { run: { font: SANS, size: 22, color: INK } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, font: SERIF, color: DEEP },
        paragraph: { spacing: { before: 320, after: 140 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 23, bold: true, font: SERIF, color: DEEP },
        paragraph: { spacing: { before: 200, after: 90 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: 'b', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
      style: { run: { color: TERRA }, paragraph: { indent: { left: 460, hanging: 260 } } } }] },
  ] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'C9A876', space: 6 } },
      tabStops: [{ type: 'right', position: 9360 }],
      children: [
        new TextRun({ text: 'AgroM · Inteligencia agraria aplicada', font: SANS, size: 15, color: MUTED }),
        new TextRun({ text: '\tPág. ', font: SANS, size: 15, color: MUTED }),
        new TextRun({ children: [PageNumber.CURRENT], font: SANS, size: 15, color: MUTED }),
      ],
    })] }) },
    children: [
      new Paragraph({ spacing: { after: 60 }, children: [new ImageRun({
        type: 'png', data: fs.readFileSync(LOGO), transformation: { width: 196, height: 61 },
        altText: { title: 'AgroM', description: 'Logo AgroM', name: 'AgroM' } })] }),
      eyebrow('INTELIGENCIA AGRARIA APLICADA'),
      new Paragraph({ spacing: { after: 60 },
        children: [new TextRun({ text: 'Motor predictivo de cosecha de olivar', font: SERIF, size: 38, bold: true, color: DEEP })] }),
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C9A876', space: 6 } }, spacing: { after: 160 },
        children: [new TextRun({ text: 'Informe técnico y plan de trabajo · Estudio de viabilidad (Fase 0)', font: SERIF, size: 22, italics: true, color: MUTED })] }),
      P('Documento de trabajo. Su contenido es un supuesto a confirmar —o descartar— con dato real; no describe un producto cerrado.', { italic: true, color: MUTED }),

      H1('1 · Contexto y objetivo'),
      P('El momento de recogida condiciona el resultado de la campaña de olivar. A escala de varios miles de hectáreas, optimizar esa decisión parcela a parcela no es viable a ojo.'),
      P('Este estudio evalúa la viabilidad técnica de un motor predictivo que anticipe dos cosas: el momento óptimo de cosecha y el rendimiento de la campaña, para optimizar la planificación de la recogida.'),

      H1('2 · Informe técnico (resumen)'),
      H2('2.1 · Punto de partida'),
      P('AgroM opera hoy sistemas de inteligencia agraria aplicada (monitorización del estado del cultivo). El motor predictivo es un desarrollo nuevo que evoluciona esa base — una capacidad distinta de la monitorización.'),
      H2('2.2 · Capas de datos'),
      LIb('Satélite (Sentinel-2, datos abiertos)', 'vigor y maduración del cultivo.'),
      LIb('Clima', 'acumulación térmica y disponibilidad de agua.'),
      LIb('Campo (dron)', 'resolución a nivel de árbol, donde el satélite no alcanza.'),
      LIb('Histórico de cosecha (del fondo)', 'la referencia para entrenar y validar.'),
      H2('2.3 · Método'),
      P('Modelos de aprendizaje supervisado, interpretables, validados por backtesting temporal. Dos salidas: fecha óptima de cosecha y estimación de rendimiento. (No se detallan aquí algoritmos ni variables.)'),
      H2('2.4 · Estado actual'),
      P('Se han realizado pruebas de laboratorio con datos sintéticos: la maquinaria del modelo está validada sobre estructura conocida (por ejemplo, predicción de la fecha óptima con un error del orden de unos días). El modelo real requiere el histórico del fondo para entrenarse y validarse sobre dato propio. Esto valida el método, no el cultivo.'),

      H1('3 · Qué necesitamos para validar'),
      P('Sobre una muestra acotada de campañas — la necesaria para confirmar si la señal correlaciona con el rendimiento:'),
      LIb('Datos', 'una muestra de vuestro histórico de cosecha: kilos, fechas de recogida e índice de madurez, de varias campañas.'),
      LIb('Acceso', 'a las parcelas piloto, para la ingesta de campo por dron durante la campaña.'),

      H1('4 · Plan de trabajo (Fase 0)'),
      P('Estudio acotado, en días relativos desde la entrega de la muestra de datos. Una nota técnica importante: el cómputo no es el cuello de botella —entrenar y validar son días, no semanas—; el ritmo lo marcan la entrega del histórico y la ventana de vuelo (favorable en verano).'),
      P('La viabilidad y el dron corren en PARALELO. El núcleo del estudio no depende del dron: se resuelve sobre el histórico de cosecha y el satélite. El dron añade el detalle por árbol.'),
      H2('Vía A · Viabilidad (camino crítico)'),
      tableA,
      H2('Vía B · Dron / detalle por árbol (en paralelo)'),
      tableB,
      kv('Duración estimada:', '~2–3 semanas (≈ 15 días laborables) desde la entrega de los datos. El bloque de dron —vuelo de 1 jornada + procesado— corre dentro de esa ventana, no la alarga.'),
      kv('Entregable:', 'informe de viabilidad — una respuesta clara (sí / no) con la precisión estimada, sobre vuestro dato real.'),

      H1('5 · Resultado y siguiente paso'),
      P('El estudio responde a una pregunta concreta: ¿es viable el motor predictivo sobre vuestro dato, y con qué precisión?'),
      P('Si el resultado es positivo, sienta la base para una Fase 1: consolidación del modelo y extensión a más parcelas. Si no lo es, se cierra con un coste acotado y una conclusión técnica clara.'),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('OK →', OUT); });
