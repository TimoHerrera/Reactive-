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
  /** RPE objetivo (1–10). Texto para aceptar rangos: «7», «7-8». */
  rpeTarget: string | null;
  /** Repeticiones en reserva objetivo. Texto: «2», «1-2». */
  rirTarget: string | null;
  /** Se muestra como «Observaciones». */
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

/** Registro real de una serie («¿Cómo te fue?»). Opcional: el check se puede marcar sin registro. */
export interface SetLog {
  sessionId: string;
  itemId: string;
  /** 1, 2, 3… */
  setNumber: number;
  reps: string | null;
  load: string | null;
  /** RPE real, 1 a 10. */
  rpe: number | null;
  /** Comentario del cliente (se guarda en la serie 1). */
  note: string | null;
  createdAt: ISODateTime;
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

// ── Agenda de turnos (F9) ───────────────────────────────────────────

export type AppointmentType = "kinesiologia" | "entrenamiento" | "evaluacion_funcional" | "sport_recovery" | "mep_sport";
export type AppointmentStatus = "agendado" | "reprogramacion_pedida" | "cancelado" | "asistio" | "ausente";

export const APPOINTMENT_TYPE_LABEL: Record<AppointmentType, string> = {
  kinesiologia: "Kinesiología",
  entrenamiento: "Entrenamiento",
  evaluacion_funcional: "Evaluación funcional",
  sport_recovery: "Sport Recovery",
  mep_sport: "MEP Sport",
};

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  agendado: "Agendado",
  reprogramacion_pedida: "Reprogramación pedida",
  cancelado: "Cancelado",
  asistio: "Asistió",
  ausente: "Ausente",
};

export interface Appointment {
  id: string;
  clientId: string;
  /** Profe que atiende el turno. */
  coachId: string;
  startsAt: ISODateTime;
  durationMin: number;
  type: AppointmentType;
  status: AppointmentStatus;
  notes: string | null;
  /** Turnos creados juntos con «Repetir» comparten serie. */
  seriesId: string | null;
  createdBy: string | null;
  createdAt: ISODateTime;
  /** Pedido de reprogramación del paciente. */
  rescheduleReason: string | null;
  reschedulePreference: string | null;
  rescheduleRequestedAt: ISODateTime | null;
}

// ── Pagos (F10) ─────────────────────────────────────────────────────

/** «YYYY-MM» */
export type Period = string;
export type PlanKind = "mensual" | "por_sesion" | "pack";
export type PaymentMethod = "efectivo" | "transferencia" | "mercadopago" | "otro";

export const PLAN_KIND_LABEL: Record<PlanKind, string> = { mensual: "Mensual", por_sesion: "Por sesión", pack: "Pack de sesiones" };
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercadopago: "Mercado Pago",
  otro: "Otro",
};

/** Plan de cobro de un paciente. Montos en centavos (entero). */
export interface ClientPlan {
  clientId: string;
  kind: PlanKind;
  /** Mensual: la cuota. Por sesión: el valor de cada una. Pack: el precio del pack. */
  amountCents: number;
  /** Mensual: día del mes en que vence (1–31; en meses más cortos, el último día). */
  dueDay: number | null;
  /** Pack: cantidad de sesiones. */
  packSessions: number | null;
  startsOn: ISODate;
  active: boolean;
  updatedAt: ISODateTime;
}

export interface Payment {
  id: string;
  clientId: string;
  amountCents: number;
  paidAt: ISODate;
  method: PaymentMethod;
  /** Mensual: mes que cubre. */
  period: Period | null;
  /** Pack / por sesión: cantidad de sesiones que paga. */
  sessions: number | null;
  note: string | null;
  registeredBy: string | null;
  createdAt: ISODateTime;
}

/** Ajustes del centro (solo admin los cambia). */
export interface AppSettings {
  transferAlias: string;
  paymentTemplate: string;
  appointmentTemplate: string;
  /** Si el paciente ve el estado de su cuota en Perfil. */
  showBillingToClient: boolean;
  updatedAt: ISODateTime | null;
}

// ── Avisos del profe (F11) ──────────────────────────────────────────

/** Qué avisos quiere recibir cada profe y cuándo. Cada uno arma los suyos. */
export interface NotificationPrefs {
  /** Cuota mensual por vencer: avisar `dueSoonDays` días antes del vencimiento. */
  dueSoonEnabled: boolean;
  dueSoonDays: number;
  /** Venció y no pagó: avisar a los `overdueAfterDays` días (0 = el mismo día) y repetir cada `overdueRepeatDays` (null = una vez). */
  overdueEnabled: boolean;
  overdueAfterDays: number;
  overdueRepeatDays: number | null;
  /** Pack: avisar cuando queden `packLowSessions` sesiones o menos (0 = cuando se termina). */
  packLowEnabled: boolean;
  packLowSessions: number;
  /** Un paciente pidió reprogramar un turno. */
  rescheduleEnabled: boolean;
  /** Admin: avisos de todo el centro o solo de sus pacientes. Profe: siempre los suyos. */
  scope: "mine" | "all";
  /** Además de la app, un resumen diario por mail con los avisos nuevos. */
  emailEnabled: boolean;
  updatedAt: ISODateTime | null;
}
