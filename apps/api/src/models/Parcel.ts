import mongoose, { Schema, type Document } from 'mongoose';
import { CROP_TYPES, NDVI_SOURCES, type CropType, type NdviSource } from '@fitolink/shared';

export interface INdviReading {
  date: Date;
  mean: number;
  min: number;
  max: number;
  anomalyDetected: boolean;
  source: NdviSource;
  // Optional auxiliary indices computed from the same Sentinel-2 fetch.
  // All means; populated when the corresponding bands are available.
  ndreValue?: number;   // Red Edge — chlorophyll, B05+B08
  ndmiValue?: number;   // Leaf moisture — drops before NDVI under water stress, B08+B11
  eviValue?: number;    // Enhanced VI — soil/atmosphere corrected, B02+B04+B08
  saviValue?: number;   // Soil-adjusted VI — sparse canopy friendly, B04+B08
  cloudFraction?: number;
}

export interface IModisBaselineMonth {
  month: number;
  mean: number;
  std: number;
  n: number;
}

export interface IModisBaseline {
  source: string;
  years: number;
  computed: Date;
  months: IModisBaselineMonth[];
  allTimeMean: number;
  observationCount: number;
}

export interface IClimateBaselineMonth {
  month: number;
  precip: number;
  tmax: number;
  tmin: number;
  pdsi?: number | null;
  pet?: number | null;
}

export interface IClimateBaseline {
  source: string;
  period: string;
  computed: Date;
  months: IClimateBaselineMonth[];
  annualPrecip: number;
  annualPet?: number | null;
  aridityIndex?: number | null;
}

export interface IRecentClimate {
  source: string;
  days: number;
  fetched: Date;
  precipTotalMm: number;
  tempMeanC?: number | null;
  tempMaxC?: number | null;
  tempMinC?: number | null;
  et0TotalMm?: number | null;
  daysWithRain: number;
  lastRainDaysAgo?: number | null;
  // Derived anomaly (vs climateBaseline) — refreshed each pipeline run
  precipPctOfNormal?: number | null;
  precipAnomalyMm?: number | null;
  tempAnomalyC?: number | null;
  droughtFlag?: 'none' | 'mild' | 'moderate' | 'severe' | null;
}

/**
 * Sprint SoilGrids · 22-may-2026.
 * Perfil edáfico estático de la parcela tomado de ISRIC SoilGrids v2.0
 * (250m global). A diferencia de los demás enrichments (modisBaseline,
 * climateBaseline, recentClimate, thermal) que son TEMPORALES, el suelo
 * es PERMANENTE — fetch una vez al crear la parcela y no se recalcula
 * salvo refresh manual del usuario o admin.
 *
 * Datos agregados sobre la capa agronómica (0-30 cm, donde están las
 * raíces principales): %arcilla, %arena, %limo, carbono orgánico,
 * densidad aparente, capacidad agua disponible (campo capacity), y la
 * textura dominante según triángulo USDA.
 */
export interface ISoilProfile {
  /**
   * Procedencia del perfil:
   *  · 'soilgrids-v2'  → estimación del modelo global ISRIC SoilGrids (250 m).
   *  · 'lab-measured'  → análisis de laboratorio real aportado por el cliente
   *                      (medido por lote). Pisa a la estimación satelital.
   */
  source: 'soilgrids-v2' | 'lab-measured';
  fetchedAt: Date;
  /** % arcilla, capa 0-30 cm. */
  clayPct: number;
  /** % arena, capa 0-30 cm. */
  sandPct: number;
  /** % limo, capa 0-30 cm. */
  siltPct: number;
  /** Carbono orgánico g/kg, capa 0-30 cm. */
  organicCarbonGkg: number;
  /** Materia orgánica % (dato crudo del laboratorio; opcional en la estimación). */
  organicMatterPct?: number;
  /** Densidad aparente g/cm³. Opcional: el análisis de laboratorio no siempre la mide. */
  bulkDensityGcm3?: number;
  /**
   * Contenido volumétrico de agua a -33 kPa (capacidad de campo) — cm³/cm³.
   * En 'lab-measured' se DERIVA de la textura (el laboratorio no la mide);
   * en 'soilgrids-v2' viene del modelo.
   */
  fieldCapacityVol: number;
  /** Textura dominante según triángulo USDA — castellano legible. */
  dominantTexture: string;
  /** Fecha del muestreo/análisis de laboratorio (solo 'lab-measured'). */
  measuredOn?: Date;
  /** Etiqueta de la muestra en el informe del cliente (trazabilidad · 'lab-measured'). */
  sampleLabel?: string;
  /** Punto de la parcela donde se muestreó (centroide del polígono). */
  sampledAt: { lat: number; lng: number };
}

// Sprint Thermal — Landsat C2 L2 surface temperature, refreshed each run
export interface IThermal {
  source: string;            // 'landsat-c2-l2'
  fetched: Date;
  days: number;              // lookback window
  lstC: number;              // weighted-mean LST in Celsius
  airTempC?: number | null;  // echoed from recentClimate.tempMeanC for context
  lstDeltaAirC?: number | null;  // canopy − air; > 5 °C = stress
  scenesUsed: number;        // L8/L9 scenes that contributed
  lastDate?: Date | null;    // date of the latest scene used
}

