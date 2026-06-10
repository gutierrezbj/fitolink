/**
 * Seed: cuenta demo para cliente fondo de inversión ENCINEÑO.
 *
 * Contexto: KMZ recibido 10-jun-2026 vía Jorge Leccia (jorgeleccia@hotmail.com)
 * de Guillermo Morales Sanchez (guillermoms@live.com). Asunto literal del
 * forward: "AgroM · Aplicación Aerea Agricola". El fondo gestiona 2.300 ha
 * en cartera total y envía ENCINEÑO (407 ha · sector único) para evaluación
 * de alcance operativo SRS antes de la demo Microsoft del 12-jun-2026.
 *
 * NO usamos el email real del propietario (Guillermo) como login. La cuenta
 * es demo identificable (`demo-encineno@agrom.es`) — borrable sin afectar
 * datos de cliente real.
 *
 * Geometría: importada del KMZ "ENCINEÑO - 407 HAS.kmz". 1 polígono · 70
 * vértices · centroide aprox -4.594, 37.781 (campiña suroeste Córdoba ciudad).
 * Área calculada en proyección local: 407.7 ha (vs 407 declarado en nombre KMZ).
 *
 * Cultivo: olivar (`olivo` en CROP_TYPES). Confirmado por JuanCho 10-jun-2026
 * — encaja con dominante de la zona y matchea con el primer advisory REAL
 * del sistema (Prays oleae Córdoba MEDIUM portal RAIF · informe oct 2025).
 *
 * Idempotente: usuario por `email`, parcela por `name + ownerId`. Re-runs
 * actualizan geometría/cropType/areaHa si cambian, pero no duplican.
 *
 * Run en prod (rebuild API requerido para que entre al dist/):
 *   docker compose exec -T api node apps/api/dist/seed/seedEncinenoDemo.js
 */
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Parcel } from "../models/Parcel.js";
import { logger } from "../utils/logger.js";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:6040/fitolink";

const OWNER_EMAIL = "demo-encineno@agrom.es";
const OWNER_NAME = "Fondo Encineño · Demo";
const OWNER_GOOGLE_ID = "demo-encineno-fondo";
const PARCEL_NAME = "Finca Encineño · Sector 407 ha";
const AREA_HA = 407.7;
const CENTER: [number, number] = [-4.594, 37.781];

