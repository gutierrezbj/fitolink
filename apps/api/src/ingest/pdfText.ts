/**
 * Capa común de extracción de texto de PDF para la ingesta de boletines
 * fitosanitarios (Fase 0 del radar de boletines · 26-jul-2026).
 *
 * Por qué existe: casi todos los servicios autonómicos publican en PDF
 * (RAIF Andalucía, DARP Cataluña, Aragón, Extremadura…). Antes de esto solo
 * sabíamos leer HTML (el informe Prays del RAIF), así que el 90% del material
 * oficial de España era inalcanzable.
 *
 * Usa `pdftotext -layout` (poppler). Se eligió tras probarlo contra el PDF
 * real del RAIF de Sevilla: preserva la maquetación a dos columnas, así que
 * los epígrafes de plaga y las cabeceras de cultivo/provincia salen en su
 * propia línea y son parseables. Las librerías JS puras devuelven el texto
 * con el orden de lectura roto en multicolumna.
 *
 * CONTRATO FAIL-CLOSED (igual que parsePraysHtml): este módulo solo extrae.
 * Quien lo use DEBE exigir la fecha interna del documento y abortar si no
 * está — ver `requireBulletinDate`. Los nombres de fichero de estos boletines
 * son fósiles: el PDF `Informe_Fitosanitario_0603_0609-2.pdf` (carpeta
 * "2023/04") servía el boletín "Del 20 al 24 de julio de 2026". Fiarse del
 * nombre o de la URL es publicar un boletín viejo como si fuera de hoy.
 */

import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

const FETCH_TIMEOUT_MS = 30_000;
const PDFTOTEXT_TIMEOUT_MS = 30_000;
/** Un boletín provincial ronda 1-2 MB. Tope generoso para no tragarnos un cebo. */
const MAX_PDF_BYTES = 25 * 1024 * 1024;

export class PdfIngestError extends Error {
  constructor(message: string, public detail?: string) {
    super(message);
    this.name = 'PdfIngestError';
  }
}

export interface PdfDocument {
  /** Texto extraído con la maquetación preservada. */
  text: string;
  /** SHA-256 del binario: detecta que el organismo sobrescribió el PDF. */
  sha256: string;
  bytes: number;
  sourceUrl: string;
}

/**
 * Descarga un PDF y extrae su texto con `pdftotext -layout`.
 * Lanza PdfIngestError en cualquier fallo (red, tipo, tamaño, poppler).
 */
export async function fetchPdfText(url: string): Promise<PdfDocument> {
  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'FitoLink/1.0 (+https://fitolink.agrom.es)' },
    });
  } catch (err) {
    throw new PdfIngestError(`No se pudo descargar el PDF: ${(err as Error).message}`, url);
  }
  if (!res.ok) {
    throw new PdfIngestError(`Descarga de PDF falló: HTTP ${res.status}`, url);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new PdfIngestError('El PDF vino vacío', url);
  if (buf.length > MAX_PDF_BYTES) {
    throw new PdfIngestError(`PDF demasiado grande (${buf.length} bytes)`, url);
  }
  // Firma real, no el Content-Type (varios portales sirven PDF como octet-stream)
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new PdfIngestError('El fichero descargado no es un PDF', url);
  }

  const sha256 = createHash('sha256').update(buf).digest('hex');
  const dir = await mkdtemp(join(tmpdir(), 'fitolink-pdf-'));
  const pdfPath = join(dir, 'doc.pdf');
  try {
    await writeFile(pdfPath, buf);
    const run = (mode: string) =>
      execFileAsync('pdftotext', [mode, '-enc', 'UTF-8', '-q', pdfPath, '-'], {
        timeout: PDFTOTEXT_TIMEOUT_MS,
        maxBuffer: 32 * 1024 * 1024,
      });
    // Dos extracciones del MISMO fichero:
    //  · -layout preserva columnas → es la que parseamos (cabeceras, epígrafes)
    //  · -raw sigue el orden interno del PDF y sale con las palabras enteras,
    //    así que la usamos solo como vocabulario para reparar el layout
    // -enc UTF-8 para tildes · -q sin ruido
    const [layout, raw] = await Promise.all([run('-layout'), run('-raw')]);
    const text = repairSplitWords(normalizePdfText(layout.stdout), raw.stdout);
    if (text.trim().length < 200) {
      throw new PdfIngestError('El PDF no tiene texto extraíble (¿escaneado?)', url);
    }
    logger.info({ url, bytes: buf.length, chars: text.length, sha256: sha256.slice(0, 12) }, 'pdf_text_extracted');
    return { text, sha256, bytes: buf.length, sourceUrl: url };
  } catch (err) {
    if (err instanceof PdfIngestError) throw err;
    const msg = (err as Error).message;
    if (/ENOENT/.test(msg)) {
      throw new PdfIngestError('pdftotext no está instalado (falta poppler-utils en la imagen)', msg);
    }
    throw new PdfIngestError(`pdftotext falló: ${msg}`, url);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Normaliza el texto que sale de un PDF maquetado:
 *  · unifica saltos de línea y quita el salto de página (\f)
 *  · arregla el espaciado roto por tracking tipográfico ("A R A Ñ A" → "ARAÑA"),
 *    que aparece en títulos de varios boletines
 *  · recorta espacios al final de línea, preservando la indentación (que es
 *    la que nos permite distinguir cabeceras de cuerpo)
 */
export function normalizePdfText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\f/g, '\n')
    // Letras sueltas separadas por espacios (mínimo 4 seguidas) → se juntan.
    // Conservador a propósito: con 3 o menos hay riesgo de destrozar siglas.
    .replace(/\b(?:[A-ZÁÉÍÓÚÑÜ] ){3,}[A-ZÁÉÍÓÚÑÜ]\b/g, (m) => m.replace(/ /g, ''))
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n');
}