export interface IParcel extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
  areaHa: number;
  cropType: CropType;
  province: string;
  sigpacRef?: string;
  isInsured: boolean;
  insurerId?: mongoose.Types.ObjectId;
  ndviHistory: INdviReading[];
  // MPC-sourced enrichments (Sprint MPC) — optional, never block core flow
  modisBaseline?: IModisBaseline;
  climateBaseline?: IClimateBaseline;
  recentClimate?: IRecentClimate;
  thermal?: IThermal;
  /**
   * Perfil edáfico desde ISRIC SoilGrids 250m v2.0. Permanente (fetch una
   * vez al crear la parcela). El usuario o admin puede refrescarlo
   * manualmente vía POST /parcels/:id/soil/refresh si cambian las
   * referencias o si SoilGrids actualiza su modelo global.
   */
  soil?: ISoilProfile;
  /**
   * Estimación satelital de SoilGrids GUARDADA para comparar cuando `soil` es
   * un análisis de laboratorio ('lab-measured'). Deja ver a la vez el dato real
   * y lo que el modelo global habría estimado — valida cuánto acierta el
   * satélite contra el suelo medido. Vacío mientras `soil` sea la propia estimación.
   */
  soilEstimate?: ISoilProfile;
  isActive: boolean;
  /**
   * Crop establishment phase — true cuando la parcela está recién plantada
   * o aún sin cobertura vegetal completa (residual del cultivo anterior,
   * pistachos jóvenes, etc.). El frontend lo usa para matizar lecturas
   * absolutas que serían falsos positivos en este contexto:
   *   · "Estrés térmico crítico" (LST-aire alto es esperable con suelo desnudo)
   *   · NDVI bajo (esperable, no enfermedad)
   *   · Forecast NDVI proyectando umbral crítico (la línea es otra fase)
   * Establecido automáticamente al crear parcela (combinación de
   * plantingYear + tabla ESTABLISHMENT_YEARS), o manualmente por el
   * agricultor / admin. Un detector V3 futuro lo inferirá automáticamente
   * de la serie NDVI cuando la parcela acumule suficientes lecturas.
   */
  establishmentPhase?: boolean;
  /**
   * Año de plantación informado por el agricultor en el alta de la parcela.
   * Opcional. Si está informado, el sistema arranca calibrado: deduce
   * automáticamente establishmentPhase mediante inferEstablishmentFromAge
   * y NO entra en modo Calibración (calibratingUntil queda null). Si el
   * agricultor no lo sabe, queda undefined y la parcela entra en modo
   * Calibración pasivo durante CALIBRATION_DAYS días.
   */
  plantingYear?: number;
  /**
   * Fecha hasta la cual la parcela está en modo Calibración inicial.
   * Activado al crear la parcela cuando plantingYear no está informado —
   * el sistema necesita observar suficientes lecturas Sentinel-2 antes
   * de aplicar umbrales absolutos. Mientras Date.now() < calibratingUntil:
   *   · Pipeline V2 suprime alerts severity 'high' y 'critical'
   *   · UI muestra HealthScoreGauge en modo "Calibrando"
   *   · Digest matutino emite mensaje suave informativo
   * Si el agricultor edita el plantingYear después del alta, este campo
   * se setea a null automáticamente (sistema ya calibrado).
   */
  calibratingUntil?: Date | null;
  /**
   * Flag pedagógico — parcela sintética usada en demos / clases (caso
   * "Aula Jaén Jesús"). El pipeline V2 IGNORA estas parcelas: no consulta
   * Copernicus ni reescribe ndviHistory, no genera alerts automáticas.
   * Toda la data (lecturas NDVI, MPC enrichments, alertas, operations)
   * viene hand-crafted desde el seed para ilustrar escenarios concretos.
   * Sprint Demo Aula Jaén · 18-may-2026.
   */
  isSyntheticDemo?: boolean;
  /**
   * Sprint aplicación aérea · marca la parcela como objetivo de tratamiento
   * con dron (p.ej. sólo maíz en el caso PAC Aranjuez-Añover). Lo consume el
   * futuro dashboard de planificación de aplicación. applicationCrop guarda
   * el cultivo objetivo por si difiere del cropType nominal.
   */
  applicationTarget?: boolean;
  applicationCrop?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ndviReadingSchema = new Schema<INdviReading>(
  {
    date: { type: Date, required: true },
    mean: { type: Number, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    anomalyDetected: { type: Boolean, default: false },
    source: { type: String, enum: NDVI_SOURCES, required: true },
    ndreValue: { type: Number },
    ndmiValue: { type: Number },
    eviValue: { type: Number },
    saviValue: { type: Number },
    cloudFraction: { type: Number },
  },
  { _id: false },
);

// MPC enrichment subdocs — optional, populated by geo-pipeline workers
const modisBaselineMonthSchema = new Schema<IModisBaselineMonth>(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    mean: { type: Number, required: true },
    std: { type: Number, required: true },
    n: { type: Number, required: true },
  },
  { _id: false },
);

