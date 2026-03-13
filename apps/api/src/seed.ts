import mongoose from 'mongoose';
import { User } from './models/User.js';
import { Parcel } from './models/Parcel.js';
import { Alert } from './models/Alert.js';
import { logger } from './utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  logger.info('Connected to MongoDB for seeding');

  // Clear existing data
  await Promise.all([User.deleteMany({}), Parcel.deleteMany({}), Alert.deleteMany({})]);

  // Create admin user
  const admin = await User.create({
    email: 'admin@fitolink.srs.es',
    name: 'Admin FitoLink',
    role: 'admin',
    googleId: 'demo-admin-001',
    isVerified: true,
  });

  // Create farmer
  const farmer = await User.create({
    email: 'agricultor@demo.com',
    name: 'Antonio Garcia Lopez',
    role: 'farmer',
    phone: '+34 612 345 678',
    googleId: 'demo-farmer-001',
    location: { type: 'Point', coordinates: [-3.7038, 37.1882] },
    isVerified: true,
  });

  // Create pilot
  const pilot = await User.create({
    email: 'piloto@demo.com',
    name: 'Carlos Martinez Ruiz',
    role: 'pilot',
    phone: '+34 687 654 321',
    googleId: 'demo-pilot-001',
    location: { type: 'Point', coordinates: [-3.6, 37.2] },
    certifications: [
      { type: 'AESA A1/A3', number: 'ESP-2024-0001', expiry: new Date('2027-06-01') },
      { type: 'ROPO Aplicador', number: 'ROPO-2024-1234', expiry: new Date('2028-01-01') },
    ],
    equipment: [
      { model: 'DJI Agras T40', type: 'Aplicador fitosanitario', payloadKg: 40 },
      { model: 'DJI Matrice 350 RTK', type: 'Inspeccion multiespectral', payloadKg: 2.7 },
    ],
    operationalRadiusKm: 100,
    isVerified: true,
    rating: 4.8,
    ratingCount: 12,
  });

  // Create insurer
  const insurer = await User.create({
    email: 'seguros@demo.com',
    name: 'Maria Rodriguez Perez',
    role: 'insurer',
    googleId: 'demo-insurer-001',
    company: 'Agromutua',
    contractId: 'AGR-2026-001',
    isVerified: true,
  });

  // Create parcels in Jaen (olive groves)
  const parcel1 = await Parcel.create({
    ownerId: farmer._id,
    name: 'Olivar El Cerro',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-3.7900, 37.7700],
        [-3.7800, 37.7700],
        [-3.7800, 37.7600],
        [-3.7900, 37.7600],
        [-3.7900, 37.7700],
      ]],
    },
    areaHa: 12.5,
    cropType: 'olivo',
    province: 'Jaen',
    sigpacRef: '23-050-0001-00001',
    isInsured: true,
    insurerId: insurer._id,
    ndviHistory: [
      { date: new Date('2026-01-15'), mean: 0.72, min: 0.55, max: 0.85, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-20'), mean: 0.70, min: 0.52, max: 0.83, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-25'), mean: 0.68, min: 0.48, max: 0.80, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-30'), mean: 0.55, min: 0.30, max: 0.72, anomalyDetected: true, source: 'sentinel2' },
      { date: new Date('2026-02-04'), mean: 0.52, min: 0.28, max: 0.70, anomalyDetected: true, source: 'sentinel2' },
    ],
  });

  const parcel2 = await Parcel.create({
    ownerId: farmer._id,
    name: 'Vinedo La Mancha',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-3.0000, 39.0000],
        [-2.9900, 39.0000],
        [-2.9900, 38.9950],
        [-3.0000, 38.9950],
        [-3.0000, 39.0000],
      ]],
    },
    areaHa: 8.3,
    cropType: 'vinedo',
    province: 'Ciudad Real',
    ndviHistory: [
      { date: new Date('2026-01-15'), mean: 0.65, min: 0.50, max: 0.78, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-20'), mean: 0.64, min: 0.49, max: 0.77, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-25'), mean: 0.63, min: 0.48, max: 0.76, anomalyDetected: false, source: 'sentinel2' },
    ],
  });

  // Create alerts for parcel1
  await Alert.create({
    parcelId: parcel1._id,
    type: 'ndvi_drop',
    severity: 'high',
    ndviValue: 0.55,
    ndviDelta: -0.13,
    detectedAt: new Date('2026-01-30'),
    status: 'notified',
    aiConfidence: 0.87,
    imagery: { sentinelScene: 'S2B_MSIL2A_20260130T110119' },
  });

  await Alert.create({
    parcelId: parcel1._id,
    type: 'stress_pattern',
    severity: 'medium',
    ndviValue: 0.52,
    ndviDelta: -0.03,
    detectedAt: new Date('2026-02-04'),
    status: 'new',
    aiConfidence: 0.72,
    imagery: { sentinelScene: 'S2A_MSIL2A_20260204T110121' },
  });

  logger.info({
    users: 4,
    parcels: 2,
    alerts: 2,
  }, 'Seed completed successfully');

  await mongoose.disconnect();
}

seed().catch((error) => {
  logger.error({ error }, 'Seed failed');
  process.exit(1);
});
