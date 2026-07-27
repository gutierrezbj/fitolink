/**
 * Parser del BOLETÍN SEMANAL PROVINCIAL del RAIF (Andalucía).
 * Fase 1 del radar de boletines · 26-jul-2026.
 *
 * Qué es: cada una de las 8 provincias andaluzas publica un PDF semanal
 * multicultivo. Dentro, una sección por cultivo (ALGODÓN, OLIVAR, CÍTRICOS…)
 * y dentro de cada una, un epígrafe por plaga con el estado de campo de esa
 * semana, a menudo con cifras reales de la red de estaciones (ECB).
 *
 * Por qué esta fuente primero: es la de mayor volumen y frescura (semanal,
 * 8 provincias, multicultivo), la única con licencia comercial explícita
 * (CC BY 4.0 con atribución) y ya conocíamos el portal.
 *
 * ⚠️ Los nombres de fichero son FÓSILES. `Informe_Fitosanitario_0603_0609-2.pdf`
 * en la carpeta "2023/04" servía el boletín "Del 20 al 24 de julio de 2026":
 * el PDF se sobrescribe en la misma URL cada semana. La fecha se saca SIEMPRE
 * del texto interno (ver requireBulletinDate en pdfText.ts).
 *
 * Este módulo es PURO: recibe texto y devuelve estructura. No toca red ni BD,
 * así que se puede probar contra un .txt guardado.
 */

import { CROP_TYPES, type CropType } from '@fitolink/shared';

/** Nombre del cultivo tal como lo escribe el boletín → CropType del catálogo. */
const CROP_HEADER_MAP: Record<string, CropType> = {
  'ALGODÓN': 'algodon',
  'ALGODON': 'algodon',
  'ALMENDRO': 'almendro',
  'ARROZ': 'arroz',
  'CÍTRICOS': 'citrico',
  'CITRICOS': 'citrico',
  'OLIVAR': 'olivo',
  'VID': 'vinedo',
  'PISTACHO': 'pistacho',
  'TRIGO': 'cereal',
  'CEREALES': 'cereal',
  'CEREALES DE INVIERNO': 'cereal',
  'REMOLACHA': 'remolacha',
  'GIRASOL': 'girasol',
  'MAÍZ': 'maiz',
  'MAIZ': 'maiz',
  'ESPARRAGO VERDE': 'hortaliza',
  'ESPÁRRAGO VERDE': 'hortaliza',
  'HORTÍCOLAS': 'hortaliza',
  'HORTICOLAS': 'hortaliza',
  'PATATA': 'patata',
  'CEREZO': 'frutal',
  'FRUTALES': 'frutal',
};

/** Tokens de cultivo reconocibles en una cabecera, ordenados por longitud
 *  descendente para que "CEREALES DE INVIERNO" gane a "CEREALES". */
const CROP_TOKENS = Object.keys(CROP_HEADER_MAP).sort((a, b) => b.length - a.length);

export interface ParsedPest {
  /** Nombre común tal cual lo titula el boletín ("ARAÑA ROJA"). */
  name: string;
  /** Nombre científico entre paréntesis, tal cual (puede traer erratas del original). */
  scientificName?: string;
  /** Texto del epígrafe, limpio y unificado en un párrafo. */
  body: string;
  /** ¿El propio boletín lo listó en "Agentes destacados"? NO es interpretación nuestra. */
  highlightedBySource: boolean;
}

export interface ParsedCropSection {
  /** Cultivo tal como lo escribe el boletín. */
  cropLabel: string;
  /** Cultivo mapeado al catálogo, o null si no lo reconocemos (se omite). */
  cropType: CropType | null;
  /** Lista literal de "Agentes destacados:" si el boletín la trae. */
  highlightedLiteral?: string;
  pests: ParsedPest[];
}

export interface ParsedRaifBulletin {
  /** Provincia tal como aparece ("SEVILLA"). */
  provinceLabel: string;
  sections: ParsedCropSection[];
}

/** Título de epígrafe de plaga: "ARAÑA ROJA (Tetranychus urticae)". */
const PEST_HEADING = /^([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s,\.\-/]{2,60}?)\s*\(([^)]{3,120})\)\s*$/;

/** Epígrafe donde el boletín lista los agentes de la semana, en sus variantes. */
const HIGHLIGHT_MARKER = /Agentes(?:\s+m[áa]s)?\s+destacados/i;
const HIGHLIGHT_PREFIX = /.*Agentes(?:\s+m[áa]s)?\s+destacados\s*:?\s*/i;

/**
 * Parsea el texto de un boletín semanal provincial del RAIF.
 * Devuelve null si no reconoce la estructura mínima (provincia + al menos
 * una sección de cultivo con plagas) — fail-closed: quien llame no publica.
 */
