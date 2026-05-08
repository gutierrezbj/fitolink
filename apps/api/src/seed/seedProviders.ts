/**
 * Seed marketplace providers — distributors, agronomic advisors, cooperatives.
 *
 * Idempotent: each entry is upserted by `name`. Safe to re-run after changing
 * descriptions, contacts, etc. — won't create duplicates.
 *
 * Run via:
 *   docker compose exec -T api node dist/seed/seedProviders.js
 *   (or in dev: tsx src/seed/seedProviders.ts)
 *
 * Cooperatives use real Spanish entities at conservative declared scale —
 * good enough for demo without making up numbers.
 */
import mongoose from 'mongoose';
import { Provider } from '../models/Provider.js';
import { logger } from '../utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

interface SeedEntry {
  category: 'phyto-distributor' | 'agronomist' | 'cooperative';
  name: string;
  brand?: string;
  description: string;
  // [longitude, latitude]
  coordinates: [number, number];
  serviceRadiusKm: number;
  cropSpecialties: string[];
  contact: { email?: string; phone?: string; website?: string };
  certifications?: string[];
  rating: number;
  ratingCount: number;
  notes?: string;
  memberCount?: number;
  aggregateAreaHa?: number;
}

const SEEDS: SeedEntry[] = [
  // ── Distribuidores fitosanitarios ────────────────────────────────────────
  {
    category: 'phyto-distributor',
    name: 'Sapec Agro Manzanares',
    brand: 'Sapec Agro',
    description: 'Distribución de fitosanitarios, abonos foliares y bioestimulantes para olivar, viñedo y cereal.',
    coordinates: [-3.367, 39.000],
    serviceRadiusKm: 30,
    cropSpecialties: ['olivo', 'vinedo', 'cereal'],
    contact: { phone: '+34 926 600 000' },
    certifications: ['ROPO-distribuidor'],
    rating: 4.5,
    ratingCount: 18,
  },
  {
    category: 'phyto-distributor',
    name: 'Syngenta · Tomelloso',
    brand: 'Syngenta',
    description: 'Centro técnico Syngenta. Cartera completa de fitosanitarios, semillas y servicios agronómicos.',
    coordinates: [-3.022, 39.158],
    serviceRadiusKm: 50,
    cropSpecialties: ['olivo', 'vinedo', 'cereal', 'girasol', 'maiz', 'almendro', 'pistacho'],
    contact: { website: 'https://www.syngenta.es' },
    certifications: ['ROPO-distribuidor', 'GLOBALG.A.P.'],
    rating: 4.7,
    ratingCount: 42,
  },
  {
    category: 'phyto-distributor',
    name: 'AgroToledo Distribuciones',
    description: 'Distribuidor local especializado en pistacho y cereal de secano en la zona de La Sagra y La Mancha alta.',
    coordinates: [-4.027, 39.857],
    serviceRadiusKm: 35,
    cropSpecialties: ['pistacho', 'cereal', 'olivo'],
    contact: { phone: '+34 925 200 000' },
    certifications: ['ROPO-distribuidor'],
    rating: 4.3,
    ratingCount: 9,
  },

  // ── Asesores agrónomos ───────────────────────────────────────────────────
  {
    category: 'agronomist',
    name: 'Sergio Lozano',
    description: 'Ingeniero agrónomo independiente. Cuaderno PAC, prescripción ROPO y asesoría en cereal y viñedo.',
    coordinates: [-3.022, 39.158],
    serviceRadiusKm: 60,
    cropSpecialties: ['cereal', 'vinedo', 'olivo'],
    contact: { phone: '+34 600 100 100' },
    certifications: ['Ing. Agrónomo COIAA', 'Asesor ROPO', 'Cuaderno PAC certificado'],
    rating: 4.8,
    ratingCount: 22,
  },
  {
    category: 'agronomist',
    name: 'María Vega',
    description: 'Asesora agronómica especializada en olivar DOP y manejo de riego deficitario en Andalucía.',
    coordinates: [-5.984, 37.389],
    serviceRadiusKm: 80,
    cropSpecialties: ['olivo', 'citrico'],
    contact: { phone: '+34 600 200 200' },
    certifications: ['Ing. Agrónoma', 'Especialista riego deficitario'],
    rating: 4.9,
    ratingCount: 31,
  },
  {
    category: 'agronomist',
    name: 'Carlos Pérez',
    description: 'Consultor enólogo-agrónomo. Viñedo DOC Rioja, agricultura ecológica y reconversión.',
    coordinates: [-2.445, 42.466],
    serviceRadiusKm: 100,
    cropSpecialties: ['vinedo'],
    contact: { phone: '+34 600 300 300' },
    certifications: ['Enólogo', 'CAER ecológico'],
    rating: 4.6,
    ratingCount: 14,
  },

  // ── Cooperativas (cliente potencial estratégico) ─────────────────────────
  {
    category: 'cooperative',
    name: 'DCOOP',
    description: 'Mayor cooperativa olivarera del mundo. Comercialización, suministros y servicios técnicos a sus socios.',
    coordinates: [-4.564, 37.020],
    serviceRadiusKm: 200,
    cropSpecialties: ['olivo'],
    contact: { website: 'https://www.dcoop.es' },
    certifications: ['Cooperativa de 2º grado', 'Sello DOP'],
    rating: 4.5,
    ratingCount: 200,
    memberCount: 75000,
    aggregateAreaHa: 250000,
    notes: 'Programa cooperativa: monitoreo agregado, alertas zona, cuaderno PAC compartido.',
  },
  {
    category: 'cooperative',
    name: 'Vinícola del Carmen',
    description: 'Cooperativa vitivinícola DOC Rioja. 280 socios, vinificación propia y suministros conjuntos.',
    coordinates: [-2.448, 42.468],
    serviceRadiusKm: 50,
    cropSpecialties: ['vinedo'],
    contact: { website: 'https://www.vinicoladelcarmen.com' },
    certifications: ['DOC Rioja'],
    rating: 4.6,
    ratingCount: 28,
    memberCount: 280,
    aggregateAreaHa: 3500,
    notes: 'Programa cooperativa: monitoreo NDVI/NDRE de socios, asesoría centralizada.',
  },
];

async function seedProviders() {
  await mongoose.connect(MONGODB_URI);
  logger.info('Connected to MongoDB for provider seed');

  let upserted = 0;
  for (const entry of SEEDS) {
    const result = await Provider.updateOne(
      { name: entry.name },
      {
        $set: {
          category: entry.category,
          brand: entry.brand,
          description: entry.description,
          location: { type: 'Point', coordinates: entry.coordinates },
          serviceRadiusKm: entry.serviceRadiusKm,
          cropSpecialties: entry.cropSpecialties,
          contact: entry.contact,
          certifications: entry.certifications ?? [],
          rating: entry.rating,
          ratingCount: entry.ratingCount,
          isVerified: true,
          notes: entry.notes,
          memberCount: entry.memberCount,
          aggregateAreaHa: entry.aggregateAreaHa,
        },
        $setOnInsert: { name: entry.name },
      },
      { upsert: true },
    );
    const wasUpsert = result.upsertedCount > 0;
    upserted += wasUpsert ? 1 : 0;
    logger.info({ name: entry.name, category: entry.category, upsert: wasUpsert }, 'Provider seeded');
  }

  const total = await Provider.countDocuments({});
  logger.info({ totalProviders: total, newlyCreated: upserted }, 'Provider seed complete');

  await mongoose.disconnect();
}

seedProviders().catch((err) => {
  logger.error({ err }, 'Provider seed failed');
  process.exit(1);
});
