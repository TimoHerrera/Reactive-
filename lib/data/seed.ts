// Datos de demo del diseño. Fuente única para el mock (localStorage) y para supabase/seed.sql
// (scripts/generate-seed-sql.ts). Las fechas son relativas a «hoy» para que la demo no envejezca.
import type {
  AccessRequest,
  CoachNote,
  Exercise,
  ExerciseCategory,
  ExerciseView,
  ItemCheck,
  SetLog,
  Profile,
  Routine,
  RoutineBlock,
  RoutineDay,
  RoutineItem,
  WorkoutSession,
} from "./types";
import { addDays, todayISO } from "@/lib/dates";

/** Contraseña de todos los usuarios de demo (mock y seed.sql). Solo para desarrollo. */
export const DEMO_PASSWORD = "reactive-demo";

/** UUIDs determinísticos para que mock y SQL compartan ids. */
export function seedId(kind: number, n: number): string {
  return `${kind}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

export const IDS = {
  admin: seedId(1, 1),
  nico: seedId(1, 2),
  caro: seedId(1, 3),
  lu: seedId(1, 4),
  martina: seedId(1, 10),
  sofia: seedId(1, 11),
  tomas: seedId(1, 12),
  joaquin: seedId(1, 13),
  valentina: seedId(1, 14),
  lucas: seedId(1, 15),
  camila: seedId(1, 16),
  federico: seedId(1, 17),
  bruno: seedId(1, 18),
};

export interface Db {
  profiles: Profile[];
  coachNotes: CoachNote[];
  exercises: Exercise[];
  routines: Routine[];
  routineDays: RoutineDay[];
  routineBlocks: RoutineBlock[];
  routineItems: RoutineItem[];
  workoutSessions: WorkoutSession[];
  itemChecks: ItemCheck[];
  setLogs: SetLog[];
  exerciseViews: ExerciseView[];
  accessRequests: (AccessRequest & { ipHash?: string | null })[];
  /** Solo mock: invitaciones simuladas (token → usuario). */
  activations: { token: string; userId: string; createdAt: string; usedAt: string | null }[];
  /** Códigos de invitación (hasheados). */
  inviteCodes: { id: string; codeHash: string; email: string; profileId: string; expiresAt: string; usedAt: string | null; createdBy: string | null; createdAt: string }[];
}

// ── Ejercicios ─────────────────────────────────────────────────────

type ExSpec = {
  key: string;
  name: string;
  aliases?: string[];
  category: ExerciseCategory;
  muscles: string[];
  equipment?: string;
  /** Duración en s si tiene video subido. */
  video?: number;
  youtube?: string;
  cues?: string[];
  mistakes?: string[];
};

// Nota: «RDL c/ mancuernas» y «Copenhague» NO son alias a propósito: en el diseño la importación
// los marca como «! Revisar» y, al vincularlos, se guardan como alias nuevos.
const EXERCISES: ExSpec[] = [
  {
    key: "flexores",
    name: "Movilidad de flexores de cadera",
    aliases: ["Estiramiento de psoas"],
    category: "Movilidad",
    muscles: ["Cadera", "Glúteos"],
    equipment: "Peso corporal",
    video: 22,
    cues: ["Rodilla de atrás apoyada en una colchoneta.", "Glúteo apretado y pelvis en retroversión.", "Empujá la cadera hacia adelante sin arquear la lumbar."],
    mistakes: ["Arquear la zona lumbar.", "Llevar el tronco hacia adelante."],
  },
  {
    key: "tobillo-banda",
    name: "Activación de tobillo con banda",
    aliases: ["Eversión con banda"],
    category: "Activación",
    muscles: ["Tobillo", "Gemelos"],
    equipment: "Banda",
    cues: ["Talón fijo en el piso.", "Movimiento lento en las dos direcciones."],
    mistakes: ["Mover la rodilla en vez del pie."],
  },
  {
    key: "goblet",
    name: "Sentadilla goblet",
    aliases: ["Goblet squat", "Sentadilla copa"],
    category: "Fuerza",
    muscles: ["Cuádriceps", "Glúteos", "Core"],
    equipment: "Mancuerna / Kettlebell",
    video: 31,
    cues: [
      "Mancuerna pegada al pecho, codos hacia abajo.",
      "Bajá en 3 segundos, rodillas en la línea de los pies.",
      "Talones apoyados todo el recorrido.",
      "Subí empujando el piso, tronco firme.",
    ],
    mistakes: ["Rodillas que se van hacia adentro.", "Levantar los talones al bajar.", "Rebotar abajo en vez de controlar."],
  },
  {
    key: "rdl",
    name: "Peso muerto rumano",
    aliases: ["RDL", "Romanian deadlift", "Peso muerto piernas semirrígidas"],
    category: "Fuerza",
    muscles: ["Isquiotibiales", "Glúteos"],
    equipment: "Mancuernas",
    video: 28,
    cues: ["Rodillas apenas flexionadas.", "Llevá la cadera hacia atrás con la espalda neutra.", "Mancuernas pegadas a las piernas."],
    mistakes: ["Redondear la espalda.", "Convertirlo en sentadilla."],
  },
  {
    key: "bulgara",
    name: "Estocada búlgara",
    aliases: ["Búlgara", "Split squat búlgaro"],
    category: "Fuerza",
    muscles: ["Cuádriceps", "Glúteos"],
    equipment: "Banco",
    video: 27,
    cues: ["Pie de atrás apoyado en el banco.", "Bajá vertical, tronco apenas inclinado."],
    mistakes: ["Rodilla de adelante hacia adentro.", "Paso demasiado corto."],
  },
  {
    key: "nordic",
    name: "Nordic hamstring",
    aliases: ["Nordic", "Nordic curl", "Curl nórdico"],
    category: "Fuerza",
    muscles: ["Isquiotibiales"],
    equipment: "Banda",
    video: 24,
    cues: ["Tobillos bien sujetos.", "Bajá lo más lento posible con la cadera extendida.", "Usá las manos para frenar abajo."],
    mistakes: ["Flexionar la cadera al bajar.", "Dejarse caer al final."],
  },
  {
    key: "hip-thrust",
    name: "Hip thrust",
    aliases: ["Empuje de cadera"],
    category: "Fuerza",
    muscles: ["Glúteos"],
    equipment: "Barra",
    video: 26,
    cues: ["Escápulas apoyadas en el banco.", "Mentón al pecho.", "Apretá glúteos arriba un segundo."],
    mistakes: ["Hiperextender la lumbar arriba."],
  },
  {
    key: "copenhagen",
    name: "Copenhagen plank",
    aliases: ["Copenhagen", "Plancha Copenhagen"],
    category: "Core",
    muscles: ["Aductores", "Core"],
    equipment: "Banco",
    video: 20,
    cues: ["Pierna de arriba apoyada en el banco.", "Cuerpo en línea recta."],
    mistakes: ["Dejar caer la cadera."],
  },
  {
    key: "pallof",
    name: "Press pallof",
    aliases: ["Pallof press", "Antirrotación con banda"],
    category: "Core",
    muscles: ["Core"],
    equipment: "Banda / Polea",
    video: 19,
    cues: ["Perpendicular al anclaje.", "Extendé los brazos sin rotar el tronco."],
    mistakes: ["Girar hacia la banda."],
  },
  {
    key: "tobillo-pared",
    name: "Movilidad de tobillo en pared",
    aliases: ["Knee to wall"],
    category: "Movilidad",
    muscles: ["Tobillo"],
    cues: ["Rodilla hacia la pared sin despegar el talón."],
  },
  {
    key: "talones",
    name: "Elevación de talones unipodal",
    aliases: ["Gemelos unipodal"],
    category: "Fuerza",
    muscles: ["Gemelos", "Tobillo"],
    equipment: "Escalón",
    video: 18,
    cues: ["Subí en 1 segundo, bajá en 3.", "Rodilla extendida."],
    mistakes: ["Rebotar abajo."],
  },
  {
    key: "unipodal-banco",
    name: "Sentadilla unipodal al banco",
    aliases: ["Box pistol"],
    category: "Fuerza",
    muscles: ["Cuádriceps", "Glúteos"],
    equipment: "Banco",
    video: 25,
    cues: ["Sentate apenas tocando el banco.", "Rodilla alineada con el pie."],
  },
  {
    key: "saltos-laterales",
    name: "Saltos laterales con estabilización",
    aliases: ["Skater"],
    category: "Potencia",
    muscles: ["Cuádriceps", "Tobillo"],
    video: 21,
    cues: ["Caé suave y quedate 2 segundos quieto."],
  },
  {
    key: "desaceleracion",
    name: "Desaceleración en 3 pasos",
    category: "Agilidad",
    muscles: ["Cuádriceps", "Glúteos"],
    equipment: "Conos",
    cues: ["Bajá el centro de gravedad en cada paso."],
  },
  {
    key: "plancha",
    name: "Plancha frontal",
    aliases: ["Plancha", "Plank"],
    category: "Core",
    muscles: ["Core"],
    video: 15,
    cues: ["Codos debajo de los hombros.", "Glúteos apretados."],
    mistakes: ["Cadera muy alta o muy baja."],
  },
  {
    key: "remo-banda",
    name: "Remo con banda",
    aliases: ["Remo elástico"],
    category: "Fuerza",
    muscles: ["Espalda", "Brazos"],
    equipment: "Banda",
    video: 17,
  },
  {
    key: "flexiones",
    name: "Flexiones de brazos",
    aliases: ["Push up", "Lagartijas"],
    category: "Fuerza",
    muscles: ["Pecho", "Brazos", "Core"],
    video: 16,
  },
  {
    key: "curl-nordico-exc",
    name: "Curl nórdico excéntrico",
    category: "Fuerza",
    muscles: ["Isquiotibiales"],
  },
];

const exId = (key: string) => seedId(2, EXERCISES.findIndex((e) => e.key === key) + 1);

// ── Rutinas ───────────────────────────────────────────────────────

/** [ejercicio, series, reps, carga, descanso, tempo, observaciones, RPE objetivo, RIR objetivo] */
type ItemSpec = [string, number, string, string?, string?, string?, string?, string?, string?];
type RoutineSpec = {
  n: number;
  name: string;
  client: string | null;
  template?: boolean;
  start?: number; // días desde hoy
  end?: number;
  message?: string;
  /** Autor (por defecto Nico). */
  by?: string;
  days: { label: string; title: string; blocks: { name: string; items: ItemSpec[] }[] }[];
};

const FASE2_DAYS: RoutineSpec["days"] = [
  {
    label: "A",
    title: "Tren inferior",
    blocks: [
      {
        name: "Entrada en calor",
        items: [
          ["flexores", 2, "45 s c/lado", "Peso corporal", "15 s", undefined, "Glúteo apretado, sin arquear la lumbar."],
          ["tobillo-banda", 3, "15", "Banda media", "30 s"],
        ],
      },
      {
        name: "Bloque principal",
        items: [
          ["goblet", 4, "8", "16 kg", "90 s", "3-1-1", "Rodillas en la línea de los pies.", "7", "3"],
          ["rdl", 4, "8", "2 × 14 kg", "90 s", undefined, undefined, "7-8", "2"],
          ["bulgara", 3, "8 c/lado", "2 × 8 kg", "75 s"],
          ["nordic", 3, "5", "Banda", "2 min"],
        ],
      },
      {
        name: "Accesorios",
        items: [
          ["copenhagen", 3, "20 s c/lado", undefined, "45 s"],
          ["talones", 3, "12 c/lado", "Peso corporal", "45 s"],
        ],
      },
      { name: "Core", items: [["pallof", 3, "10 c/lado", "5 kg", "45 s"]] },
    ],
  },
  {
    label: "B",
    title: "Agilidad + tren sup.",
    blocks: [
      { name: "Entrada en calor", items: [["tobillo-pared", 2, "10 c/lado", undefined, "15 s"]] },
      {
        name: "Bloque principal",
        items: [
          ["saltos-laterales", 4, "6 c/lado", undefined, "90 s", undefined, "Aterrizá suave, rodilla firme."],
          ["desaceleracion", 4, "4", "Conos", "90 s"],
          ["flexiones", 3, "10", "Peso corporal", "60 s"],
          ["remo-banda", 3, "12", "Banda fuerte", "60 s"],
        ],
      },
      { name: "Core", items: [["plancha", 3, "30 s", undefined, "30 s"]] },
    ],
  },
  {
    label: "C",
    title: "Fuerza + estabilidad",
    blocks: [
      { name: "Entrada en calor", items: [["flexores", 2, "45 s c/lado", "Peso corporal", "15 s"]] },
      {
        name: "Bloque principal",
        items: [
          ["unipodal-banco", 3, "6 c/lado", "Peso corporal", "90 s", "3-1-1"],
          ["hip-thrust", 4, "10", "40 kg", "90 s"],
          ["rdl", 3, "8", "2 × 14 kg", "90 s"],
        ],
      },
      {
        name: "Accesorios",
        items: [
          ["talones", 3, "12 c/lado", "Peso corporal", "45 s"],
          ["copenhagen", 3, "20 s c/lado", undefined, "45 s"],
        ],
      },
    ],
  },
];

const simpleDays = (titles: [string, string][], items: ItemSpec[][]): RoutineSpec["days"] =>
  titles.map(([label, title], i) => ({
    label,
    title,
    blocks: [{ name: "Bloque principal", items: items[i] ?? [] }],
  }));

const ROUTINES: RoutineSpec[] = [
  {
    n: 1,
    name: "Readaptación – Fase 2",
    client: IDS.martina,
    start: -12,
    end: 15,
    message: "Si el tobillo molesta en la búlgara, bajá a peso corporal. Calidad > cantidad. ¡Nos vemos el jueves!",
    days: FASE2_DAYS,
  },
  {
    n: 2,
    name: "Readaptación – Fase 1",
    client: IDS.martina,
    start: -40,
    end: -13,
    days: simpleDays(
      [["A", "Movilidad"], ["B", "Fuerza base"], ["C", "Estabilidad"]],
      [
        [["tobillo-pared", 3, "10 c/lado"], ["tobillo-banda", 3, "15", "Banda suave"]],
        [["goblet", 3, "10", "8 kg", "90 s"], ["hip-thrust", 3, "12", "20 kg", "90 s"]],
        [["plancha", 3, "20 s"], ["pallof", 3, "8 c/lado", "3 kg"]],
      ],
    ),
  },
  {
    n: 3,
    name: "LCA – Fase 3",
    client: IDS.sofia,
    start: -20,
    end: 4,
    message: "Seguimos sumando unipodal. Avisame cualquier molestia.",
    days: simpleDays(
      [["A", "Fuerza"], ["B", "Estabilidad"], ["C", "Potencia"]],
      [
        [["unipodal-banco", 3, "6 c/lado"], ["nordic", 3, "4", "Banda"], ["rdl", 3, "8", "2 × 10 kg"]],
        [["copenhagen", 3, "15 s c/lado"], ["pallof", 3, "10 c/lado"]],
        [["saltos-laterales", 3, "5 c/lado"], ["desaceleracion", 3, "4"]],
      ],
    ),
  },
  {
    n: 4,
    name: "Pretemporada rugby",
    client: IDS.tomas,
    start: -5,
    end: 22,
    days: simpleDays(
      [["A", "Fuerza inferior"], ["B", "Fuerza superior"], ["C", "Potencia"], ["D", "Acondicionamiento"]],
      [
        [["goblet", 4, "6", "32 kg"], ["rdl", 4, "6", "2 × 26 kg"], ["bulgara", 3, "8 c/lado", "2 × 16 kg"], ["nordic", 3, "6"]],
        [["flexiones", 4, "15"], ["remo-banda", 4, "12"], ["plancha", 3, "45 s"], ["pallof", 3, "12 c/lado", "10 kg"]],
        [["saltos-laterales", 4, "6 c/lado"], ["hip-thrust", 4, "8", "80 kg"]],
        [["desaceleracion", 6, "4"], ["copenhagen", 3, "30 s c/lado"]],
      ],
    ),
  },
  {
    n: 5,
    name: "Control lumbar",
    client: IDS.joaquin,
    start: -8,
    end: 20,
    days: simpleDays(
      [["A", "Core y movilidad"], ["B", "Fuerza"]],
      [
        [["plancha", 3, "20 s"], ["pallof", 3, "10 c/lado"], ["flexores", 2, "45 s c/lado"]],
        [["hip-thrust", 3, "12", "20 kg"], ["nordic", 3, "4", "Banda"], ["rdl", 3, "10", "2 × 8 kg"]],
      ],
    ),
  },
  {
    n: 6,
    name: "Hombro estable",
    client: IDS.valentina,
    start: -23,
    end: 5,
    days: simpleDays(
      [["A", "Estabilidad"], ["B", "Fuerza"]],
      [
        [["remo-banda", 3, "15", "Banda suave"], ["plancha", 3, "20 s"]],
        [["flexiones", 3, "8"], ["pallof", 3, "10 c/lado"]],
      ],
    ),
  },
  {
    n: 7,
    name: "Movilidad cervical",
    client: IDS.federico,
    start: -3,
    end: 25,
    days: simpleDays(
      [["A", "Movilidad"], ["B", "Fuerza"]],
      [
        [["remo-banda", 3, "12"], ["flexores", 2, "45 s c/lado"]],
        [["plancha", 3, "30 s"], ["pallof", 3, "10 c/lado"]],
      ],
    ),
  },
  {
    n: 10,
    name: "Fuerza general",
    client: IDS.bruno,
    by: IDS.caro,
    start: -5,
    end: 23,
    message: "Arrancamos tranqui: técnica primero, después sumamos carga.",
    days: simpleDays(
      [["A", "Tren inferior"], ["B", "Tren superior"]],
      [
        [["goblet", 3, "10", "12 kg"], ["hip-thrust", 3, "12", "30 kg"]],
        [["flexiones", 3, "8"], ["remo-banda", 3, "12"]],
      ],
    ),
  },
  {
    n: 8,
    name: "Readaptación tobillo – Fase 2",
    client: null,
    template: true,
    days: FASE2_DAYS,
  },
  {
    n: 9,
    name: "Pretemporada base",
    client: null,
    template: true,
    days: simpleDays(
      [["A", "Fuerza"], ["B", "Potencia"]],
      [
        [["goblet", 4, "8"], ["rdl", 4, "8"]],
        [["saltos-laterales", 4, "5 c/lado"], ["desaceleracion", 4, "4"]],
      ],
    ),
  },
];

// ── Constructor ───────────────────────────────────────────────────

export function buildSeed(today: string = todayISO(), now: Date = new Date()): Db {
  const ts = (days: number, hoursAgo = 0) => {
    const d = new Date(now.getTime() - hoursAgo * 3_600_000);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };
  const created = ts(-60);

  const client = (
    id: string,
    fullName: string,
    email: string,
    p: Partial<Profile>,
  ): Profile => ({
    id,
    role: "client",
    fullName,
    email,
    phone: null,
    title: null,
    sport: null,
    caseType: null,
    caseDetail: null,
    goal: null,
    coachId: IDS.nico,
    clientSince: addDays(today, -70),
    createdAt: created,
    bio: null,
    avatarPath: null,
    activatedAt: created,
    disabledAt: null,
    ...p,
  });

  const profiles: Profile[] = [
    {
      id: IDS.admin,
      role: "admin",
      fullName: "Admin Reactive",
      email: "admin@reactive.test",
      phone: null,
      title: "Administración",
      sport: null,
      caseType: null,
      caseDetail: null,
      goal: null,
      coachId: null,
      clientSince: null,
      createdAt: created,
      bio: null,
      avatarPath: null,
      activatedAt: created,
      disabledAt: null,
    },
    {
      id: IDS.nico,
      role: "coach",
      fullName: "Nico R.",
      email: "nico@reactive.test",
      phone: "+54 9 11 5555-0102",
      title: "Kinesiólogo deportivo",
      sport: null,
      caseType: null,
      caseDetail: null,
      goal: null,
      coachId: null,
      clientSince: null,
      createdAt: created,
      bio: "Kinesiólogo deportivo. Readaptación de lesiones de tobillo y rodilla y vuelta al deporte.",
      avatarPath: null,
      activatedAt: created,
      disabledAt: null,
    },
    {
      id: IDS.caro,
      role: "coach",
      fullName: "Caro P.",
      email: "caro@reactive.test",
      phone: "+54 9 11 5555-0103",
      title: "Profesora de educación física",
      sport: null,
      caseType: null,
      caseDetail: null,
      goal: null,
      coachId: null,
      clientSince: null,
      createdAt: created,
      bio: "Entrenamiento de fuerza y prevención de lesiones en deportistas amateurs.",
      avatarPath: null,
      activatedAt: created,
      disabledAt: null,
    },
    {
      // Invitación pendiente (todavía no creó su contraseña).
      id: IDS.lu,
      role: "coach",
      fullName: "Lu M.",
      email: "lu@reactive.test",
      phone: null,
      title: "Kinesióloga",
      sport: null,
      caseType: null,
      caseDetail: null,
      goal: null,
      coachId: null,
      clientSince: null,
      createdAt: ts(-1),
      bio: null,
      avatarPath: null,
      activatedAt: null,
      disabledAt: null,
    },
    client(IDS.martina, "Martina G.", "martina@reactive.test", {
      phone: "+54 9 11 5555-0101",
      sport: "Fútbol 11",
      caseType: "lesion_deportiva",
      caseDetail: "Tobillo",
      goal: "Volver a jugar al fútbol post-esguince de tobillo",
      clientSince: addDays(today, -71),
    }),
    client(IDS.sofia, "Sofía R.", "sofia@reactive.test", {
      sport: "Handball",
      caseType: "postquirurgico",
      caseDetail: "LCA Fase 3",
      goal: "Volver a competir después de la cirugía de LCA",
    }),
    client(IDS.tomas, "Tomás L.", "tomas@reactive.test", {
      sport: "Rugby",
      caseType: "rendimiento",
      caseDetail: "Pretemporada rugby",
      goal: "Llegar al inicio del torneo en su mejor forma",
    }),
    client(IDS.joaquin, "Joaquín M.", "joaquin@reactive.test", {
      sport: "Running",
      caseType: "dolor_cronico",
      caseDetail: "Lumbalgia",
      goal: "Correr sin dolor lumbar",
    }),
    client(IDS.valentina, "Valentina P.", "valentina@reactive.test", {
      sport: "Vóley",
      caseType: "lesion_deportiva",
      caseDetail: "Hombro",
      goal: "Recuperar el remate sin dolor",
    }),
    client(IDS.lucas, "Lucas B.", "lucas@reactive.test", {
      sport: "Tenis",
      caseType: "rendimiento",
      caseDetail: "Evaluación pendiente",
      goal: "Mejorar la velocidad en cancha",
      clientSince: addDays(today, -6),
    }),
    client(IDS.camila, "Camila F.", "camila@reactive.test", {
      sport: "Hockey",
      caseType: "postquirurgico",
      caseDetail: "Menisco",
      goal: "Volver a entrenar con el equipo",
      clientSince: addDays(today, -10),
    }),
    client(IDS.federico, "Federico A.", "federico@reactive.test", {
      sport: "Natación",
      caseType: "dolor_cronico",
      caseDetail: "Cervical",
      goal: "Nadar sin dolor de cuello",
    }),
    // Cliente de Caro: Nico no la ve.
    client(IDS.bruno, "Bruno S.", "bruno@reactive.test", {
      coachId: IDS.caro,
      sport: "Pádel",
      caseType: "rendimiento",
      caseDetail: "Fuerza general",
      goal: "Ganar fuerza para jugar sin molestias",
      clientSince: addDays(today, -20),
    }),
  ];

  const coachNotes: CoachNote[] = [
    {
      id: seedId(8, 1),
      clientId: IDS.martina,
      authorId: IDS.nico,
      body: "Esguince de tobillo derecho (julio). Buen control en apoyo bipodal; falta control excéntrico en cambios de dirección. Fase 2: sumar desaceleraciones y unipodal.",
      createdAt: ts(-12),
    },
  ];

  const exercises: Exercise[] = EXERCISES.map((e, i) => ({
    id: seedId(2, i + 1),
    name: e.name,
    aliases: e.aliases ?? [],
    category: e.category,
    muscleGroups: e.muscles,
    equipment: e.equipment ?? null,
    videoPath: e.video ? `seed/${e.key}.mp4` : null,
    videoPosterPath: null,
    videoDurationS: e.video ?? null,
    youtubeUrl: e.youtube ?? null,
    techniqueCues: e.cues ?? [],
    commonMistakes: e.mistakes ?? [],
    createdBy: IDS.nico,
    createdAt: created,
    updatedAt: created,
  }));

  const routines: Routine[] = [];
  const routineDays: RoutineDay[] = [];
  const routineBlocks: RoutineBlock[] = [];
  const routineItems: RoutineItem[] = [];
  let dayN = 0;
  let blockN = 0;
  let itemN = 0;

  for (const r of ROUTINES) {
    const routineId = seedId(3, r.n);
    routines.push({
      id: routineId,
      name: r.name,
      clientId: r.client,
      isTemplate: !!r.template,
      sourceTemplateId: null,
      startsOn: r.start !== undefined ? addDays(today, r.start) : null,
      endsOn: r.end !== undefined ? addDays(today, r.end) : null,
      daysPerWeek: r.days.length,
      clientMessage: r.message ?? null,
      createdBy: r.by ?? IDS.nico,
      updatedBy: null,
      updatedAt: null,
      publishedAt: r.template ? null : ts((r.start ?? 0) - 1),
      createdAt: ts((r.start ?? -30) - 1),
    });
    r.days.forEach((d, di) => {
      const dayId = seedId(4, ++dayN);
      routineDays.push({ id: dayId, routineId, label: d.label, title: d.title, position: di });
      d.blocks.forEach((b, bi) => {
        const blockId = seedId(5, ++blockN);
        routineBlocks.push({ id: blockId, dayId, name: b.name, position: bi });
        b.items.forEach(([key, sets, reps, load, rest, tempo, notes, rpeTarget, rirTarget], ii) => {
          const ex = EXERCISES.find((e) => e.key === key)!;
          routineItems.push({
            id: seedId(6, ++itemN),
            blockId,
            exerciseId: exId(key),
            rawName: ex.name,
            position: ii,
            sets,
            reps,
            load: load ?? null,
            rest: rest ?? null,
            tempo: tempo ?? null,
            rpeTarget: rpeTarget ?? null,
            rirTarget: rirTarget ?? null,
            notes: notes ?? null,
          });
        });
      });
    });
  }

  // ── Actividad (Panel: completadas, parciales, vistas repetidas) ──
  const dayOf = (routineN: number, label: string) =>
    routineDays.find((d) => d.routineId === seedId(3, routineN) && d.label === label)!;
  const itemsOfDay = (dayId: string) => {
    const blocks = routineBlocks.filter((b) => b.dayId === dayId).sort((a, b) => a.position - b.position);
    return blocks.flatMap((b) => routineItems.filter((i) => i.blockId === b.id).sort((a, c) => a.position - c.position));
  };

  const workoutSessions: WorkoutSession[] = [];
  const itemChecks: ItemCheck[] = [];
  let sessionN = 0;
  const addSession = (clientId: string, routineN: number, label: string, days: number, hoursAgo: number, checked: number | "all") => {
    const day = dayOf(routineN, label);
    const items = itemsOfDay(day.id);
    const n = checked === "all" ? items.length : checked;
    const id = seedId(7, ++sessionN);
    workoutSessions.push({
      id,
      clientId,
      routineId: seedId(3, routineN),
      dayId: day.id,
      startedAt: ts(days, hoursAgo + 1),
      completedAt: n === items.length ? ts(days, hoursAgo) : null,
    });
    items.slice(0, n).forEach((it) => itemChecks.push({ sessionId: id, itemId: it.id, checkedAt: ts(days, hoursAgo) }));
  };

  addSession(IDS.martina, 1, "C", -3, 0, "all");
  addSession(IDS.martina, 1, "A", 0, 2, "all");
  addSession(IDS.martina, 1, "B", -5, 0, "all");
  addSession(IDS.tomas, 4, "B", 0, 4, 3);
  addSession(IDS.joaquin, 5, "A", -2, 0, "all");

  // Registro real («¿Cómo te fue?») de Martina hoy en el Día A: la goblet le costó más de lo planificado.
  const martinaHoy = workoutSessions.find((w) => w.clientId === IDS.martina && w.dayId === dayOf(1, "A").id)!;
  const itemOf = (key: string) => itemsOfDay(martinaHoy.dayId).find((i) => i.exerciseId === exId(key))!;
  const setLogs: SetLog[] = [];
  const logSets = (key: string, load: string, rpes: number[], note?: string) => {
    const it = itemOf(key);
    rpes.forEach((rpe, i) =>
      setLogs.push({ sessionId: martinaHoy.id, itemId: it.id, setNumber: i + 1, reps: it.reps, load, rpe, note: i === 0 ? (note ?? null) : null, createdAt: ts(0, 2) }),
    );
  };
  logSets("goblet", "16 kg", [7, 8, 8, 9], "La última serie me costó mucho, sentí el tobillo.");
  logSets("rdl", "2 × 14 kg", [7, 7, 8, 8]);

  const exerciseViews: ExerciseView[] = [0, 1, 2].map((i) => ({
    clientId: IDS.joaquin,
    exerciseId: exId("nordic"),
    viewedAt: ts(-1, 3 - i),
  }));

  const accessRequests: AccessRequest[] = [
    {
      id: seedId(9, 1),
      fullName: "Paula D.",
      email: "paula@reactive.test",
      phone: "+54 9 11 5555-0120",
      requestedCoachId: IDS.nico,
      caseType: "lesion_deportiva",
      message: "Me esguincé la rodilla jugando al vóley. Me recomendó una amiga.",
      status: "pending",
      createdAt: ts(0, 5),
      reviewedBy: null,
      reviewedAt: null,
      rejectReason: null,
      linkedProfileId: null,
    },
    {
      id: seedId(9, 2),
      fullName: "Diego S.",
      email: "diego@reactive.test",
      phone: "+54 9 11 5555-0121",
      requestedCoachId: null,
      caseType: "rendimiento",
      message: null,
      status: "pending",
      createdAt: ts(-1, 2),
      reviewedBy: null,
      reviewedAt: null,
      rejectReason: null,
      linkedProfileId: null,
    },
  ];

  return {
    profiles,
    coachNotes,
    exercises,
    routines,
    routineDays,
    routineBlocks,
    routineItems,
    workoutSessions,
    itemChecks,
    setLogs,
    exerciseViews,
    accessRequests,
    activations: [],
    inviteCodes: [],
  };
}
