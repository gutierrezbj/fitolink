import mongoose, { Schema, type Document } from 'mongoose';
import { CROP_TYPES, PROVINCES, type CropType } from '@fitolink/shared';

/**
 * Pest advisory — Camino B of the "plagas curadas" pattern from
 * OverWatch v2 §5.x.
 *
 * FitoLink reúne lo que publican los servicios fitosanitarios autonómicos
 * (RAIF Andalucía, DARP Cataluña, SAIF/IVIA, SIAM Murcia, ITACYL…) y lo pone
 * en un mapa común, cruzado con el cultivo y la comarca de cada parcela.
 * El dato es de cada organismo; FitoLink abre el canal y cita la fuente.
 *
 * Origen: al principio los avisos se teclearon a mano (curación). Desde
 * 12-jul-2026 hay ingesta automática del informe Prays del RAIF, y desde
 * 26-jul-2026 el modelo distingue QUÉ tipo de publicación es cada aviso
 * (ver PEST_ADVISORY_KINDS) porque las fuentes no publican todas lo mismo.
 */

export const PEST_SEVERITIES = ['low', 'medium', 'high'] as const;
export type PestSeverity = (typeof PEST_SEVERITIES)[number];

/**
 * QUÉ clase de publicación es el aviso. Crítico para no pintar igual cosas
 * que el organismo dice de forma muy distinta (26-jul-2026):
 *
 *  · 'deteccion'  → la fuente reporta una MEDICIÓN de campo con fecha:
 *                   "45,1% de aceitunas con Prays vivo", "16,1 adultos/
 *                   trampa/día", "% de hojas ocupadas al alza". Es lo más
 *                   fuerte que podemos mostrar.
 *  · 'campana'    → la fuente declara una VENTANA DE RIESGO recurrente de
 *                   la campaña: "en julio vigilad araña roja en maíz de
 *                   regadío". No dice que la haya HOY en tu parcela; dice
 *                   que es la época. Publicarlo como detección sería
 *                   mentir (CRITICAL_no_inventar).
 *  · 'referencia' → ficha técnica permanente sin fecha de publicación
 *                   (biología, umbrales de muestreo). Útil como consulta,
 *                   NUNCA como aviso vigente.
 */
export const PEST_ADVISORY_KINDS = ['deteccion', 'campana', 'referencia'] as const;
export type PestAdvisoryKind = (typeof PEST_ADVISORY_KINDS)[number];

export const PEST_SOURCES = ['RAIF', 'DARP', 'MAPA', 'SAIF', 'SIAM', 'CSCV', 'ITACYL', 'otros'] as const;
export type PestSource = (typeof PEST_SOURCES)[number];
// RAIF · Red Alerta e Información Fitosanitaria de Andalucía
// DARP · Departament d'Agricultura, Ramaderia, Pesca i Alimentació · Generalitat de Catalunya (portal Ruralcat)
// MAPA · Ministerio de Agricultura, Pesca y Alimentación
// SAIF · Servicio Información Fitosanitaria Comunitat Valenciana (IVIA)
// SIAM · Sistema Información Agraria de Murcia (IMIDA)
// CSCV · Servicio Sanidad Vegetal Castilla-León

export interface IAffectedArea {
  /** Province from the canonical list (see PROVINCES) */
  province: typeof PROVINCES[number];
  /** Optional comarca name as it appears in the bulletin */
  comarca?: string;
  /** Reference point [lng, lat] used for radius matching */
  centroid: { type: 'Point'; coordinates: [number, number] };
  /** Match radius around the centroid, in kilometers */
  radiusKm: number;
  /**
   * ¿De dónde sale el radio? NINGUNA fuente oficial publica geometría: lo
   * mejor que dan es un topónimo en texto libre ("els regadius de Lleida",
   * "valor medio provincial"). El centroide y el radio los resolvemos
   * nosotros, así que hay que poder decirlo en la UI en vez de aparentar
   * que el organismo dibujó un círculo (26-jul-2026).
   *
   *  · 'fuente' → la fuente delimita la zona de forma explícita y precisa.
   *  · 'agrom'  → lo hemos derivado nosotros del topónimo (caso normal).
   */
  radiusSource: 'fuente' | 'agrom';
}

