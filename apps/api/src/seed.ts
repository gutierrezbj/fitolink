import mongoose from 'mongoose';
import { User } from './models/User.js';
import { Parcel } from './models/Parcel.js';
import { Alert } from './models/Alert.js';
import { Operation } from './models/Operation.js';
import { NdviSnapshot } from './models/NdviSnapshot.js';
import { logger } from './utils/logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:6040/fitolink';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  logger.info('Connected to MongoDB for seeding');

  // Clear existing data
  await Promise.all([User.deleteMany({}), Parcel.deleteMany({}), Alert.deleteMany({}), Operation.deleteMany({}), NdviSnapshot.deleteMany({})]);

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

  // Create ASAJA demo farmer (Sevilla — cereal + olivo)
  const asajaFarmer = await User.create({
    email: 'asaja@demo.com',
    name: 'Miguel Santos Reyes',
    role: 'farmer',
    phone: '+34 654 789 012',
    googleId: 'demo-farmer-002',
    location: { type: 'Point', coordinates: [-5.9845, 37.3891] },
    isVerified: true,
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
        [-3.7905, 37.7673],
        [-3.7863, 37.7651],
        [-3.7812, 37.7659],
        [-3.7788, 37.7692],
        [-3.7799, 37.7726],
        [-3.7844, 37.7732],
        [-3.7893, 37.7718],
        [-3.7905, 37.7673],
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
        [-3.4131, 38.7628],
        [-3.4089, 38.7609],
        [-3.4048, 38.7617],
        [-3.4039, 38.7645],
        [-3.4058, 38.7661],
        [-3.4101, 38.7655],
        [-3.4131, 38.7628],
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
  const alert1 = await Alert.create({
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

  const alert2 = await Alert.create({
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

  // Third parcel — healthy contrast
  const parcel3 = await Parcel.create({
    ownerId: farmer._id,
    name: 'Cereal Guadalquivir',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-4.7998, 37.8795],
        [-4.7941, 37.8768],
        [-4.7889, 37.8774],
        [-4.7872, 37.8734],
        [-4.7891, 37.8718],
        [-4.7962, 37.8712],
        [-4.8009, 37.8741],
        [-4.8014, 37.8772],
        [-4.7998, 37.8795],
      ]],
    },
    areaHa: 25.0,
    cropType: 'cereal',
    province: 'Cordoba',
    ndviHistory: [
      { date: new Date('2026-01-15'), mean: 0.78, min: 0.65, max: 0.88, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-20'), mean: 0.80, min: 0.68, max: 0.90, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-25'), mean: 0.82, min: 0.70, max: 0.91, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-02-04'), mean: 0.81, min: 0.69, max: 0.90, anomalyDetected: false, source: 'sentinel2' },
    ],
  });

  // === Oleoestepa parcels (DOP Estepa, Sevilla) ===

  // Parcel 4 — Healthy olive grove, DOP Estepa Norte
  const parcel4 = await Parcel.create({
    ownerId: farmer._id,
    name: 'Olivar DOP Estepa Norte',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-4.8758, 37.2974],
        [-4.8712, 37.2958],
        [-4.8664, 37.2963],
        [-4.8647, 37.2934],
        [-4.8663, 37.2912],
        [-4.8711, 37.2908],
        [-4.8756, 37.2921],
        [-4.8771, 37.2951],
        [-4.8758, 37.2974],
      ]],
    },
    areaHa: 8.5,
    cropType: 'olivo',
    province: 'Sevilla',
    sigpacRef: '41-042-0002-00015',
    isInsured: true,
    insurerId: insurer._id,
    ndviHistory: [
      { date: new Date('2026-01-10'), mean: 0.71, min: 0.58, max: 0.82, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-15'), mean: 0.73, min: 0.60, max: 0.84, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-20'), mean: 0.74, min: 0.61, max: 0.85, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-25'), mean: 0.75, min: 0.62, max: 0.86, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-02-04'), mean: 0.76, min: 0.63, max: 0.87, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-02-14'), mean: 0.75, min: 0.61, max: 0.85, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-02-24'), mean: 0.74, min: 0.60, max: 0.84, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-03-05'), mean: 0.73, min: 0.59, max: 0.83, anomalyDetected: false, source: 'sentinel2' },
    ],
  });

  // Parcel 5 — Olive grove with active stress — Estepa Sur
  const parcel5 = await Parcel.create({
    ownerId: farmer._id,
    name: 'Olivar DOP Estepa Sur',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-4.8818, 37.2832],
        [-4.8768, 37.2841],
        [-4.8718, 37.2837],
        [-4.8693, 37.2812],
        [-4.8701, 37.2769],
        [-4.8742, 37.2758],
        [-4.8791, 37.2762],
        [-4.8826, 37.2788],
        [-4.8818, 37.2832],
      ]],
    },
    areaHa: 14.2,
    cropType: 'olivo',
    province: 'Sevilla',
    sigpacRef: '41-042-0002-00031',
    isInsured: true,
    insurerId: insurer._id,
    ndviHistory: [
      { date: new Date('2026-01-10'), mean: 0.70, min: 0.57, max: 0.81, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-15'), mean: 0.69, min: 0.55, max: 0.80, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-20'), mean: 0.67, min: 0.52, max: 0.78, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-25'), mean: 0.63, min: 0.47, max: 0.75, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-02-04'), mean: 0.57, min: 0.38, max: 0.70, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-02-14'), mean: 0.49, min: 0.29, max: 0.64, anomalyDetected: true,  source: 'sentinel2' },
      { date: new Date('2026-02-24'), mean: 0.43, min: 0.24, max: 0.59, anomalyDetected: true,  source: 'sentinel2' },
      { date: new Date('2026-03-05'), mean: 0.38, min: 0.19, max: 0.54, anomalyDetected: true,  source: 'sentinel2' },
    ],
  });

  // Alert on vinedo parcel
  const alert3 = await Alert.create({
    parcelId: parcel2._id,
    type: 'ndvi_drop',
    severity: 'critical',
    ndviValue: 0.28,
    ndviDelta: -0.35,
    detectedAt: new Date('2026-03-10'),
    status: 'new',
    aiConfidence: 0.94,
    imagery: { sentinelScene: 'S2B_MSIL2A_20260310T110119' },
  });

  // Alerts on Oleoestepa Sur parcel — stress_pattern over 3 consecutive readings
  const alert4 = await Alert.create({
    parcelId: parcel5._id,
    type: 'stress_pattern',
    severity: 'high',
    ndviValue: 0.49,
    ndviDelta: -0.08,
    detectedAt: new Date('2026-02-14'),
    status: 'notified',
    aiConfidence: 0.81,
    imagery: { sentinelScene: 'S2A_MSIL2A_20260214T105911' },
  });

  const alert5 = await Alert.create({
    parcelId: parcel5._id,
    type: 'stress_pattern',
    severity: 'high',
    ndviValue: 0.38,
    ndviDelta: -0.05,
    detectedAt: new Date('2026-03-05'),
    status: 'new',
    aiConfidence: 0.89,
    imagery: { sentinelScene: 'S2B_MSIL2A_20260305T105921' },
  });

  // === Operations at different stages ===

  // 1. Completed operation (full traceability)
  await Operation.create({
    parcelId: parcel1._id,
    farmerId: farmer._id,
    pilotId: pilot._id,
    type: 'phytosanitary',
    status: 'completed',
    alertId: alert1._id,
    flightLog: {
      startTime: new Date('2026-02-15T09:30:00'),
      endTime: new Date('2026-02-15T11:15:00'),
      areaHa: 12.5,
    },
    product: {
      name: 'Dimetoato 40 EC',
      activeSubstance: 'Dimetoato',
      doseLPerHa: 1.5,
    },
    applicationMethod: 'Pulverizacion aerea con DJI Agras T40',
    weatherConditions: { temp: 18, windKmh: 6, humidity: 52 },
    completedAt: new Date('2026-02-15T11:15:00'),
    createdAt: new Date('2026-02-10'),
  });

  // 2. In-progress operation (pilot can complete)
  await Operation.create({
    parcelId: parcel1._id,
    farmerId: farmer._id,
    pilotId: pilot._id,
    type: 'inspection',
    status: 'in_progress',
    alertId: alert2._id,
    createdAt: new Date('2026-03-15'),
  });

  // 3. Assigned operation (pilot can accept/reject)
  await Operation.create({
    parcelId: parcel2._id,
    farmerId: farmer._id,
    pilotId: pilot._id,
    type: 'phytosanitary',
    status: 'assigned',
    alertId: alert3._id,
    createdAt: new Date('2026-03-18'),
  });

  // 4. Requested operation (no pilot assigned yet)
  await Operation.create({
    parcelId: parcel3._id,
    farmerId: farmer._id,
    type: 'diagnosis',
    status: 'requested',
    createdAt: new Date('2026-03-19'),
  });

  // 5. Oleoestepa Sur — requested phytosanitary intervention after stress_pattern alert
  await Operation.create({
    parcelId: parcel5._id,
    farmerId: farmer._id,
    pilotId: pilot._id,
    type: 'phytosanitary',
    status: 'assigned',
    alertId: alert5._id,
    product: {
      name: 'Fosmet 50 WP',
      activeSubstance: 'Fosmet',
      doseLPerHa: 1.2,
    },
    createdAt: new Date('2026-03-10'),
  });

  // === ASAJA parcels (Sevilla — Campiña, cereal + olivo) ===

  // Parcel 6 — Cereal ASAJA, La Campiña Sevillana
  await Parcel.create({
    ownerId: asajaFarmer._id,
    name: 'Cereal La Campiña',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-5.5198, 37.4094],
        [-5.5121, 37.4103],
        [-5.5062, 37.4088],
        [-5.5048, 37.4048],
        [-5.5071, 37.4011],
        [-5.5138, 37.4003],
        [-5.5196, 37.4022],
        [-5.5214, 37.4061],
        [-5.5198, 37.4094],
      ]],
    },
    areaHa: 32.0,
    cropType: 'cereal',
    province: 'Sevilla',
    sigpacRef: '41-091-0003-00042',
    isInsured: true,
    insurerId: insurer._id,
    ndviHistory: [
      { date: new Date('2026-01-10'), mean: 0.55, min: 0.42, max: 0.68, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-20'), mean: 0.62, min: 0.49, max: 0.74, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-30'), mean: 0.70, min: 0.57, max: 0.81, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-02-09'), mean: 0.75, min: 0.62, max: 0.85, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-02-19'), mean: 0.78, min: 0.65, max: 0.87, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-03-01'), mean: 0.76, min: 0.63, max: 0.86, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-03-11'), mean: 0.72, min: 0.58, max: 0.83, anomalyDetected: false, source: 'sentinel2' },
    ],
  });

  // Parcel 7 — Olivar ASAJA with anomaly — Marchena (Sevilla)
  const parcelAsajaOlivo = await Parcel.create({
    ownerId: asajaFarmer._id,
    name: 'Olivar Marchena',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-5.3848, 37.3314],
        [-5.3789, 37.3323],
        [-5.3731, 37.3318],
        [-5.3706, 37.3291],
        [-5.3714, 37.3251],
        [-5.3756, 37.3238],
        [-5.3812, 37.3242],
        [-5.3853, 37.3268],
        [-5.3861, 37.3298],
        [-5.3848, 37.3314],
      ]],
    },
    areaHa: 18.7,
    cropType: 'olivo',
    province: 'Sevilla',
    sigpacRef: '41-058-0001-00088',
    isInsured: false,
    ndviHistory: [
      { date: new Date('2026-01-10'), mean: 0.66, min: 0.53, max: 0.77, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-20'), mean: 0.65, min: 0.51, max: 0.76, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-01-30'), mean: 0.61, min: 0.46, max: 0.73, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-02-09'), mean: 0.54, min: 0.37, max: 0.67, anomalyDetected: false, source: 'sentinel2' },
      { date: new Date('2026-02-19'), mean: 0.45, min: 0.27, max: 0.60, anomalyDetected: true,  source: 'sentinel2' },
      { date: new Date('2026-03-01'), mean: 0.38, min: 0.20, max: 0.53, anomalyDetected: true,  source: 'sentinel2' },
      { date: new Date('2026-03-11'), mean: 0.34, min: 0.17, max: 0.49, anomalyDetected: true,  source: 'sentinel2' },
    ],
  });

  // Alert on Olivar Marchena
  await Alert.create({
    parcelId: parcelAsajaOlivo._id,
    type: 'stress_pattern',
    severity: 'critical',
    ndviValue: 0.34,
    ndviDelta: -0.04,
    detectedAt: new Date('2026-03-11'),
    status: 'new',
    aiConfidence: 0.92,
    imagery: { sentinelScene: 'S2A_MSIL2A_20260311T105851' },
  });

  // === NDVI Snapshots (simulate geo-pipeline output for demo heatmap) ===

  function makeGrid(
    bbox: [number, number, number, number], // [west, south, east, north]
    baseNdvi: number,
    stressCorner: 'none' | 'nw' | 'ne' | 'se' | 'sw',
    date: Date,
    parcelId: mongoose.Types.ObjectId,
  ) {
    const [west, south, east, north] = bbox;
    const step = 0.0012; // ~110m resolution
    const points = [];
    for (let lat = south + step / 2; lat < north; lat += step) {
      for (let lng = west + step / 2; lng < east; lng += step) {
        const relLat = (lat - south) / (north - south); // 0=south, 1=north
        const relLng = (lng - west) / (east - west);   // 0=west, 1=east
        let stress = 0;
        if (stressCorner === 'nw') stress = (1 - relLng) * relLat;
        else if (stressCorner === 'ne') stress = relLng * relLat;
        else if (stressCorner === 'sw') stress = (1 - relLng) * (1 - relLat);
        else if (stressCorner === 'se') stress = relLng * (1 - relLat);
        const noise = (Math.random() - 0.5) * 0.04;
        const ndvi = Math.max(0.05, Math.min(0.95, baseNdvi - stress * 0.35 + noise));
        points.push({ lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)), ndvi: parseFloat(ndvi.toFixed(4)) });
      }
    }
    return { parcelId, date, resolution: 20, points, bbox, pixelCount: points.length };
  }

  // Parcel1 — Olivar El Cerro (Jaén) — stress in NW quadrant
  await NdviSnapshot.create(makeGrid(
    [-3.7905, 37.7651, -3.7788, 37.7732],
    0.52, 'nw',
    new Date('2026-02-04'),
    parcel1._id as mongoose.Types.ObjectId,
  ));

  // Parcel5 — Olivar DOP Estepa Sur (Sevilla) — severe stress SE
  await NdviSnapshot.create(makeGrid(
    [-4.8826, 37.2758, -4.8693, 37.2841],
    0.38, 'se',
    new Date('2026-03-05'),
    parcel5._id as mongoose.Types.ObjectId,
  ));

  logger.info({
    users: 5,
    parcels: 7,
    alerts: 6,
    operations: 5,
    snapshots: 2,
  }, 'Seed completed successfully');

  await mongoose.disconnect();
}

seed().catch((error) => {
  logger.error({ error }, 'Seed failed');
  process.exit(1);
});
