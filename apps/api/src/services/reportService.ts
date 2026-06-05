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