const modisBaselineSchema = new Schema<IModisBaseline>(
  {
    source: { type: String, required: true },
    years: { type: Number, required: true },
    computed: { type: Date, required: true },
    months: [modisBaselineMonthSchema],
    allTimeMean: { type: Number, required: true },
    observationCount: { type: Number, required: true },
  },
  { _id: false },
);

const climateBaselineMonthSchema = new Schema<IClimateBaselineMonth>(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    precip: { type: Number, required: true },
    tmax: { type: Number, required: true },
    tmin: { type: Number, required: true },
    pdsi: { type: Number, default: null },
    pet: { type: Number, default: null },
  },
  { _id: false },
);

const climateBaselineSchema = new Schema<IClimateBaseline>(
  {
    source: { type: String, required: true },
    period: { type: String, required: true },
    computed: { type: Date, required: true },
    months: [climateBaselineMonthSchema],
    annualPrecip: { type: Number, required: true },
    annualPet: { type: Number, default: null },
    aridityIndex: { type: Number, default: null },
  },
  { _id: false },
);

const recentClimateSchema = new Schema<IRecentClimate>(
  {
    source: { type: String, required: true },
    days: { type: Number, required: true },
    fetched: { type: Date, required: true },
    precipTotalMm: { type: Number, required: true },
    tempMeanC: { type: Number, default: null },
    tempMaxC: { type: Number, default: null },
    tempMinC: { type: Number, default: null },
    et0TotalMm: { type: Number, default: null },
    daysWithRain: { type: Number, required: true },
    lastRainDaysAgo: { type: Number, default: null },
    precipPctOfNormal: { type: Number, default: null },
    precipAnomalyMm: { type: Number, default: null },
    tempAnomalyC: { type: Number, default: null },
    droughtFlag: { type: String, enum: ['none', 'mild', 'moderate', 'severe', null], default: null },
  },
  { _id: false },
);

const thermalSchema = new Schema<IThermal>(
  {
    source: { type: String, required: true },
    fetched: { type: Date, required: true },
    days: { type: Number, required: true },
    lstC: { type: Number, required: true },
    airTempC: { type: Number, default: null },
    lstDeltaAirC: { type: Number, default: null },
    scenesUsed: { type: Number, required: true },
    lastDate: { type: Date, default: null },
  },
  { _id: false },
);

// Sprint SoilGrids — perfil edáfico estático ISRIC SoilGrids v2.0
const soilProfileSchema = new Schema<ISoilProfile>(
  {
    source: { type: String, enum: ['soilgrids-v2', 'lab-measured'], required: true },
    fetchedAt: { type: Date, required: true },
    clayPct: { type: Number, required: true, min: 0, max: 100 },
    sandPct: { type: Number, required: true, min: 0, max: 100 },
    siltPct: { type: Number, required: true, min: 0, max: 100 },
    organicCarbonGkg: { type: Number, required: true, min: 0 },
    organicMatterPct: { type: Number, min: 0 },
    // Opcional: el análisis de laboratorio no siempre mide densidad aparente.
    bulkDensityGcm3: { type: Number, min: 0 },
    fieldCapacityVol: { type: Number, required: true, min: 0, max: 1 },
    dominantTexture: { type: String, required: true },
    measuredOn: { type: Date },
    sampleLabel: { type: String },
    sampledAt: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
  },
  { _id: false },
);

const parcelSchema = new Schema<IParcel>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    geometry: {
      type: { type: String, enum: ['Polygon'], required: true },
      coordinates: { type: [[[Number]]], required: true },
    },
    areaHa: { type: Number, required: true, min: 0.1 },
    cropType: { type: String, enum: CROP_TYPES, required: true },
    province: { type: String, required: true },
    sigpacRef: String,
    isInsured: { type: Boolean, default: false },
    insurerId: { type: Schema.Types.ObjectId, ref: 'User' },
    ndviHistory: [ndviReadingSchema],
    // Sprint MPC: long-term context from Microsoft Planetary Computer
    modisBaseline: { type: modisBaselineSchema, default: undefined },
    climateBaseline: { type: climateBaselineSchema, default: undefined },
    recentClimate: { type: recentClimateSchema, default: undefined },
    thermal: { type: thermalSchema, default: undefined },
    soil: { type: soilProfileSchema, default: undefined },
    soilEstimate: { type: soilProfileSchema, default: undefined },
    isActive: { type: Boolean, default: true },
    establishmentPhase: { type: Boolean, default: false },
    plantingYear: { type: Number, min: 1900, max: 2100 },
    calibratingUntil: { type: Date, default: null },
    isSyntheticDemo: { type: Boolean, default: false },
    applicationTarget: { type: Boolean, default: false },
    applicationCrop: { type: String },
  },
  {
    timestamps: true,
  },
);

parcelSchema.index({ geometry: '2dsphere' });
parcelSchema.index({ ownerId: 1, isActive: 1 });
parcelSchema.index({ isInsured: 1, insurerId: 1 });

export const Parcel = mongoose.model<IParcel>('Parcel', parcelSchema);