export function parseRaifWeeklyBulletin(text: string): ParsedRaifBulletin | null {
  const lines = text.split('\n');

  const provinceMatch = text.match(/PROVINCIA\s+DE\s+([A-ZÁÉÍÓÚÑÜ]+)/);
  if (!provinceMatch) return null;
  const provinceLabel = provinceMatch[1].trim();

  // ── 1. Localizar el inicio de cada sección de cultivo ────────────────────
  // La cabecera de página lleva el cultivo y "Boletín Fitosanitario", pero la
  // maquetación varía entre provincias: a veces el cultivo va en la misma
  // línea (ALGODÓN ... Boletín Fitosanitario), a veces en la anterior o
  // siguiente (caso PISTACHO / ARROZ). Se busca en una ventana de ±2 líneas.
  const marks: Array<{ line: number; cropLabel: string; known: boolean }> = [];
  lines.forEach((l, i) => {
    if (!/Boletín\s+Fitosanitario/i.test(l) && !/PROVINCIA\s+DE/.test(l)) return;
    const window = [lines[i - 2], lines[i - 1], l, lines[i + 1], lines[i + 2]]
      .filter((x): x is string => typeof x === 'string')
      .join(' ');
    const token = CROP_TOKENS.find((t) => new RegExp(`(^|\\s)${escapeRe(t)}(\\s|$)`).test(window));
    const last = marks[marks.length - 1];

    if (!token) {
      // Cabecera de un cultivo que NO sabemos mapear (Huelva publica "FRUTOS
      // ROJOS", Cádiz "CEREALES INVIERNO"). Antes se hacía `return` y sus
      // páginas caían dentro del slice del cultivo anterior: sus plagas se
      // habrían publicado bajo el cultivo equivocado, en silencio. Ahora se
      // marca igual —con known:false— para CORTAR la sección previa; la
      // propia no se publica y sale en unmappedCrops() para que el runner
      // avise de que hay material del boletín que estamos tirando.
      if (last && !last.known && i - last.line <= 3) return;
      marks.push({ line: i, cropLabel: headerLabel(lines, i), known: false });
      return;
    }

    // Evita duplicar la marca cuando cultivo y provincia van en líneas contiguas
    if (last && last.cropLabel === token && i - last.line <= 3) return;
    marks.push({ line: i, cropLabel: token, known: true });
  });
  if (marks.length === 0) return null;

  // ── 2. Trocear por sección y extraer plagas ─────────────────────────────
  const sections: ParsedCropSection[] = [];
  marks.forEach((mark, idx) => {
    const from = mark.line;
    const to = idx + 1 < marks.length ? marks[idx + 1].line : lines.length;
    const slice = lines.slice(from, to);

    // "Agentes destacados: Heliotis y Earias" — el propio boletín señala qué
    // agentes importan esta semana. Lo usamos tal cual, sin interpretar.
    // Almería y Granada escriben "Agentes MÁS destacados"; Cádiz alterna las
    // dos formas en el mismo PDF. Huelva y Jaén no ponen el epígrafe.
    const highlightedLine = slice.find((l) => HIGHLIGHT_MARKER.test(l));
    const highlightedLiteral = highlightedLine
      ? highlightedLine.replace(HIGHLIGHT_PREFIX, '').trim() || undefined
      : undefined;

    const pests: ParsedPest[] = [];
    const headings: Array<{ i: number; name: string; sci: string }> = [];
    slice.forEach((l, i) => {
      const m = l.trim().match(PEST_HEADING);
      if (!m) return;
      const name = m[1].trim();
      // Descarta falsos positivos de cabecera/pie que casan el patrón
      if (/BOLET|PROVINCIA|RAIF|ASPECTOS|FITOSANITARIO/i.test(name)) return;
      headings.push({ i, name, sci: m[2].trim() });
    });

    headings.forEach((h, hi) => {
      const bodyFrom = h.i + 1;
      const bodyTo = hi + 1 < headings.length ? headings[hi + 1].i : slice.length;
      const body = cleanBody(slice.slice(bodyFrom, bodyTo));
      if (body.length < 40) return; // epígrafe sin contenido útil
      pests.push({
        name: h.name,
        scientificName: h.sci,
        body,
        highlightedBySource: isHighlighted(h.name, h.sci, highlightedLiteral),
      });
    });

    // Una sección sin cultivo reconocido se conserva SOLO si trae plagas, para
    // que unmappedCrops() la delate. Si viene vacía no aporta nada.
    if (pests.length === 0) return;
    const cropType = mark.known ? CROP_HEADER_MAP[mark.cropLabel] ?? null : null;
    sections.push({ cropLabel: mark.cropLabel, cropType, highlightedLiteral, pests });
  });

  if (sections.length === 0) return null;
  return { provinceLabel, sections };
}

