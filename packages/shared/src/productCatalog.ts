/**
 * Catálogo de productos de aplicación · 08-jul-2026.
 *
 * Fuente de verdad para DOSIS DE ETIQUETA: lo que dice el fabricante en el
 * envase, transcrito literal (regla nº1: no inventar — si un dato no está en
 * la etiqueta, el campo no existe). Lo consumen:
 *   · DoseCalculatorCard (planificar mezcla: producto + ha → totales)
 *   · CompleteOperationForm (aviso si la dosis registrada sale de etiqueta)
 *   · reportService/operationController (nota "Etiqueta (dron): …" en el PDF)
 *
 * Para añadir un producto: foto de la etiqueta → nueva entrada aquí con
 * `source` indicando procedencia y fecha. NUNCA rellenar huecos "de memoria".
 */
import type { ApplicationUnit } from './constants.js';

export interface LabelDoseRange {
  min: number;
  max: number;
  unit: ApplicationUnit;
}

export interface ProductSpec {
  id: string;
  /** Nombre comercial como debe salir en informes. */
  name: string;
  /** Tipo de tratamiento según la etiqueta. */
  kind: string;
  /** Cadenas (minúsculas, sin acentos) que identifican el producto al teclearlo. */
  aliases: string[];
  methods: {
    dron?: {
      dose: LabelDoseRange;
      /** Volumen de caldo (agua) por hectárea según etiqueta. */
      waterLPerHa: { min: number; max: number };
    };
    pulverizador?: {
      dose: LabelDoseRange;
      /** "Aplicar de 1 a 5 veces en función del ciclo de cultivo". */
      applicationsPerCycle?: { min: number; max: number };
    };
    /** Tratamiento foliar dosificado por CONCENTRACIÓN (% del caldo), no por ha. */
    foliar?: {
      concentrationPct: { min: number; max: number };
    };
    /** Fertirrigación: volumen de PRODUCTO por hectárea. */
    riego?: {
      dose: LabelDoseRange;
    };
  };
  /** Pautas de aplicación de la etiqueta (nº de pasadas, momentos, cultivos). */
  applicationNotes?: string[];
  composition?: Array<{ component: string; value: string }>;
  density?: string;
  ph?: string;
  /** Formatos de envase (contenido neto). */
  formats?: string[];
  certifications?: string[];
  manufacturer?: string;
  distributor?: string;
  /** Resumen de precauciones de la etiqueta (las operativas para el aplicador). */
  precautions?: string[];
  /** Procedencia del dato. */
  source: string;
}