const LETTER = 'A-Za-zÁÉÍÓÚÑÜáéíóúñü';
/** Palabras contiguas separadas por UN solo espacio (dos o más = columnas). */
const WORD_RUN = new RegExp(`[${LETTER}]+(?: [${LETTER}]+)+`, 'g');
/** Máximo de trozos que se intenta unir en una sola palabra. */
const MAX_PIECES = 5;

/**
 * Repara las palabras que `pdftotext -layout` parte por el tracking tipográfico
 * del original: "actividad de a r aña r oja", "muy b a ja", "Los d a ños".
 *
 * No usa diccionario ni heurística de idioma. Solo une un grupo de trozos si la
 * extracción `-raw` del MISMO PDF contiene esa palabra entera — es el propio
 * documento el que autoriza cada unión, así que no podemos inventar términos.
 * Y se abstiene si todos los trozos ya aparecen como palabras sueltas en el
 * documento, que es lo que impide convertir "a la" en "ala".
 *
 * Recorre cada tramo de izquierda a derecha probando de la unión más larga a la
 * más corta. Un `replace` con expresión voraz no sirve: en "de a r aña r oja"
 * se lleva "de a r aña r" (que no existe) y deja "oja" fuera de tiro.
 */
export function repairSplitWords(layoutText: string, rawText: string): string {
  const whole = new Set<string>();
  const anyToken = new Set<string>();
  for (const w of rawText.toLowerCase().match(new RegExp(`[${LETTER}]+`, 'g')) ?? []) {
    anyToken.add(w);
    if (w.length >= 4) whole.add(w);
  }
  if (whole.size === 0) return layoutText;

  const canJoin = (pieces: string[]): string | null => {
    if (!pieces.some((p) => p.length <= 2)) return null;
    const joined = pieces.join('');
    if (joined.length < 4 || joined.length > 24) return null;
    if (!whole.has(joined.toLowerCase())) return null;
    if (pieces.every((p) => anyToken.has(p.toLowerCase()))) return null;
    return joined;
  };

  return layoutText
    .split('\n')
    .map((line) =>
      line.replace(WORD_RUN, (run) => {
        const tokens = run.split(' ');
        const out: string[] = [];
        let i = 0;
        while (i < tokens.length) {
          let taken = 1;
          for (let n = Math.min(MAX_PIECES, tokens.length - i); n >= 2; n--) {
            const joined = canJoin(tokens.slice(i, i + n));
            if (joined) {
              out.push(joined);
              taken = n;
              break;
            }
          }
          if (taken === 1) out.push(tokens[i]);
          i += taken;
        }
        const fixed = out.join(' ');
        // Se rellena con espacios para no descolocar la indentación, que es
        // la que distingue cuerpo de pie de figura en cleanBody()
        return fixed.length < run.length ? fixed + ' '.repeat(run.length - fixed.length) : fixed;
      }),
    )
    .join('\n');
}

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

export interface BulletinDate {
  /** Fin del periodo que declara el boletín (lo usamos como fecha del dato). */
  periodEnd: Date;
  /** Inicio del periodo, si el boletín da rango. */
  periodStart?: Date;
  /** El texto literal encontrado, para citarlo tal cual. */
  literal: string;
}

/**
 * Extrae la fecha INTERNA del boletín. OBLIGATORIA: si no aparece, el
 * llamante debe abortar sin tocar la BD (los nombres de fichero son fósiles).
 *
 * Formatos soportados, vistos en boletines reales:
 *  · "Del 20 al 24 de julio de 2026"   (RAIF semanal provincial)
 *  · "JULIOL DE 2026" / "julio de 2026" (cuadernos mensuales)
 *  · "FECHA: 21/7/2026" / "21/07/2026"  (Extremadura, cabeceras varias)
 */