/**
 * ¿El boletín destacó esta plaga? Compara contra la lista literal de
 * "Agentes destacados". Coincidencia laxa a propósito: el boletín escribe
 * "ácaros y cotonet" mientras el epígrafe dice "ÁCAROS (Panonychus…)".
 */
function isHighlighted(name: string, sci: string, highlightedLiteral?: string): boolean {
  if (!highlightedLiteral) return false;

  // La lista es una enumeración: "Pulgón, tigre, anarsia y mancha ocre". Se
  // trocea y se compara ÍTEM A ÍTEM contra el nombre del epígrafe, en los dos
  // sentidos, porque la fuente abrevia tanto como amplía: escribe "tigre" para
  // "TIGRE DEL ALMENDRO", y "ácaros" para "ÁCAROS (Panonychus citri)".
  //
  // Lo que NO se hace es buscar palabras sueltas del epígrafe dentro de la
  // lista: con eso, "almendro" bastaba para marcar AVISPILLA DEL ALMENDRO y
  // ORUGUETA DEL ALMENDRO como destacadas en Granada cuando la fuente solo
  // señalaba el tigre. Y de esta marca depende quién llega a la campanita.
  const items = stripAccents(highlightedLiteral.toLowerCase())
    .split(/,|\sy\s|;/)
    .map((s) => s.replace(/[.:]+$/, '').trim())
    .filter((s) => s.length >= 4);
  if (items.length === 0) return false;

  const nombre = stripAccents(name.trim().toLowerCase());
  if (items.some((it) => nombre.includes(it) || it.includes(nombre))) return true;

  // Y el latín, por si la lista cita el nombre científico o solo el género.
  for (const part of sci.split(/[,;]/)) {
    const s = stripAccents(part.trim().toLowerCase());
    const genero = s.split(/\s+/)[0] ?? '';
    if (items.some((it) => (s.length >= 5 && it.includes(s)) || (genero.length >= 5 && it.includes(genero)))) {
      return true;
    }
  }
  return false;
}

/**
 * Une las líneas del epígrafe en un párrafo legible. Los PDF maquetados
 * intercalan pies de figura ("Hoja con araña roja") en medio del texto: se
 * descartan las líneas muy cortas y muy indentadas, que es su firma.
 */
function cleanBody(lines: string[]): string {
  const kept = lines.filter((l) => {
    const t = l.trim();
    if (t.length === 0) return false;
    if (/^\d{1,3}$/.test(t)) return false;               // número de página
    if (/Boletín\s+Fitosanitario|PROVINCIA\s+DE|^RAIF$/i.test(t)) return false;
    const indent = l.length - l.trimStart().length;
    if (t.length < 45 && indent > 60) return false;      // pie de figura al margen
    return true;
  });
  return kept
    .map((l) => l.trim())
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Etiqueta de una cabecera de cultivo que no sabemos mapear, para poder
 * nombrarla en el log. El nombre va en la misma línea que "Boletín
 * Fitosanitario" (a la izquierda) o en la anterior, según la provincia.
 */
function headerLabel(lines: string[], i: number): string {
  // Málaga titula la sección en dos líneas y con paréntesis:
  //   " TROPICALES"
  //   " (Aguacate)          Boletín Fitosanitario"
  // así que se admite el paréntesis, la caja mixta y el fin de línea, y se
  // juntan las dos partes cuando las hay.
  const extraer = (candidate?: string): string | undefined => {
    if (typeof candidate !== 'string') return undefined;
    const m = candidate.match(/^\s*\(?([A-ZÁÉÍÓÚÑÜ][A-Za-zÁÉÍÓÚÑÜáéíóúñü\s/-]{2,40}?)\)?(?:\s{2,}|\s*$)/);
    const label = m?.[1].trim();
    if (!label || /^(BOLET|PROVINCIA|RAIF|RED DE ALERTA|Fitosanitaria)/i.test(label)) return undefined;
    return label;
  };
  const propia = extraer(lines[i]);
  const previa = extraer(lines[i - 1]);
  if (previa && propia) return `${previa} (${propia})`;
  return propia ?? previa ?? extraer(lines[i + 1]) ?? '(cabecera no identificada)';
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Cultivos del boletín que no sabemos mapear (para loguearlos y no publicarlos). */
export function unmappedCrops(bulletin: ParsedRaifBulletin): string[] {
  return bulletin.sections.filter((s) => s.cropType === null).map((s) => s.cropLabel);
}

/** Sanity check: todos los CropType del mapa existen en el catálogo. */
export function assertCropMapIsValid(): void {
  const bad = Object.entries(CROP_HEADER_MAP).filter(([, v]) => !CROP_TYPES.includes(v));
  if (bad.length > 0) {
    throw new Error(`CROP_HEADER_MAP apunta a cultivos inexistentes: ${bad.map(([k]) => k).join(', ')}`);
  }
}