export const PRODUCT_CATALOG: ProductSpec[] = [
  {
    id: 'love-green-lg-miner',
    name: 'Love Green · LG-MINER (nanopartícula)',
    kind: 'Tratamiento foliar · fertilizante bioestimulante mineral (100% orgánico)',
    aliases: ['love green', 'lg-miner', 'lg miner', 'lovegreen'],
    methods: {
      dron: {
        dose: { min: 200, max: 1500, unit: 'g/ha' },
        waterLPerHa: { min: 20, max: 150 },
      },
      pulverizador: {
        dose: { min: 2, max: 3.5, unit: 'kg/ha' },
        applicationsPerCycle: { min: 1, max: 5 },
      },
    },
    composition: [
      { component: 'Carbonato cálcico (CaCO3)', value: '86% – 96%' },
      { component: 'Carbonato de magnesio (MgCO3)', value: '1,25% – 4,50%' },
      { component: 'Óxido de silicio (SiO2)', value: '0,10% – 1,70%' },
      { component: 'Óxido de hierro (Fe2O3)', value: '0,10% – 0,70%' },
      { component: 'Manganeso (Mn)', value: '20 – 70 mg/kg' },
      { component: 'Zinc (Zn)', value: '10 – 60 mg/kg' },
      { component: 'Cobre (Cu)', value: '6 – 30 mg/kg' },
      { component: 'Molibdeno (Mo)', value: '< 0,1 mg/kg' },
    ],
    density: '2,5 – 2,8 g/cm³',
    ph: '6 – 8',
    formats: ['5 kg', '10 kg', '20 kg'],
    certifications: ['ECOCERT', 'Reglamento (CE) 834/2007', 'Reglamento 2019/515'],
    manufacturer: 'Konzept Green (fabricante y certificador)',
    distributor: 'OEA Quality Certificaciones y Servicios SL · Madrid',
    precautions: [
      'Añadir de inicio en el agua de la cuba, regulando el pH y evitando espuma',
      'Comprobar difusores: la aplicación debe ser muy pulverizada',
      'Si se combina con otro producto, ejecutar una prueba antes de la aplicación general',
      'Aplicar a primeras horas de la mañana o tarde',
      'Limpiar depósitos y aplicadores después de aplicar (recomendable sulfato amónico)',
      'Agitar antes de usar · no almacenar a más de 39 °C',
      'Consulte a su técnico',
    ],
    source: 'Etiqueta del fabricante (foto del envase, 08-jul-2026)',
  },
  {
    id: 'microbiota-108-biol',
    name: 'Microbiota 108 · BIOL (LG-Microb)',
    kind: 'Biol · bioestimulante vegetal y potenciador de la microbiota del suelo (fermentado de extractos de algas, húmicos y aminoácidos)',
    // OJO: aliases SIN el genérico 'microbiota' a propósito — el primer trabajo
    // se registró como "Microbiota Proenzime" y hasta que JuanCho confirme que
    // es ESTE producto no lo matcheamos (no inventar equivalencias).
    aliases: ['microbiota 108', 'lg-microb', 'lg microb', 'biol 108'],
    methods: {
      // La etiqueta NO trae dosis específica de dron: solo foliar (1–3 % del
      // caldo) y riego. En dron la dosis la fija el técnico.
      foliar: {
        concentrationPct: { min: 1, max: 3 },
      },
      riego: {
        dose: { min: 100, max: 300, unit: 'L/ha' },
      },
    },
    applicationNotes: [
      'Realizar 3 aplicaciones en pre y post floración',
      'Recomendado en frutales de hueso y pepita, ornamentales, viticultura, horticultura y cultivos en general',
    ],
    composition: [
      { component: 'Materia orgánica', value: '2,17%' },
      { component: 'Nitrógeno total (N)', value: '0,35%' },
      { component: 'Nitrógeno orgánico', value: '0,33%' },
      { component: 'Potasio (K)', value: '0,36%' },
      { component: 'Hierro (Fe)', value: '0,017%' },
      { component: 'Cobre (Cu)', value: '< 2,00 mg/kg' },
      { component: 'Aminoácidos', value: '0,4%' },
      { component: 'Ácido algínico', value: '0,36%' },
      { component: 'Manitol', value: '0,05%' },
      { component: 'CE', value: '13,4' },
    ],
    density: '1,03 g/L',
    ph: '4,4',
    formats: ['25 L', '1000 L'],
    certifications: [
      'CAAE · apto para agricultura ecológica (Reglamento UE)',
      'Permitido según el estándar Demeter/Biodinámico',
    ],
    manufacturer: 'Fabricado por CIF B56039407 · Love Green Project',
    distributor: 'OEA Quality Certificaciones y Servicios SL · Madrid',
    precautions: [
      'Agitar antes de usar · almacenar ventilado entre 0 y 30 °C',
      'NO mezclar con productos con cobre, ni con aceites minerales o azufres',
      'Utilizar equipo de protección adecuado al manipular',
      'Consulte a su técnico',
    ],
    source: 'Etiqueta del envase (fotos 09-jul-2026) · el valor de fósforo no se transcribe (ilegible en la foto)',
  },
];

/** Normaliza para matching: minúsculas, sin acentos, solo alfanumérico+espacio. */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Busca un producto del catálogo por nombre tecleado/registrado.
 * "Love Green Plus (nanopartícula)" → love-green-lg-miner (alias 'love green').
 */
export function findCatalogProduct(name: string | undefined | null): ProductSpec | undefined {
  if (!name) return undefined;
  const n = norm(name);
  if (!n) return undefined;
  return PRODUCT_CATALOG.find((p) =>
    p.aliases.some((a) => n.includes(norm(a))) || norm(p.name).includes(n),
  );
}

/** Rango de etiqueta legible para una vía de aplicación, p.ej. "200–1500 g/ha". */
export function labelRangeText(r: LabelDoseRange): string {
  return `${r.min}–${r.max} ${r.unit}`;
}