export function parseBulletinDate(text: string): BulletinDate | null {
  // 1) Rango "Del D al D de <mes> de <año>".
  //    El separador antes del año varía entre provincias del RAIF: Sevilla y
  //    Cádiz escriben "de julio de 2026", Granada "de julio / 2026". Se acepta
  //    cualquiera de los dos o el año pegado.
  const range = text.match(
    /Del\s+(\d{1,2})\s+al\s+(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s*(?:de|\/)?\s*(\d{4})/i,
  );
  if (range) {
    const [, d1, d2, monthRaw, year] = range;
    const month = MONTHS[monthRaw.toLowerCase()];
    if (month) {
      const start = makeUtcDate(Number(year), month, Number(d1));
      const end = makeUtcDate(Number(year), month, Number(d2));
      if (start && end) return { periodStart: start, periodEnd: end, literal: range[0].trim() };
    }
  }

  // 1-bis) Rango que cruza de mes: "Del 29 de junio al 3 de julio de 2026".
  //    Va ANTES de los fallbacks porque si no casa aquí, el patrón 3 devuelve
  //    el MES ENTERO y con él una fecha de fin en el futuro, que desarma el
  //    guard de frescura. La semana del RAIF es de lunes a viernes, así que
  //    esto pasa unas 7 veces al año.
  const cross = text.match(
    /Del\s+(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+al\s+(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s*(?:de|\/)?\s*(\d{4})/i,
  );
  if (cross) {
    const [, d1, mes1Raw, d2, mes2Raw, year] = cross;
    const m1 = MONTHS[mes1Raw.toLowerCase()];
    const m2 = MONTHS[mes2Raw.toLowerCase()];
    if (m1 && m2) {
      // "Del 28 de diciembre al 1 de enero de 2027": el año que trae el texto
      // es el del final, el inicio cae en el anterior.
      const yEnd = Number(year);
      const start = makeUtcDate(m1 > m2 ? yEnd - 1 : yEnd, m1, Number(d1));
      const end = makeUtcDate(yEnd, m2, Number(d2));
      if (start && end) return { periodStart: start, periodEnd: end, literal: cross[0].trim() };
    }
  }

  // 2) Fecha suelta dd/mm/yyyy
  const dmy = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (dmy) {
    const d = makeUtcDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
    if (d) return { periodEnd: d, literal: dmy[0] };
  }

  // 3) Mes + año ("JULIO DE 2026", "juliol de 2026"). El periodo es el mes
  //    entero: periodStart = día 1, periodEnd = último día.
  const monthYear = text.match(/\b([a-záéíóúñ]+)\s+(?:de\s+)?(\d{4})\b/i);
  if (monthYear) {
    const month = MONTHS[monthYear[1].toLowerCase()] ?? CATALAN_MONTHS[monthYear[1].toLowerCase()];
    if (month) {
      const year = Number(monthYear[2]);
      const start = makeUtcDate(year, month, 1);
      const end = new Date(Date.UTC(year, month, 0)); // día 0 del mes siguiente = último de este
      if (start) return { periodStart: start, periodEnd: end, literal: monthYear[0].trim() };
    }
  }

  return null;
}

/** Meses en catalán — los cuadernos del DARP van en catalán. */
const CATALAN_MONTHS: Record<string, number> = {
  gener: 1, febrer: 2, març: 3, marc: 3, abril: 4, maig: 5, juny: 6,
  juliol: 7, agost: 8, setembre: 9, octubre: 10, novembre: 11, desembre: 12,
};

function makeUtcDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  // Round-trip: descarta 31/02 y similares en vez de dejar que rueden al mes siguiente
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

/**
 * Exige una fecha interna y que sea RECIENTE. Es la guarda que impide
 * republicar un boletín viejo servido en una URL que dice "actual" — pasa de
 * verdad: el informe mensual autonómico del RAIF servía el de enero 2025 en
 * julio 2026.
 *
 * @param maxAgeDays antigüedad máxima aceptable del fin de periodo.
 */
export function requireBulletinDate(text: string, maxAgeDays: number, sourceUrl: string): BulletinDate {
  const found = parseBulletinDate(text);
  if (!found) {
    throw new PdfIngestError(
      'No se encontró la fecha interna del boletín — no se publica nada',
      sourceUrl,
    );
  }
  // Cota por arriba. Los patrones 2 y 3 escanean el documento entero, así que
  // pueden capturar una fecha cualquiera del cuerpo (la cita de un Real
  // Decreto, un mes suelto) en vez del periodo de la cabecera. Cuando eso pasa
  // la fecha suele quedar en el futuro y `ageDays` sale negativa, con lo que el
  // guard de antigüedad deja pasar cualquier cosa. Aquí se corta esa clase
  // entera de fallo: si el fin de periodo está por delante de hoy, es que no
  // hemos leído el periodo real y no se publica nada.
  const FUTURE_TOLERANCE_MS = 2 * 86_400_000; // margen de husos y de cierre de semana
  if (found.periodEnd.getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
    throw new PdfIngestError(
      `La fecha leída del boletín está en el futuro ("${found.literal}") — el parser no ha localizado el periodo real, no se publica`,
      sourceUrl,
    );
  }

  const ageDays = (Date.now() - found.periodEnd.getTime()) / 86_400_000;
  if (ageDays > maxAgeDays) {
    throw new PdfIngestError(
      `El boletín servido es viejo (${Math.round(ageDays)} días, "${found.literal}") — probablemente la URL sirve contenido obsoleto`,
      sourceUrl,
    );
  }
  return found;
}
