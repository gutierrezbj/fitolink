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
        [-5.4605570076738,37.38524371726029],[-5.460829494980246,37.38546108516819],[-5.46101645250344,37.3856313694086],[-5.461132932465996,37.385753115721236],[-5.461446852360479,37.38603278380455],[-5.461635092314935,37.38619711856974],[-5.461696969204215,37.38622531697007],[-5.461773642668047,37.38623365193508],[-5.461871063858037,37.386223425174414],[-5.461947432220574,37.38622877282896],[-5.462145947550741,37.38630789799961],[-5.46222980682059,37.386342576449664],[-5.462293122882731,37.38634819567789],[-5.46242520240621,37.386326363333396],[-5.462520469446956,37.38631050225708],[-5.462608906912589,37.3863520236933],[-5.462676914326216,37.38636795266303],[-5.462728955051538,37.3863616645589],[-5.462776719329609,37.38635049986321],[-5.462878268607156,37.38633426914494],[-5.462941414516653,37.38633468740193],[-5.463078487140148,37.386465393969594],[-5.463118383325242,37.38648711232019],[-5.463148432449903,37.38649297797638],[-5.463197726425393,37.38652105986825],[-5.463421235754116,37.38640423205669],[-5.463550536676529,37.38633664709101],[-5.463755184207421,37.386229676398166],[-5.463825721279575,37.3861928060803],[-5.463872457936254,37.38616837702205],[-5.464023266823487,37.386065826107014],[-5.464145282195227,37.386002572070964],[-5.464261281036513,37.38595505422086],[-5.464401010723472,37.38589209690419],[-5.464425603228843,37.38587924157853],[-5.464589585115885,37.38580944127571],[-5.464728661852548,37.38573542319896],[-5.464843410951996,37.38564977020173],[-5.464941949449744,37.385600881072186],[-5.46503114296309,37.38559902112776],[-5.465413349388591,37.38596918778683],[-5.466308229922993,37.38677097386992],[-5.466365766662554,37.38680743850365],[-5.466411471506892,37.3868267160439],[-5.466321481712698,37.3868712063504],[-5.465466404324258,37.38735295291114],[-5.465096355850032,37.38756144689762],[-5.46297451549244,37.38875680023845],[-5.462115085381424,37.389210407072184],[-5.462025489536702,37.389257691905364],[-5.46198824538593,37.389289558226736],[-5.461797220124883,37.38930551820952],[-5.461154967652558,37.389365480672005],[-5.460956586432849,37.38937735699131],[-5.46080213057933,37.38939607378221],[-5.460725381678365,37.38934927929039],[-5.460689310155916,37.38928235314234],[-5.46070390724116,37.38921049675855],[-5.460728646429845,37.389151950837785],[-5.460770064768647,37.389085393493495],[-5.460785083463644,37.389023171269784],[-5.460777709064794,37.388946004950014],[-5.460758139834293,37.38886909260193],[-5.460672578199809,37.38870803851384],[-5.460645740182444,37.38865750150204],[-5.460643036180319,37.38861970833658],[-5.460655895696932,37.38856726360349],[-5.460647977312534,37.38854616048462],[-5.460615577063893,37.38846023339914],[-5.460496864162199,37.38837330970531],[-5.460383572675798,37.388317633748365],[-5.46030546758282,37.388301867387554],[-5.460259357892535,37.38830093448168],[-5.460191654742012,37.38830621927194],[-5.460129017614068,37.38831103719017],[-5.460036067331497,37.388290082431],[-5.459936511270644,37.388267643236674],[-5.459820443697748,37.38823067820329],[-5.459717389868492,37.388197943516694],[-5.459610640457907,37.38818673774968],[-5.459414645566174,37.388123139217385],[-5.459209524457725,37.38805657684395],[-5.459084872139089,37.38801609476379],[-5.458989972225725,37.38795985386654],[-5.458827261035279,37.387874294746624],[-5.458734409659171,37.3878530658992],[-5.458450044357034,37.38783951236096],[-5.458260104552513,37.38781255364418],[-5.458048000480115,37.38777433970716],[-5.45787289161595,37.38775869236938],[-5.457746999613762,37.38776320267175],[-5.457641152096012,37.38778667200203],[-5.457545201930118,37.38781578738262],[-5.457477559967492,37.38782296145397],[-5.457409036228599,37.38780311897341],[-5.457321885385179,37.38773148638645],[-5.457228800153959,37.38762699422252],[-5.457103920685733,37.38751361472613],[-5.457071548935565,37.387501041032436],[-5.45751077661355,37.387221293321026],[-5.458562440656122,37.38654312103871],[-5.459062669314454,37.386215783392835],[-5.460406620396324,37.38534191209998],[-5.4605570076738,37.38524371726029],
      ]],
    },
    areaHa: 18.4,
    cropType: 'cereal',
    province: 'Sevilla',
    sigpacRef: '41-60-0-0-2-5-1',
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
        [-5.475119841105928,37.38073993685409],[-5.474418018444212,37.38132144986146],[-5.473660080613796,37.381869078185055],[-5.473177643384197,37.38220935078468],[-5.472834135369756,37.38244056308288],[-5.472504482642083,37.382646517352555],[-5.472263968945382,37.38284691693467],[-5.472043892006211,37.383040222911696],[-5.47082288249644,37.381897222941205],[-5.470792939821955,37.38186919217895],[-5.470174175120096,37.38128988193586],[-5.470076151271234,37.38130715536295],[-5.470001396425152,37.38133715838713],[-5.469894414835835,37.3814033871608],[-5.4698576199551,37.381436152860445],[-5.469840801665384,37.3814667241777],[-5.469829385512584,37.38149939432364],[-5.468737509287149,37.38050655531922],[-5.468717213345601,37.38048809920553],[-5.468682193752062,37.38043953697023],[-5.468615220665349,37.38035667766149],[-5.468527051420632,37.380229923161416],[-5.46846046809244,37.380110737520354],[-5.468496734913244,37.380087181018276],[-5.468517086175357,37.38007396359438],[-5.468541858891657,37.38005803630102],[-5.468580341887792,37.38003317222197],[-5.46976471744938,37.37926904267931],[-5.470204842829248,37.37965574264337],[-5.470299134216406,37.37971795564699],[-5.470804262097434,37.379407727981075],[-5.470867715622796,37.37940178521137],[-5.4709150331454,37.37943311844368],[-5.471351218192352,37.3798534256505],[-5.471601645166525,37.380079063982755],[-5.471695978463202,37.38013250113323],[-5.471736454676029,37.38013165456096],[-5.47179367206506,37.380111988938566],[-5.47186853922865,37.38010118885569],[-5.471921791977245,37.38013701562655],[-5.472094475956677,37.38028578100567],[-5.472168586234366,37.38025190889474],[-5.472383315518994,37.38009504324392],[-5.472705786631601,37.379871279943515],[-5.472945309587288,37.37976468643634],[-5.473250557564232,37.37972136205264],[-5.473430413938636,37.379736069779014],[-5.473728189448457,37.37981757205755],[-5.474376539755704,37.38000255648062],[-5.474452921529289,37.38003789710107],[-5.474870266571359,37.38041241061538],[-5.475043260681228,37.38057040027948],[-5.475119841105928,37.38073993685409],
      ]],
    },
    areaHa: 12.4,
    cropType: 'olivo',
    province: 'Sevilla',
    sigpacRef: '41-60-0-0-2-7-1',
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
    const step = 0.00018; // ~20m resolution (Sentinel-2)
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

  // Parcel7 — Olivar Marchena (ASAJA) — critical stress sw
  await NdviSnapshot.create(makeGrid(
    [-5.475120, 37.379269, -5.468460, 37.383040],
    0.34, 'sw',
    new Date('2026-03-11'),
    parcelAsajaOlivo._id as mongoose.Types.ObjectId,
  ));

  logger.info({
    users: 5,
    parcels: 7,
    alerts: 6,
    operations: 5,
    snapshots: 3,
  }, 'Seed completed successfully');

  await mongoose.disconnect();
}

seed().catch((error) => {
  logger.error({ error }, 'Seed failed');
  process.exit(1);
});
