// Tipos de dominio. Espejan las tablas de supabase/migrations (snake_case → camelCase).

export type Role = "admin" | "coach" | "client";
export type CaseType = "lesion_deportiva" | "postquirurgico" | "dolor_cronico" | "rendimiento";
export type ExerciseCategory = "Fuerza" | "Activación" | "Movilidad" | "Potencia" | "Agilidad" | "Core";

export const CASE_TYPE_LABEL: Record<CaseType, string> = {
  lesion_deportiva: "Lesión deportiva",
  postquirurgico: "Postquirúrgico",
  dolor_cronico: "Dolor crónico",
  rendimiento: "Rendimiento",
};

export const EXERCISE_CATEGORIES: ExerciseCategory[] = ["Fuerza", "Activación", "Movilidad", "Potencia", "Agilidad", "Core"];

export const MUSCLE_GROUPS = [
  "Cuádriceps",
  "Isquiotibiales",
  "Glúteos",
  "Aductores",
  "Gemelos",
  "Tobillo",
  "Cadera",
  "Core",
  "Espalda",
  "Pecho",
  "Hombros",
  "Brazos",
  "Cervical",
] as const;

export const BLOCK_NAMES = ["Entrada en calor", "Bloque principal", "Accesorios", "Core", "Movilidad"] as const;

/** ISO date "YYYY-MM-DD" */
export type ISODate = string;
/** ISO timestamp */
export type ISODateTime = string;

export interface Profile {
  id: string;
  role: Role;
  fullName: string;
  email: string;
  phone: string | null;
  /** Profes: «Kinesiólogo deportivo». */
  title: string | null;
  sport: string | null;
  caseType: CaseType | null;
  /** Detalle corto del caso: «LCA Fase 3», «Lumbalgia». */
  caseDetail: string | null;
  goal: string | null;
  coachId: string | null;
  clientSince: ISODate | null;
  createdAt: ISODateTime;
  /** Bio corta (profes: la ve el cliente en «Tu profe → Ver perfil»). */
  bio: string | null;
  /** Foto (path en Storage). Sin foto se muestran las iniciales. */
  avatarPath: string | null;
  /** Cuándo creó su contraseña. null = invitación pendiente. */
  activatedAt: ISODateTime | null;
  /** Desactivado: pierde el acceso al instante; su historial queda. */
  disabledAt: ISODateTime | null;
}

export type AccountStatus = "activo" | "pendiente" | "desactivado";

export function accountStatus(p: Pick<Profile, "activatedAt" | "disabledAt">): AccountStatus {
  if (p.disabledAt) return "desactivado";
  return p.activatedAt ? "activo" : "pendiente";
}

export interface CoachNote {
  id: string;
  clientId: string;
  /** null si el autor ya no existe (profe eliminado). */
  authorId: string | null;
  body: string;
  createdAt: ISODateTime;
}

export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  category: ExerciseCategory;
  muscleGroups: string[];
  equipment: string | null;
  /** Video principal subido al bucket `exercise-videos`. */
  videoPath: string | null;
  videoPosterPath: string | null;
  videoDurationS: number | null;
  /** Link complementario opcional. */
  youtubeUrl: string | null;
  techniqueCues: string[];
  commonMistakes: string[];
  createdBy: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Routine {
  id: string;
  name: string;
  clientId: string | null;
  isTemplate: boolean;
  sourceTemplateId: string | null;
  startsOn: ISODate | null;
  endsOn: ISODate | null;
  daysPerWeek: number;
  /** Sale como «Nota del profe» en Hoy. */
  clientMessage: string | null;
  /** Quién la cargó: siempre el usuario logueado al crearla (lo fija el servidor, no el formulario). */
  createdBy: string | null;
  /** Última edición (otro profe o el admin): «Cargada por X · editada por Y». */
  updatedBy: string | null;
  updatedAt: ISODateTime | null;
  publishedAt: ISODateTime | null;
  createdAt: ISODateTime;
}

export interface RoutineDay {
  id: string;
  routineId: string;
  label: string; // A, B, C…
  title: string; // Tren inferior
  position: number;
}

export interface RoutineBlock {
  id: string;
  dayId: string;
  name: string;
  position: number;
}

export interface RoutineItem {
  id: string;
  blockId: string;
  exerciseId: string | null;
  /** Nombre tal como vino (Excel o carga manual). */
  rawName: string;
  position: number;
  sets: number | null;
  reps: string | null;
  load: string | null;
  rest: string | null;
  tempo: string | null;
  notes: string | null;
}

export interface WorkoutSession {
  id: string;
  clientId: string;
  routineId: string;
  dayId: string;
  startedAt: ISODateTime;
  completedAt: ISODateTime | null;
}

export interface ItemCheck {
  sessionId: string;
  itemId: string;
  checkedAt: ISODateTime;
}

export interface ExerciseView {
  clientId: string;
  exerciseId: string;
  viewedAt: ISODateTime;
}

// ── Agregados ──────────────────────────────────────────────────────

export interface BlockTree extends RoutineBlock {
  items: RoutineItem[];
}
export interface DayTree extends RoutineDay {
  blocks: BlockTree[];
}
export interface RoutineTree extends Routine {
  days: DayTree[];
}

export interface SessionUser {
  id: string;
  role: Role;
  fullName: string;
  email: string;
}

export function isStaff(role: Role | null | undefined): boolean {
  return role === "coach" || role === "admin";
}

/** «Con video» = tiene archivo subido o link de YouTube. */
export function hasVideo(e: Pick<Exercise, "videoPath" | "youtubeUrl"> | null | undefined): boolean {
  return !!e && (!!e.videoPath || !!e.youtubeUrl);
}

// ── Solicitudes de acceso («¿Primera vez?») ─────────────────────────

export type AccessRequestStatus = "pending" | "approved" | "rejected";

export interface AccessRequest {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  /** Profe elegido; null = «Todavía no tengo». */
  requestedCoachId: string | null;
  caseType: CaseType | null;
  message: string | null;
  status: AccessRequestStatus;
  createdAt: ISODateTime;
  reviewedBy: string | null;
  reviewedAt: ISODateTime | null;
  rejectReason: string | null;
  /** Si el email ya tenía cuenta, la solicitud se vincula a ese usuario en vez de crear otro. */
  linkedProfileId: string | null;
}

/** Profe que se puede elegir en el formulario público (solo datos públicos). */
export type PublicCoach = { id: string; fullName: string; title: string | null };
