/**
 * reportService · Bloque B · 05-jun-2026.
 *
 * Genera reportes PDF + CSV editoriales AgroM a partir del overview de
 * cartera agregada (cooperative / adv / regantes). Stack:
 *   · pdfkit (nativo Node, sin Chromium · ~70KB)
 *   · CSV con escape manual minimalista (sin librería extra)
 *
 * Reportes generados:
 *   · Cartera agregada PDF · KPIs + tabla socios + firma editorial
 *   · Cartera agregada CSV · tabla tabular para Excel
 *
 * Llamado desde controller que pasa el overview ya calculado por
 * cooperativeService.getOverview(). No vuelve a consultar Mongo.
 */
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { cropLabel } from '@fitolink/shared';

// Tipos compatibles con el shape devuelto por cooperativeService.getOverview.
// Replicamos aquí para no acoplar el módulo al service (testeable aislado).
export interface ReportMember {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  parcelCount: number;
  areaHa: number;
  ndviAvg: number | null;
  alertCount: number;
  criticalAlertCount: number;
  worstParcel: { _id: string; name: string; ndvi: number } | null;
}

export interface ReportKpis {
  memberCount: number;
  parcelCount: number;
  areaHa: number;
  ndviAvg: number | null;
  activeAlerts: number;
  criticalAlerts: number;
  parcelsBelowCritical: number;
}

export interface ReportInput {
  entityName: string; // nombre cooperativa/ADV/comunidad
  entityRole: 'cooperative' | 'adv' | 'regantes';
  generatedAt: Date;
  kpis: ReportKpis;
  members: ReportMember[];
}

// ─────────────────────────────────────────────────────────────────────────
// Paleta AgroM (replicada · pdfkit no entiende Tailwind)
// ─────────────────────────────────────────────────────────────────────────
const BRAND_600 = '#46632e'; // verde topographic
const TERRA_500 = '#d45220'; // naranja brand
const INK = '#0F2A22';
const MUTED = '#6B6B5C';
const RULE = '#C9A876';
const PAPER = '#F4F0E8';

// Etiqueta del rol para el copy editorial del PDF
function roleLabel(role: ReportInput['entityRole']): string {
  if (role === 'cooperative') return 'Cooperativa';
  if (role === 'adv') return 'Agrupación de Defensa Vegetal';
  return 'Comunidad de Regantes';
}

function ndviLabel(n: number | null): string {
  if (n === null) return 'sin datos';
  if (n < 0.3) return 'crítico';
  if (n < 0.45) return 'bajo';
  if (n < 0.55) return 'medio';
  return 'sano';
}

function formatDateEs(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${day} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatDateTimeEs(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDateEs(d)} · ${hh}:${mm}`;
}

function formatShortEs(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${String(d.getFullYear()).slice(2)}`;
}

// ─────────────────────────────────────────────────────────────────────────
// PDF · Cartera agregada
// ─────────────────────────────────────────────────────────────────────────

/**
 * Genera PDF de cartera agregada y lo devuelve como stream legible.
 * El controller hace pipe() al response Express.
 */
