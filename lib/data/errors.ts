// Errores con datos que la UI necesita (no solo un texto).
import { canSeeClient, type Viewer } from "@/lib/access/scope";
import type { Profile } from "./types";

export const DUPLICATE_EMAIL_MESSAGE = "Ya existe un usuario con ese email.";

/** Usuario que ya tiene ese email. `href` = su ficha, solo si quien pregunta puede verla. */
export type ExistingUser = { id: string; href: string | null };

/** Una persona = un email: se intentó crear (o aprobar) un usuario con un email que ya existe. */
export class DuplicateEmailError extends Error {
  readonly code = "duplicate-email";
  constructor(readonly existing: ExistingUser | null) {
    super(DUPLICATE_EMAIL_MESSAGE);
    this.name = "DuplicateEmailError";
  }
}

export function isDuplicateEmail(e: unknown): e is DuplicateEmailError {
  return e instanceof DuplicateEmailError || (typeof e === "object" && e !== null && (e as { code?: string }).code === "duplicate-email");
}

/** Link a la ficha del usuario existente (o null si quien pregunta no tiene acceso). */
export function existingUserFor(viewer: Viewer, p: Pick<Profile, "id" | "role" | "coachId">): ExistingUser {
  if (p.role === "client") return { id: p.id, href: canSeeClient(viewer, p) ? `/coach/clientes/${p.id}` : null };
  return { id: p.id, href: viewer?.role === "admin" ? `/coach/equipo/${p.id}` : null };
}

/** Compara nombres para confirmar una eliminación («Escribí el nombre»). */
export function sameName(typed: string, fullName: string): boolean {
  const n = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
  return n(typed) !== "" && n(typed) === n(fullName);
}
