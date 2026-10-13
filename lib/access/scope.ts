// Quién ve y edita qué. Puro y testeable: lo usa el mock y es el espejo de RLS (0007_coach_scope.sql).
//
// - Profe: solo sus clientes (coach_id = él) y todo lo que cuelga de ellos (rutinas, sesiones, vistas,
//   observaciones) y las solicitudes de acceso que lo eligieron.
// - Compartido entre profes: ejercicios/videos y plantillas (editar o borrar una plantilla: su autor o el admin).
// - Admin: todo. Es el único que reasigna clientes y el que recibe las solicitudes sin profe elegido.
// - Cliente: lo suyo (rutinas publicadas, sesiones, vistas). Nunca las observaciones.
import type { AccessRequest, Profile, Role, Routine } from "@/lib/data/types";

export type Viewer = { id: string; role: Role } | null;
type ClientRef = Pick<Profile, "id" | "role" | "coachId">;
type RoutineRef = Pick<Routine, "clientId" | "isTemplate" | "createdBy" | "publishedAt">;

const isAdmin = (v: Viewer): v is { id: string; role: "admin" } => v?.role === "admin";
const isCoach = (v: Viewer): v is { id: string; role: "coach" } => v?.role === "coach";

/** ¿Puede ver (y, si es staff, editar) a este cliente y sus datos? */
export function canSeeClient(v: Viewer, client: ClientRef | null | undefined): boolean {
  if (!v || !client || client.role !== "client") return false;
  if (isAdmin(v)) return true;
  if (isCoach(v)) return client.coachId === v.id;
  return client.id === v.id;
}

/** Perfil cualquiera: los de staff son públicos para los logueados (nombre, título, foto del profe). */
export function canSeeProfile(v: Viewer, p: Profile | null | undefined): boolean {
  if (!v || !p) return false;
  if (p.id === v.id || p.role !== "client") return true;
  return canSeeClient(v, p);
}

export function canSeeRoutine(v: Viewer, r: RoutineRef, owner: ClientRef | null | undefined): boolean {
  if (!v) return false;
  if (v.role === "client") return r.clientId === v.id && !!r.publishedAt;
  if (isAdmin(v)) return true;
  if (r.isTemplate) return true; // plantillas: compartidas
  if (!r.clientId) return r.createdBy === v.id; // borrador sin cliente
  return canSeeClient(v, owner);
}

export function canEditRoutine(v: Viewer, r: RoutineRef, owner: ClientRef | null | undefined): boolean {
  if (!v || v.role === "client") return false;
  if (isAdmin(v)) return true;
  if (r.isTemplate || !r.clientId) return r.createdBy === v.id;
  return canSeeClient(v, owner);
}

export function canSeeAccessRequest(v: Viewer, r: Pick<AccessRequest, "requestedCoachId">): boolean {
  if (isAdmin(v)) return true;
  if (isCoach(v)) return r.requestedCoachId === v.id;
  return false;
}

/** Al crear un cliente: el profe se lo asigna a sí mismo; el admin elige (o queda para él). */
export function coachForNewClient(v: Viewer, requested: string | null | undefined): string | null {
  if (isAdmin(v)) return requested || v.id;
  if (isCoach(v)) return v.id;
  return null;
}

/** Reasignar un cliente a otro profe: solo admin. */
export function canReassignClient(v: Viewer): boolean {
  return isAdmin(v);
}

/** «Cargada por X · editada por Y» (si la editó otra persona). */
export function authorLine(createdBy: string | null, updatedBy: string | null, nameOf: (id: string) => string | null): string | null {
  const author = createdBy ? nameOf(createdBy) : null;
  const editor = updatedBy && updatedBy !== createdBy ? nameOf(updatedBy) : null;
  if (!author && !editor) return null;
  if (!author) return `Editada por ${editor}`;
  return editor ? `Cargada por ${author} · editada por ${editor}` : `Cargada por ${author}`;
}

/**
 * Filtro del admin «Profe: X»: ids de los clientes de ese profe (null = sin filtro).
 * Las rutinas de cliente, sesiones y vistas se filtran por estos ids; las plantillas, por autor.
 */
export function clientIdsOfCoach(clients: Pick<Profile, "id" | "coachId">[], coachId: string | null): Set<string> | null {
  if (!coachId) return null;
  return new Set(clients.filter((c) => c.coachId === coachId).map((c) => c.id));
}

export function routineMatchesCoach(r: Pick<Routine, "clientId" | "createdBy">, ids: Set<string> | null, coachId: string | null): boolean {
  if (!ids) return true;
  return r.clientId ? ids.has(r.clientId) : r.createdBy === coachId;
}