export function generateCarteraPdf(input: ReportInput): Readable {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Cartera · ${input.entityName}`,
      Author: 'AgroM · FitoLink',
      Subject: 'Reporte de cartera agregada',
      CreationDate: input.generatedAt,
    },
  });

  // ── Header editorial ────────────────────────────────────────────────
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(MUTED)
    .text('AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN', { characterSpacing: 2 });

  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(80, doc.y).strokeColor(TERRA_500).lineWidth(1.5).stroke();
  doc.moveDown(1);

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(MUTED)
    .text(`§ CARTERA AGREGADA · ${roleLabel(input.entityRole).toUpperCase()}`, { characterSpacing: 1.5 });

  doc.moveDown(0.3);

  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor(INK)
    .text(input.entityName);

  doc.moveDown(0.3);

  doc
    .font('Helvetica-Oblique')
    .fontSize(11)
    .fillColor(MUTED)
    .text(`Informe generado el ${formatDateEs(input.generatedAt)}`);

  doc.moveDown(1.5);

  // ── KPIs cartera ─────────────────────────────────────────────────────
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(MUTED)
    .text('§ INDICADORES CLAVE DE LA CARTERA', { characterSpacing: 1.5 });

  doc.moveDown(0.5);

  const kpis = input.kpis;
  const kpiRows: [string, string][] = [
    ['Socios vigilados', String(kpis.memberCount)],
    ['Parcelas monitorizadas', String(kpis.parcelCount)],
    ['Superficie total', `${kpis.areaHa.toFixed(1)} ha`],
    ['NDVI medio cartera', kpis.ndviAvg !== null ? kpis.ndviAvg.toFixed(2) : '—'],
    ['Avisos activos', String(kpis.activeAlerts)],
    ['Parcelas críticas (NDVI < 0.30)', String(kpis.parcelsBelowCritical)],
  ];

  doc.font('Helvetica').fontSize(11).fillColor(INK);
  const kpiStartY = doc.y;
  kpiRows.forEach(([label, value], idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 50 + col * 250;
    const y = kpiStartY + row * 28;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(label, x, y, { width: 230 });
    doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text(value, x, y + 11, { width: 230 });
  });
  doc.y = kpiStartY + Math.ceil(kpiRows.length / 2) * 28 + 10;

  doc.moveDown(1);

  // ── Tabla socios ─────────────────────────────────────────────────────
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(MUTED)
    .text('§ DETALLE POR SOCIO', { characterSpacing: 1.5 });

  doc.moveDown(0.5);

  // Header tabla
  const tableTop = doc.y;
  const colX = { name: 50, parcels: 280, area: 340, ndvi: 410, alerts: 480 };
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND_600);
  doc.text('Socio', colX.name, tableTop);
  doc.text('Parc.', colX.parcels, tableTop);
  doc.text('Ha', colX.area, tableTop);
  doc.text('NDVI', colX.ndvi, tableTop);
  doc.text('Avisos', colX.alerts, tableTop);

  // Línea bajo header
  doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).strokeColor(RULE).lineWidth(0.5).stroke();

  // Filas · ordenadas por urgencia (alerts desc + NDVI asc)
  const sortedMembers = [...input.members].sort((a, b) => {
    if (a.alertCount !== b.alertCount) return b.alertCount - a.alertCount;
    const aN = a.ndviAvg ?? 1;
    const bN = b.ndviAvg ?? 1;
    return aN - bN;
  });

  let rowY = tableTop + 22;
  sortedMembers.forEach((m, idx) => {
    // Salto de página si necesario
    if (rowY > 760) {
      doc.addPage();
      rowY = 50;
    }
    const isCritical = (m.ndviAvg ?? 1) < 0.3 || m.alertCount > 0;
    doc.font('Helvetica').fontSize(10).fillColor(isCritical ? TERRA_500 : INK);
    doc.text(`${String(idx + 1).padStart(2, '0')} · ${m.name}`, colX.name, rowY, { width: 220 });
    doc.fillColor(INK);
    doc.text(String(m.parcelCount), colX.parcels, rowY);
    doc.text(m.areaHa.toFixed(1), colX.area, rowY);
    if (m.ndviAvg !== null) {
      doc.text(`${m.ndviAvg.toFixed(2)} (${ndviLabel(m.ndviAvg)})`, colX.ndvi, rowY);
    } else {
      doc.fillColor(MUTED).text('—', colX.ndvi, rowY);
      doc.fillColor(INK);
    }
    if (m.alertCount > 0) {
      doc.fillColor(TERRA_500).text(String(m.alertCount), colX.alerts, rowY);
      doc.fillColor(INK);
    } else {
      doc.text('—', colX.alerts, rowY);
    }
    rowY += 18;
  });

  // ── Footer ───────────────────────────────────────────────────────────
  doc.moveDown(3);
  if (doc.y < 720) doc.y = 720;
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(RULE).lineWidth(0.5).stroke();
  doc.moveDown(0.5);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(MUTED)
    .text(
      'Datos generados a partir de Sentinel-2 (Copernicus ESA) + ISRIC SoilGrids 250m + ERA5 (Microsoft Planetary Computer) + SIGPAC catastral oficial MAPA. Geometrías auditables desde el visor SIGPAC.',
      50,
      doc.y,
      { width: 495, align: 'left' },
    );
  doc.moveDown(0.5);
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(MUTED)
    .text('AGROM · FITOLINK · agrom.es · fitolink.agrom.es', { characterSpacing: 1.5, align: 'center' });

  doc.end();

  return doc as unknown as Readable;
}

// ─────────────────────────────────────────────────────────────────────────
// PDF · Informe de aplicación (por operación de dron)
// ─────────────────────────────────────────────────────────────────────────

export interface ApplicationReportInput {
  generatedAt: Date;
  clientName: string;
  operator: { company?: string; pilotName?: string };
  parcel: { name: string; cropType: string; province?: string; sigpacRef?: string; areaHa?: number };
  completedAt?: Date;
  flightLog?: { startTime?: Date; endTime?: Date; areaHa?: number };
  // Mezcla aplicada — nombre + dosis + unidad (g/ha, L/ha…).
  products: Array<{ name: string; dose: number; unit: string; note?: string }>;
  applicationMethod?: string;
  weather?: { temp: number; windKmh: number; humidity: number } | null;
  prescription?: { ref: string; signedBy: string } | null;
}

/**
 * PDF del informe de aplicación de UNA operación: parcela tratada, productos
 * (mezcla) con dosis + unidad, método, condiciones meteo, registro de vuelo y
 * el operador con el marco AESA (honesto: AgroM coordina, el operador de dron
 * certificado ejecuta). Reutiliza la paleta/estilo del PDF de cartera.
 */
export function generateApplicationPdf(input: ApplicationReportInput): Readable {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Informe de aplicación · ${input.parcel.name}`,
      Author: 'AgroM · FitoLink',
      Subject: 'Informe de aplicación aérea con dron',
      CreationDate: input.generatedAt,
    },
  });

  const section = (label: string) => {
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(label, 50, doc.y, { characterSpacing: 1.5 });
    doc.moveDown(0.4);
  };
  const kv = (k: string, v: string) => {
    const y = doc.y;
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(k, 50, y, { width: 175 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(v, 230, y, { width: 315 });
    doc.moveDown(0.3);
  };

  // ── Header editorial ──
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
    .text('AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN', { characterSpacing: 2 });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(80, doc.y).strokeColor(TERRA_500).lineWidth(1.5).stroke();
  doc.moveDown(1);
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('§ INFORME DE APLICACIÓN', { characterSpacing: 1.5 });
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(22).fillColor(INK).text(`Aplicación en ${input.parcel.name}`);
  doc.moveDown(0.3);
  doc.font('Helvetica-Oblique').fontSize(11).fillColor(MUTED).text(`Cliente: ${input.clientName}`);
  doc.moveDown(0.2);
  const fecha = input.completedAt ?? input.generatedAt;
  doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(`Fecha de la aplicación: ${formatDateEs(fecha)}`);

  // ── Parcela ──
  section('§ PARCELA TRATADA');
  kv('Parcela', input.parcel.name);
  kv('Cultivo', cropLabel(input.parcel.cropType));
  if (input.parcel.province) kv('Provincia', input.parcel.province);
  if (input.parcel.sigpacRef) kv('Referencia SIGPAC', input.parcel.sigpacRef);
  const areaTratada = input.flightLog?.areaHa ?? input.parcel.areaHa;
  if (areaTratada != null) kv('Superficie tratada', `${areaTratada} ha`);

  // ── Productos aplicados (mezcla) ──
  section('§ PRODUCTOS APLICADOS');
  if (input.products.length > 0) {
    const tTop = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND_600);
    doc.text('Producto', 50, tTop);
    doc.text('Dosis / ha', 340, tTop);
    if (areaTratada != null) doc.text('Total estimado', 445, tTop);
    doc.moveTo(50, tTop + 13).lineTo(545, tTop + 13).strokeColor(RULE).lineWidth(0.5).stroke();
    let ry = tTop + 20;
    input.products.forEach((p) => {
      if (ry > 720) { doc.addPage(); ry = 50; }
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(p.name, 50, ry, { width: 285 });
      doc.font('Helvetica').fontSize(11).fillColor(INK).text(`${p.dose} ${p.unit}`, 340, ry);
      if (areaTratada != null) {
        const totalUnit = p.unit.split('/')[0];
        doc.fillColor(MUTED).text(`${(p.dose * areaTratada).toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${totalUnit}`, 445, ry);
      }
      let dy = 18;
      if (p.note) {
        doc.font('Helvetica-Oblique').fontSize(8).fillColor(MUTED).text(p.note, 50, ry + 14, { width: 285 });
        dy = 28;
      }
      ry += dy;
    });
    doc.y = ry;
    if (areaTratada != null) {
      doc.moveDown(0.4);
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(MUTED)
        .text(`* Total estimado para las ${areaTratada} ha tratadas de esta parcela.`, 50, doc.y, { width: 495 });
    }
  } else {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(MUTED).text('No se registraron productos en esta operación.', 50, doc.y);
  }

  // ── Método y condiciones ──
  section('§ MÉTODO Y CONDICIONES');
  kv('Método', input.applicationMethod || 'Pulverización aérea con dron');
  if (input.weather) {
    kv('Meteorología', `${input.weather.temp} °C · viento ${input.weather.windKmh} km/h · humedad ${input.weather.humidity} %`);
  }
  if (input.flightLog?.startTime) kv('Inicio del vuelo', formatDateTimeEs(input.flightLog.startTime));
  if (input.flightLog?.endTime) kv('Fin del vuelo', formatDateTimeEs(input.flightLog.endTime));

  // ── Operador + marco normativo (encuadre honesto) ──
  section('§ OPERADOR Y MARCO NORMATIVO');
  if (input.operator.company) kv('Operador de drones', input.operator.company);
  if (input.operator.pilotName) kv('Piloto al mando', input.operator.pilotName);
  if (input.prescription?.ref) kv('Prescripción / asesoramiento', input.prescription.ref);
  if (input.prescription?.signedBy) kv('Firmado por', input.prescription.signedBy);
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(
    'Aplicación aérea ejecutada por el operador de drones indicado, en el marco de la normativa AESA de operaciones con aeronaves no tripuladas (UAS). AgroM · FitoLink coordina el tratamiento y aporta la inteligencia satelital de decisión; la ejecución con dron corre a cargo del operador certificado y su piloto.',
    50, doc.y, { width: 495, align: 'left' },
  );

  // ── Footer ──
  doc.moveDown(2);
  if (doc.y < 720) doc.y = 720;
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(RULE).lineWidth(0.5).stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
    `Informe generado el ${formatDateEs(input.generatedAt)} a partir del registro de la operación. Parcela georreferenciada con SIGPAC catastral oficial (MAPA).`,
    50, doc.y, { width: 495 },
  );
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED)
    .text('AGROM · FITOLINK · agrom.es · fitolink.agrom.es', { characterSpacing: 1.5, align: 'center' });

  doc.end();
  return doc as unknown as Readable;
}

