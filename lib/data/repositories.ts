import type { AccessRequestInput, SubmitResult } from "@/lib/access/rules";
import type {
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
  coachId?: string | null;
};

export type ProfilePatch = Partial<Omit<Profile, "id" | "createdAt" | "role">>;

export interface ProfilesRepo {
  get(id: string): Promise<Profile | null>;
  listClients(): Promise<Profile[]>;
  listStaff(): Promise<Profile[]>;
  update(id: string, patch: ProfilePatch): Promise<Profile>;
  /** Alta de cliente. En Supabase se hace por server action (invitación por email). */
  createClient(input: NewClientInput): Promise<Profile>;
  /** Alta de profe o admin. Solo admin (server action en Supabase). */
  createStaff(input: { fullName: string; email: string; title?: string | null; role?: "coach" | "admin" }): Promise<Profile>;
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
  /** Staff: todas. Cliente: solo las suyas publicadas (lo hace cumplir RLS en Supabase). */
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
  /** Staff: crea el cliente, lo asigna al profe y manda la invitación. En mock devuelve el link de activación. */
  approve(id: string): Promise<{ profile: Profile; activationLink: string | null }>;
  reject(id: string, reason: string | null): Promise<AccessRequest>;
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
}
