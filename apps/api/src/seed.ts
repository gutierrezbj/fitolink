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

  // If real pipeline data exists (snapshots from openEO), preserve it — skip seed
  const realSnapshots = await NdviSnapshot.countDocuments({ 'points.0': { $exists: true } });
  const userCount = await User.countDocuments({});
  if (userCount > 0 && realSnapshots > 3) {
    logger.info({ snapshots: realSnapshots }, 'Real pipeline data detected — skipping seed to preserve NDVI data');
    await mongoose.disconnect();
    return;
  }

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

  // Parcel 4 — Healthy olive grove, DOP Estepa Norte (real SIGPAC 41-41-0-0-3-3)
  const parcel4 = await Parcel.create({
    ownerId: farmer._id,
    name: 'Olivar DOP Estepa Norte',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-4.853536553146634, 37.2149381247871], [-4.854156364748262, 37.21638496038377], [-4.85420624964796, 37.21660453859967], [-4.854339254533604, 37.21719035320001], [-4.85436388308116, 37.21729893238016], [-4.854461798803467, 37.217611220318], [-4.854468849660835, 37.21763706675616], [-4.854006108228481, 37.217709742051944], [-4.853986990782588, 37.21763316162725], [-4.85339539685967, 37.217727230055765], [-4.853530344670585, 37.21847569130589], [-4.854680465068249, 37.21828041306692], [-4.85490239440813, 37.21855353572166], [-4.85496328558554, 37.21862855962685], [-4.855579891109013, 37.22340723043127], [-4.855096550310197, 37.22320174135725], [-4.854886792332637, 37.2231226505524], [-4.854732714502974, 37.22307134827279], [-4.854499034572335, 37.223004888158584], [-4.854336021633358, 37.222975265672815], [-4.854053870830171, 37.22295444837686], [-4.853666123128154, 37.222947716870024], [-4.853500888146513, 37.22221910815875], [-4.853404242282614, 37.22177440542128], [-4.85333630946793, 37.221572680660195], [-4.853210067940358, 37.22155798299212], [-4.853133427165951, 37.22119840854471], [-4.85298889967733, 37.22071254060194], [-4.852916220190598, 37.22049123068474], [-4.852823172677944, 37.2202079013859], [-4.852806374504797, 37.220152846528016], [-4.852792375887476, 37.22010696650189], [-4.852621141977378, 37.219545745245114], [-4.852478109820372, 37.219130157888245], [-4.852489758990095, 37.21900262470932], [-4.85240657278711, 37.21861476133703], [-4.852486205901129, 37.2184977910331], [-4.852352175070475, 37.21804465945331], [-4.852296862888149, 37.217833367587374], [-4.852176032717587, 37.217422204199266], [-4.851944725703879, 37.21685748265951], [-4.851856041810277, 37.2168298483613], [-4.851810800485212, 37.216620381235806], [-4.851783493081241, 37.216494268789546], [-4.851729852250508, 37.216443644605945], [-4.851674150309661, 37.216257774215656], [-4.851632177088837, 37.21611737984374], [-4.851624153092453, 37.21607036826062], [-4.851570316125174, 37.21593791490423], [-4.851472236117556, 37.21569646746346], [-4.851270568353418, 37.215048092010505], [-4.851548244896427, 37.215034647437015], [-4.853536553146634, 37.2149381247871],
      ]],
    },
    areaHa: 17.24,
    cropType: 'olivo',
    province: 'Sevilla',
    sigpacRef: '41-41-0-0-3-3',
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

  // Parcel 5 — Olive grove with active stress — Estepa Sur (real SIGPAC 41-41-0-0-3-5)
  const parcel5 = await Parcel.create({
    ownerId: farmer._id,
    name: 'Olivar DOP Estepa Sur',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-4.843644031782838, 37.21713657322967], [-4.843744457885293, 37.21713717253579], [-4.843824673541616, 37.21715034385922], [-4.843901961398987, 37.21716797770816], [-4.844049269165056, 37.21720560994107], [-4.844345463009653, 37.21732303119141], [-4.844452087529873, 37.217365262574866], [-4.844567834075859, 37.217411858415566], [-4.844652044547471, 37.21745020311029], [-4.844790036665799, 37.21756801411915], [-4.844839583774781, 37.21763141316214], [-4.844870538983228, 37.21768545380968], [-4.844897412204588, 37.21772919812675], [-4.844896719859345, 37.21780257331148], [-4.844885911394561, 37.217877007968845], [-4.84487337625762, 37.217986974354055], [-4.844862798295188, 37.21803851300335], [-4.84481186649572, 37.21810816410829], [-4.844788436560389, 37.21815953763408], [-4.844749203383875, 37.218209809777726], [-4.844683233611031, 37.218356124288206], [-4.844676072112534, 37.21838137728759], [-4.844662359318129, 37.21842935865697], [-4.844635567401234, 37.21852774544225], [-4.844610529816778, 37.218596362220275], [-4.844585059726093, 37.21871202913818], [-4.84454795136216, 37.2188310354065], [-4.844540390046858, 37.2188676509145], [-4.844539351528994, 37.218982310327576], [-4.844538083346968, 37.219106071649854], [-4.844537070813004, 37.21920351630917], [-4.844535455620167, 37.21936856185979], [-4.84453438860383, 37.21947745368495], [-4.84453386473485, 37.21953166699971], [-4.844533524429561, 37.21956687434789], [-4.844532519439311, 37.219659807866655], [-4.844525834032943, 37.220047188441285], [-4.844518687621872, 37.22061924498494], [-4.844472378442281, 37.221388201665924], [-4.844472454717604, 37.22139135493808], [-4.844476484736888, 37.221552171818296], [-4.844460078836833, 37.222031179172916], [-4.844452110999203, 37.22226392033034], [-4.844441454246875, 37.222395759293185], [-4.844476066479896, 37.22271571164374], [-4.844476860246173, 37.222720565604156], [-4.844522155215421, 37.22299789681273], [-4.844530477607576, 37.22308041497799], [-4.844541530823948, 37.223177941779966], [-4.84457961819423, 37.22333056199658], [-4.844601802578676, 37.2234419809657], [-4.844628795661258, 37.22357755406663], [-4.844003816616017, 37.223659116694876], [-4.843822804377098, 37.22369581937467], [-4.843641259887294, 37.22371504997626], [-4.843342895129644, 37.223722669964886], [-4.84262790282088, 37.22372721547125], [-4.842523681392442, 37.22220353290534], [-4.842407408462906, 37.22220966845883], [-4.841919284111666, 37.22140224638371], [-4.843179959304181, 37.22139831527089], [-4.842886298470873, 37.21963441991863], [-4.842097972886888, 37.21973140273504], [-4.84184097869119, 37.219752701152274], [-4.841787397371972, 37.21980166320438], [-4.841746893498861, 37.2198369024038], [-4.841684975538252, 37.21986742342963], [-4.841634587724333, 37.21988551157776], [-4.841537034100266, 37.21989171586285], [-4.841419384023958, 37.219896699742776], [-4.841369023870321, 37.2199112725205], [-4.841339991470575, 37.21994552265528], [-4.841330616311319, 37.22002344418456], [-4.841330123455383, 37.22006806524876], [-4.841481706830514, 37.22140355060792], [-4.840843289079118, 37.22140464109359], [-4.839925495772839, 37.22140619426034], [-4.83980992440864, 37.2210649661237], [-4.838678635633954, 37.22116662017504], [-4.838510313597191, 37.219645370037576], [-4.837382486548721, 37.21968918560083], [-4.837368380643033, 37.21909366475604], [-4.837384387564473, 37.2189265932993], [-4.837416155817578, 37.218772796263416], [-4.837460471780477, 37.218620331950206], [-4.837505724840208, 37.21849282391699], [-4.837509666011314, 37.2184741062879], [-4.837535618899651, 37.218401150198346], [-4.837720334263612, 37.217955491085675], [-4.837755593579596, 37.21784805603537], [-4.837800300139206, 37.21771198924032], [-4.837888727546556, 37.21745033051522], [-4.837904682500194, 37.2173972722268], [-4.838167013453962, 37.21755434491064], [-4.838252778768705, 37.21758699242544], [-4.838726097325301, 37.217721865637415], [-4.838940741114512, 37.21777603871903], [-4.839771961928722, 37.21797510809303], [-4.840151187749278, 37.218058892763935], [-4.840324682258795, 37.218065749999326], [-4.840439419623579, 37.218066495150566], [-4.840534159442584, 37.218055648967216], [-4.840673506914735, 37.218039332753534], [-4.841046789965588, 37.217990091584035], [-4.841465062046204, 37.217904549227924], [-4.84179748666942, 37.217787443975354], [-4.841945912581439, 37.217723036589355], [-4.842122772425281, 37.217673693160634], [-4.84224428320642, 37.21762945682582], [-4.842351654554258, 37.21759036865624], [-4.842599713640642, 37.21745204209996], [-4.842867599281972, 37.21733683953951], [-4.842978605023241, 37.21728590103453], [-4.84307216718478, 37.21724524377258], [-4.843204497327179, 37.21720487903907], [-4.843312283579247, 37.21718373401068], [-4.843471803778964, 37.21714925504993], [-4.843644031782838, 37.21713657322967],
      ]],
    },
    areaHa: 25.95,
    cropType: 'olivo',
    province: 'Sevilla',
    sigpacRef: '41-41-0-0-3-5',
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
    [-4.8449, 37.2171, -4.8374, 37.2237],
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