// Outer ring polígono ENCINEÑO (KMZ cliente · 70 vértices · cerrado).
const RING: [number, number][] = [
  [-4.611886619231964, 37.7781961661152], [-4.613457289299761, 37.77638081254976],
  [-4.614532768808891, 37.77308062273778], [-4.610474198569467, 37.77126024735797],
  [-4.608375417428886, 37.77125113842435], [-4.607689199133869, 37.77144969685201],
  [-4.607909893626829, 37.77235169384014], [-4.607416827674692, 37.77224617550601],
  [-4.607041068121649, 37.77484287752439], [-4.60551390689657, 37.77490939625008],
  [-4.604273983266161, 37.77508813184532], [-4.603030167775797, 37.77511911921445],
  [-4.60186423847669, 37.77530472403671], [-4.59965336760698, 37.77561956950121],
  [-4.597554977263075, 37.77545330079523], [-4.595989314540346, 37.77519089052205],
  [-4.595898148915177, 37.77362916324309], [-4.595824409426832, 37.77329519278007],
  [-4.594836831979451, 37.77306236088329], [-4.593861704734641, 37.77272347931177],
  [-4.591317149612292, 37.77231168225775], [-4.589801820387573, 37.77191855948674],
  [-4.587924720633001, 37.77286536470096], [-4.588367668860178, 37.77337059022095],
  [-4.587440827280563, 37.77337987225982], [-4.586030655993911, 37.77380427600536],
  [-4.582679379073459, 37.77557292294093], [-4.579500204288831, 37.77728576686785],
  [-4.577065732569756, 37.77863278290639], [-4.575898718576084, 37.77968467801961],
  [-4.575548619059678, 37.7806129845196],  [-4.576149213194882, 37.78135615102464],
  [-4.577578477933853, 37.78209656799015], [-4.578851631278493, 37.78353441686129],
  [-4.581534364011445, 37.78267799268797], [-4.585421306232252, 37.78212980829528],
  [-4.586061251593905, 37.78255792748476], [-4.586567967444094, 37.78323242947014],
  [-4.587459351783894, 37.78396900644378], [-4.588143716328629, 37.78443345131249],
  [-4.588986274434664, 37.78492919257217], [-4.589002585838471, 37.78532173830173],
  [-4.587802224561645, 37.78631365768414], [-4.586981785345859, 37.78718397102028],
  [-4.585664653180604, 37.78811050966917], [-4.584571476579374, 37.78906977501214],
  [-4.583635040227351, 37.78984449513172], [-4.583077761658001, 37.790258054759],
  [-4.583310621559582, 37.79077123018747], [-4.583709612312688, 37.79185053770838],
  [-4.584339553973163, 37.79283390861242], [-4.585324689395471, 37.79338899264499],
  [-4.58638153122698,  37.79446612155503], [-4.590144937342751, 37.7918151553268],
  [-4.591984721881617, 37.79094844206044], [-4.593249873986736, 37.7900478327042],
  [-4.593628088860435, 37.78865468576831], [-4.594012521810928, 37.78740519292139],
  [-4.594548541032077, 37.78658637243958], [-4.594849865684037, 37.78561422441363],
  [-4.594765945082939, 37.78494329961643], [-4.594330906205167, 37.78433190152584],
  [-4.594442619500732, 37.78390382329356], [-4.599956874395343, 37.78592898440264],
  [-4.608237661506237, 37.78557969319937], [-4.609177508073278, 37.78393002253234],
  [-4.60930133470201,  37.78246017126024], [-4.609341719026634, 37.78157096593988],
  [-4.610516876800066, 37.77963926673059], [-4.611886619231964, 37.7781961661152],
];

async function seedEncinenoDemo(): Promise<void> {
  await mongoose.connect(MONGODB_URI);
  logger.info("Connected to MongoDB for Encineño demo seed");

  // 1) Upsert User
  let owner = await User.findOne({ email: OWNER_EMAIL });
  if (!owner) {
    owner = await User.create({
      email: OWNER_EMAIL,
      name: OWNER_NAME,
      role: "farmer",
      googleId: OWNER_GOOGLE_ID,
      isVerified: true,
      avatar: "/farmer.svg",
      digestSubscribed: true,
      acceptedTerms: true,
      acceptedTermsAt: new Date(),
      location: { type: "Point", coordinates: CENTER },
    });
    logger.info({ id: owner._id.toString() }, "Created owner user");
  } else {
    logger.info({ id: owner._id.toString() }, "Owner user already exists");
  }

  // 2) Upsert Parcel — refresh geometry/areaHa/cropType on re-run.
  const geometry = { type: "Polygon" as const, coordinates: [RING] };
  const existing = await Parcel.findOne({ name: PARCEL_NAME, ownerId: owner._id });
  if (existing) {
    existing.geometry = geometry;
    existing.areaHa = AREA_HA;
    existing.cropType = "olivo";
    existing.province = "Cordoba";
    await existing.save();
    logger.info({ id: existing._id.toString() }, "Updated parcel");
  } else {
    const parcel = await Parcel.create({
      ownerId: owner._id,
      name: PARCEL_NAME,
      geometry,
      areaHa: AREA_HA,
      cropType: "olivo",
      province: "Cordoba",
      isInsured: false,
      isActive: true,
      isSyntheticDemo: false,
      ndviHistory: [],
    });
    logger.info({ id: parcel._id.toString() }, "Created parcel");
  }

  await mongoose.disconnect();
  logger.info("Encineño demo seed completed");
}

seedEncinenoDemo().catch((err) => {
  logger.error({ err }, "seedEncinenoDemo failed");
  process.exit(1);
});
