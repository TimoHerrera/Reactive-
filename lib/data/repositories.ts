import type { AccessRequestInput, SubmitResult } from "@/lib/access/rules";
import type {
  AccountStatus,
  AccessRequest,
  AccessRequestStatus,
  CoachNote,
  Exercise,
  ExerciseView,
  ItemCheck,
  Profile,
  PublicCoach,
  Routine,
  RoutineTree,
  SessionUser,
  WorkoutSession,
} from "./types";

// Contrato de la capa de datos. Las pantallas solo conocen estas interfaces;
// hay una implementación mock (localStorage) y otra Supabase.

export type NewClientInput = {
  fullName: string;
  email: string;
  phone?: string | null;
  sport?: string | null;
  caseType?: Profile["caseType"];
  caseDetail?: string | null;
  goal?: string | null;
  /** Solo lo usa el admin (elige el profe). Si lo crea un profe, queda asignado a él. */
  coachId?: string | null;
};

/** Datos editables de un perfil. Rol y estado (activación/desactivación) NO: van por `team`. */
export type ProfilePatch = Partial<Omit<Profile, "id" | "createdAt" | "role" | "activatedAt" | "disabledAt">>;

export interface ProfilesRepo {
  get(id: string): Promise<Profile | null>;
  listClients(): Promise<Profile[]>;
  listStaff(): Promise<Profile[]>;
  update(id: string, patch: ProfilePatch): Promise<Profile>;
  /**
   * Alta de cliente. En Supabase se hace por server action (invitación por email).
   * Email repetido (sin importar mayúsculas) → `DuplicateEmailError` (lib/data/errors.ts).
   */
  createClient(input: NewClientInput): Promise<Profile>;
  /**
   * Desactivar / reactivar un cliente (admin o su profe). Desactivado: no entra, se oculta de las listas,
   * el historial queda y el email sigue reservado. Para profes: `team.deactivate`.
   */
  setClientActive(id: string, active: boolean): Promise<Profile>;
  /**
   * Eliminar definitivamente. Admin: a cualquiera menos a sí mismo. Profe: solo a sus propios clientes
   * (los de otros profes dan «no encontrado»). `confirmName` tiene que coincidir con el nombre.
   * Cliente: borra cuenta, perfil, rutinas, sesiones, observaciones y solicitudes.
   * Profe: exige `reassignTo` si tiene clientes; sus ejercicios y plantillas pasan al admin.
   * Después el email queda libre.
   */
  remove(id: string, opts: { confirmName: string; reassignTo?: string | null }): Promise<void>;
}

export interface CoachNotesRepo {
  listForClient(clientId: string): Promise<CoachNote[]>;
  add(clientId: string, body: string): Promise<CoachNote>;
}

export type ExerciseInput = Omit<Exercise, "id" | "createdAt" | "updatedAt" | "createdBy">;

export interface ExercisesRepo {
  list(): Promise<Exercise[]>;
  get(id: string): Promise<Exercise | null>;
  create(input: ExerciseInput): Promise<Exercise>;
  update(id: string, patch: Partial<ExerciseInput>): Promise<Exercise>;
  remove(id: string): Promise<void>;
  /** Agrega un alias si no existe (vincular desde la importación). */
  addAlias(id: string, alias: string): Promise<Exercise>;
}

export interface RoutinesRepo {
  /**
   * Admin: todas. Profe: las de sus clientes, sus borradores y todas las plantillas.
   * Cliente: solo las suyas publicadas. (RLS en Supabase, lib/access/scope.ts en mock.)
   */
  list(): Promise<Routine[]>;
  listForClient(clientId: string): Promise<Routine[]>;
  getTree(id: string): Promise<RoutineTree | null>;
  /** Crea o reemplaza la rutina completa (días, bloques e ítems). */
  saveTree(tree: RoutineTree): Promise<RoutineTree>;
  publish(id: string): Promise<Routine>;
  /** Cambios simples sin tocar el árbol (ej. acortar la vigencia de la rutina que se reemplaza). */
  update(id: string, patch: Partial<Pick<Routine, "name" | "startsOn" | "endsOn" | "clientMessage">>): Promise<Routine>;
  /** Cantidad de ejercicios por rutina (para las listas). */
  itemCounts(): Promise<Record<string, number>>;
  remove(id: string): Promise<void>;
}