export interface IPestAdvisory extends Document {
  /** Plant pest / disease canonical name (Spanish) */
  pestName: string;
  /** Optional scientific name */
  scientificName?: string;
  /** Crop types this advisory applies to */
  cropTypes: CropType[];
  /** One or more zones the advisory covers */
  affectedAreas: IAffectedArea[];
  severity: PestSeverity;
  /**
   * Qué clase de publicación es (medición con fecha / ventana de campaña /
   * ficha permanente). Ver PEST_ADVISORY_KINDS. Default 'deteccion' por
   * compatibilidad con los avisos que ya existían.
   */
  advisoryKind: PestAdvisoryKind;
  /**
   * La zona TAL COMO LA ESCRIBE la fuente, sin interpretar. Ejemplos reales:
   * "els regadius de Lleida", "valor medio provincial", "Campo de Cartagena".
   * Es lo único que el organismo afirma de verdad sobre el territorio — el
   * centroide y el radio son nuestros (ver IAffectedArea.radiusSource).
   */
  sourceScopeLiteral?: string;
  /** Date when the activity started being reported */
  detectedAt: Date;
  /**
   * Fecha tras la cual el aviso deja de mostrarse.
   *
   * Lo fija SIEMPRE el ingester/seed según lo que declare la fuente:
   *  · 'deteccion' → hasta la siguiente publicación del boletín (semanal,
   *                  quincenal…). Un parte de campo caduca rápido.
   *  · 'campana'   → fin de la ventana que declara el boletín (p.ej. el mes
   *                  o el periodo julio-agosto). NO inventar más allá.
   * El default de 21 días es solo una red de seguridad para que nada quede
   * vivo indefinidamente si alguien olvida ponerlo.
   */
  expiresAt: Date;
  /** Origin of the curated information */
  source: PestSource;
  /** Bulletin reference (e.g. "RAIF Andalucia 19/2026") */
  sourceRef?: string;
  /** Recommended action — short, Tipo A friendly */
  recommendation?: string;
  /** Free-form notes (for the agronomist / operator) */
  notes?: string;
  /** Optional URL to the original bulletin */
  sourceUrl?: string;
  /** Who created the advisory (User._id) */
  createdBy: mongoose.Types.ObjectId;
  /** Whether the advisory is currently distributable */
  isActive: boolean;
  /** Idempotency fingerprint to prevent accidental duplicates */
  fingerprint: string;
  createdAt: Date;
  updatedAt: Date;
}

const affectedAreaSchema = new Schema<IAffectedArea>(
  {
    province: { type: String, enum: PROVINCES, required: true },
    comarca: { type: String, trim: true, maxlength: 80 },
    centroid: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: { type: [Number], required: true },
    },
    radiusKm: { type: Number, required: true, min: 1, max: 200, default: 30 },
    // Default 'agrom': es el caso real en todas las fuentes auditadas — ninguna
    // publica geometría, así que el radio lo ponemos nosotros salvo prueba
    // en contra. Ser honesto por defecto.
    radiusSource: { type: String, enum: ['fuente', 'agrom'], default: 'agrom' },
  },
  { _id: false },
);

const pestAdvisorySchema = new Schema<IPestAdvisory>(
  {
    pestName: { type: String, required: true, trim: true, maxlength: 120, index: true },
    scientificName: { type: String, trim: true, maxlength: 120 },
    cropTypes: [{ type: String, enum: CROP_TYPES, required: true }],
    affectedAreas: { type: [affectedAreaSchema], required: true, validate: (v: unknown[]) => v.length > 0 },
    severity: { type: String, enum: PEST_SEVERITIES, default: 'medium' },
    // 'deteccion' por defecto: los avisos que ya existían son mediciones de
    // boletín (Prays con cifras, cotonet, minador…). Las ventanas de campaña
    // las marca explícitamente su ingester.
    advisoryKind: { type: String, enum: PEST_ADVISORY_KINDS, default: 'deteccion', index: true },
    sourceScopeLiteral: { type: String, trim: true, maxlength: 200 },
    detectedAt: { type: Date, required: true, default: Date.now },
    expiresAt: {
      type: Date,
      required: true,
      // Default expiry: 21 days from detectedAt — fits a typical bulletin
      // cycle plus a buffer so a single advisory survives the next week's
      // pipeline run without being treated as "stale".
      default: function () {
        return new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
      },
    },
    source: { type: String, enum: PEST_SOURCES, required: true },
    sourceRef: { type: String, trim: true, maxlength: 200 },
    recommendation: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 1000 },
    sourceUrl: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true, index: true },
    fingerprint: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true },
);

// Composite index: pull active advisories that overlap today, ordered by severity
pestAdvisorySchema.index({ isActive: 1, expiresAt: 1, severity: -1 });
// Geo index on each affected area centroid (one entry per area subdoc)
pestAdvisorySchema.index({ 'affectedAreas.centroid': '2dsphere' });

export const PestAdvisory = mongoose.model<IPestAdvisory>('PestAdvisory', pestAdvisorySchema);