// ─────────────────────────────────────────────────────────────────────────
// PDF · Informe de TRABAJO (varias operaciones agregadas · 1 informe)
// ─────────────────────────────────────────────────────────────────────────

export interface JobReportInput {
  generatedAt: Date;
  clientName: string;
  operator: { company?: string; pilotName?: string };
  cropType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  parcels: Array<{ name: string; sigpacRef?: string; areaHa: number; date?: Date }>;
  totalAreaHa: number;
  // Productos agregados del trabajo: dosis/ha (si es la misma en todos los
  // recintos) + total acumulado sobre la superficie tratada.
  products: Array<{ name: string; unit: string; dosePerHa?: number; total: number }>;
  applicationMethod?: string;
}

// Total en unidad legible: g→kg y mL→L cuando el acumulado es grande.
function fmtJobTotal(total: number, unitPerHa: string): string {
  const base = unitPerHa.split('/')[0];
  if (base === 'g' && total >= 1000) return `${(total / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} kg`;
  if (base === 'mL' && total >= 1000) return `${(total / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} L`;
  return `${total.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${base}`;
}

export function generateJobReportPdf(input: JobReportInput): Readable {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Informe de trabajo · ${input.clientName}`,
      Author: 'AgroM · FitoLink',
      Subject: 'Informe de trabajo de aplicación aérea con dron',
      CreationDate: input.generatedAt,
    },
  });

  const section = (label: string) => {
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(label, 50, doc.y, { characterSpacing: 1.5 });
    doc.moveDown(0.4);
  };
  const kv = (k: string, v: string) => {
    const y = doc.y;
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(k, 50, y, { width: 175 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(v, 230, y, { width: 315 });
    doc.moveDown(0.3);
  };

  // Header
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
    .text('AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN', { characterSpacing: 2 });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(80, doc.y).strokeColor(TERRA_500).lineWidth(1.5).stroke();
  doc.moveDown(1);
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('§ INFORME DE TRABAJO · APLICACIÓN AÉREA', { characterSpacing: 1.5 });
  doc.moveDown(0.3);
  const cropTxt = input.cropType ? cropLabel(input.cropType) : 'cultivo';
  doc.font('Helvetica-Bold').fontSize(22).fillColor(INK).text(`Aplicación en ${cropTxt} · ${input.parcels.length} recintos`);
  doc.moveDown(0.3);
  doc.font('Helvetica-Oblique').fontSize(11).fillColor(MUTED).text(`Cliente: ${input.clientName}`);
  doc.moveDown(0.2);
  const fechaTxt = input.dateFrom
    ? (input.dateTo && input.dateTo.getTime() !== input.dateFrom.getTime()
        ? `Del ${formatDateEs(input.dateFrom)} al ${formatDateEs(input.dateTo)}`
        : formatDateEs(input.dateFrom))
    : formatDateEs(input.generatedAt);
  doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(`Fechas de aplicación: ${fechaTxt}`);

  // Resumen
  section('§ RESUMEN DEL TRABAJO');
  kv('Recintos tratados', String(input.parcels.length));
  kv('Superficie total', `${input.totalAreaHa.toLocaleString('es-ES', { maximumFractionDigits: 2 })} ha`);
  if (input.operator.company) kv('Operador de drones', input.operator.company);

  // Recintos
  section('§ RECINTOS TRATADOS');
  const tTop = doc.y;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND_600);
  doc.text('Recinto', 50, tTop);
  doc.text('Ref. SIGPAC', 250, tTop);
  doc.text('Ha', 430, tTop);
  doc.text('Fecha', 480, tTop);
  doc.moveTo(50, tTop + 13).lineTo(545, tTop + 13).strokeColor(RULE).lineWidth(0.5).stroke();
  let ry = tTop + 20;
  input.parcels.forEach((p, i) => {
    if (ry > 740) { doc.addPage(); ry = 50; }
    doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(`${String(i + 1).padStart(2, '0')} · ${p.name}`, 50, ry, { width: 195 });
    doc.fillColor(MUTED).fontSize(8.5).text(p.sigpacRef || '—', 250, ry, { width: 175 });
    doc.fillColor(INK).fontSize(9.5).text(p.areaHa.toLocaleString('es-ES', { maximumFractionDigits: 2 }), 430, ry);
    doc.fillColor(MUTED).fontSize(8.5).text(p.date ? formatShortEs(p.date) : '—', 480, ry, { width: 65 });
    ry += 16;
  });
  doc.y = ry;

  // Productos (agregado del trabajo)
  section('§ PRODUCTOS APLICADOS (TOTAL DEL TRABAJO)');
  if (input.products.length > 0) {
    const pTop = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND_600);
    doc.text('Producto', 50, pTop);
    doc.text('Dosis / ha', 320, pTop);
    doc.text('Total aplicado', 440, pTop);
    doc.moveTo(50, pTop + 13).lineTo(545, pTop + 13).strokeColor(RULE).lineWidth(0.5).stroke();
    let py = pTop + 20;
    input.products.forEach((p) => {
      if (py > 740) { doc.addPage(); py = 50; }
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(p.name, 50, py, { width: 265 });
      doc.font('Helvetica').fontSize(11).fillColor(INK).text(p.dosePerHa != null ? `${p.dosePerHa} ${p.unit}` : `var. (${p.unit})`, 320, py);
      doc.fillColor(BRAND_600).font('Helvetica-Bold').text(fmtJobTotal(p.total, p.unit), 440, py);
      py += 18;
    });
    doc.y = py;
    doc.moveDown(0.4);
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(MUTED)
      .text(`* Total acumulado sobre las ${input.totalAreaHa.toLocaleString('es-ES', { maximumFractionDigits: 2 })} ha tratadas del trabajo.`, 50, doc.y, { width: 495 });
  }

  // Método + operador
  section('§ MÉTODO Y MARCO NORMATIVO');
  kv('Método', input.applicationMethod || 'Pulverización aérea con dron');
  if (input.operator.pilotName) kv('Piloto al mando', input.operator.pilotName);
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(
    'Trabajo de aplicación aérea ejecutado por el operador de drones indicado, en el marco de la normativa AESA de operaciones con aeronaves no tripuladas (UAS). AgroM · FitoLink coordina el trabajo y aporta la inteligencia satelital de decisión; la ejecución con dron corre a cargo del operador certificado.',
    50, doc.y, { width: 495, align: 'left' },
  );

  // Footer
  doc.moveDown(2);
  if (doc.y < 720) doc.y = 720;
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(RULE).lineWidth(0.5).stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
    `Informe generado el ${formatDateEs(input.generatedAt)} a partir del registro de las operaciones. Recintos georreferenciados con SIGPAC catastral oficial (MAPA).`,
    50, doc.y, { width: 495 },
  );
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED)
    .text('AGROM · FITOLINK · agrom.es · fitolink.agrom.es', { characterSpacing: 1.5, align: 'center' });

  doc.end();
  return doc as unknown as Readable;
}

// ─────────────────────────────────────────────────────────────────────────
// CSV · Cartera agregada
// ─────────────────────────────────────────────────────────────────────────

/**
 * Escapa un valor CSV (RFC 4180): si contiene coma, comilla doble o
 * salto de línea, se envuelve en comillas dobles y las comillas
 * internas se duplican.
 */
function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Genera CSV de cartera agregada · 1 fila por socio.
 */
export function generateCarteraCsv(input: ReportInput): string {
  const header = [
    'Posición',
    'Socio',
    'Email',
    'Teléfono',
    'Parcelas',
    'Hectáreas',
    'NDVI medio',
    'Estado NDVI',
    'Avisos activos',
    'Avisos críticos',
    'Peor parcela',
    'NDVI peor parcela',
  ];

  // Mismo orden que el PDF · por urgencia
  const sortedMembers = [...input.members].sort((a, b) => {
    if (a.alertCount !== b.alertCount) return b.alertCount - a.alertCount;
    const aN = a.ndviAvg ?? 1;
    const bN = b.ndviAvg ?? 1;
    return aN - bN;
  });

  const rows = sortedMembers.map((m, idx) => [
    String(idx + 1),
    m.name,
    m.email,
    m.phone ?? '',
    String(m.parcelCount),
    m.areaHa.toFixed(2),
    m.ndviAvg !== null ? m.ndviAvg.toFixed(3) : '',
    ndviLabel(m.ndviAvg),
    String(m.alertCount),
    String(m.criticalAlertCount),
    m.worstParcel?.name ?? '',
    m.worstParcel ? m.worstParcel.ndvi.toFixed(3) : '',
  ]);

  // Cabecera editorial + metadata como comentarios (CSV permite filas
  // que el usuario puede ignorar fácilmente en Excel · Texto a columnas).
  const metaLines = [
    `# AgroM · Cartera ${roleLabel(input.entityRole)}`,
    `# Entidad: ${input.entityName}`,
    `# Generado: ${formatDateEs(input.generatedAt)}`,
    `# Socios: ${input.kpis.memberCount} · Parcelas: ${input.kpis.parcelCount} · Hectáreas: ${input.kpis.areaHa.toFixed(1)} · NDVI medio: ${input.kpis.ndviAvg !== null ? input.kpis.ndviAvg.toFixed(2) : '—'}`,
    `#`,
  ];

  // BOM UTF-8 al inicio para que Excel detecte UTF-8 (caracteres acentuados)
  const bom = '﻿';
  const lines = [
    ...metaLines,
    header.map(csvEscape).join(','),
    ...rows.map((r) => r.map(csvEscape).join(',')),
  ];

  return bom + lines.join('\n');
}