export interface SessionsRepo {
  list(filter?: { clientId?: string; routineId?: string; since?: string }): Promise<WorkoutSession[]>;
  start(input: { clientId: string; routineId: string; dayId: string }): Promise<WorkoutSession>;
  complete(sessionId: string, completed: boolean): Promise<WorkoutSession>;
  listChecks(sessionIds: string[]): Promise<ItemCheck[]>;
  setCheck(sessionId: string, itemId: string, checked: boolean): Promise<void>;
}

export interface ViewsRepo {
  record(clientId: string, exerciseId: string): Promise<void>;
  list(filter?: { clientId?: string; since?: string }): Promise<ExerciseView[]>;
}

export type UploadProgress = (fraction: number) => void;

export interface VideosRepo {
  /** Sube un archivo (video o miniatura) y devuelve el path dentro del bucket. */
  upload(file: Blob, opts: { name: string; onProgress?: UploadProgress; signal?: AbortSignal }): Promise<string>;
  /** URL reproducible (firmada y de vencimiento corto en Supabase). */
  getUrl(path: string): Promise<string | null>;
  remove(path: string): Promise<void>;
}

export interface AccessRequestsRepo {
  /** Profes activos para el formulario público (sin sesión). */
  listCoaches(): Promise<PublicCoach[]>;
  /** Pedido público («¿Primera vez?»): valida, chequea duplicados, honeypot y límite. */
  submit(input: AccessRequestInput): Promise<SubmitResult>;
  /** Staff: solicitudes (por defecto, pendientes). */
  list(status?: AccessRequestStatus): Promise<AccessRequest[]>;
  /**
   * Profe/admin: crea el cliente y manda la invitación. En mock devuelve el link de activación.
   * El profe se lo queda; el admin puede elegir a qué profe asignarlo (`coachId`).
   * Si el email ya tiene cuenta → `DuplicateEmailError`; con `linkExisting` la solicitud se vincula a esa
   * cuenta (no se crea otra). `profile` es null si quien aprueba no puede ver esa cuenta.
   */
  approve(
    id: string,
    opts?: { coachId?: string | null; linkExisting?: boolean },
  ): Promise<{ profile: Profile | null; activationLink: string | null; linked: boolean }>;
  reject(id: string, reason: string | null): Promise<AccessRequest>;
}

export type StaffMember = Profile & { status: AccountStatus; clientCount: number };

export type InviteStaffInput = {
  fullName: string;
  email: string;
  title?: string | null;
  phone?: string | null;
  role: "coach" | "admin";
};

/** Equipo (profes y admins). Todo es solo para admin; RLS y los server actions lo hacen cumplir. */
export interface TeamRepo {
  list(): Promise<StaffMember[]>;
  /** Alta + invitación por mail (lleva a /activar). En mock devuelve el link. */
  invite(input: InviteStaffInput): Promise<{ profile: Profile; activationLink: string | null }>;
  resend(profileId: string): Promise<{ activationLink: string | null }>;
  /** Código de un solo uso, atado al email, vence en 48 h. Se muestra una sola vez. */
  createCode(profileId: string): Promise<{ code: string; expiresAt: string }>;
  setRole(profileId: string, role: "coach" | "admin"): Promise<Profile>;
  /** Pierde el acceso al instante. Si tiene clientes, hay que pasar a quién se reasignan. */
  deactivate(profileId: string, reassignTo: string | null): Promise<void>;
  reactivate(profileId: string): Promise<void>;
}

export type SignInResult = { ok: true; user: SessionUser } | { ok: false; error: string };

export interface AuthRepo {
  getUser(): Promise<SessionUser | null>;
  signIn(email: string, password: string): Promise<SignInResult>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  /**
   * /activar: deja lista la sesión del usuario invitado.
   * Supabase: la sesión ya viene del link (/auth/callback). Mock: valida el token simulado.
   */
  activate(token: string | null): Promise<SessionUser | null>;
  /** /activar con código (cuando el mail no llega): crea la contraseña y deja la sesión iniciada. */
  redeemCode(email: string, code: string, password: string): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }>;
}

export interface DataSource {
  kind: "mock" | "supabase";
  auth: AuthRepo;
  profiles: ProfilesRepo;
  coachNotes: CoachNotesRepo;
  exercises: ExercisesRepo;
  routines: RoutinesRepo;
  sessions: SessionsRepo;
  views: ViewsRepo;
  videos: VideosRepo;
  accessRequests: AccessRequestsRepo;
  team: TeamRepo;
}
