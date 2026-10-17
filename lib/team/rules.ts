// Gestión del equipo (profes y admins): permisos y códigos de invitación. Puro y testeable.
import type { Profile, Role } from "@/lib/data/types";

type Actor = { id: string; role: Role; disabledAt?: string | null };
type Target = Pick<Profile, "id" | "role">;

const isStaffRole = (r: Role) => r === "coach" || r === "admin";

/** Solo un admin activo gestiona el equipo (alta, roles, desactivar, códigos). */
export function canManageTeam(actor: Actor | null): boolean {
  return !!actor && actor.role === "admin" && !actor.disabledAt;
}

/**
 * Editar datos de un perfil (nombre, título, WhatsApp, bio, foto):
 * - admin: cualquiera;
 * - profe: el suyo y los de clientes;
 * - cliente: ninguno.
 * Rol y estado NO se cambian por acá (ver `canChangeRole`).
 */
export function canEditProfile(actor: Actor | null, target: Target): boolean {
  if (!actor || actor.disabledAt) return false;
  if (actor.role === "admin") return true;
  if (actor.role === "coach") return target.id === actor.id || target.role === "client";
  return false;
}

/** Cambiar el rol: solo admin, y nunca el propio (para no quedarse sin admins por error). */
export function canChangeRole(actor: Actor | null, target: Target, newRole: Role): boolean {
  if (!canManageTeam(actor)) return false;
  if (target.id === actor!.id) return false;
  return isStaffRole(newRole) === isStaffRole(target.role) || newRole === "client";
}

/** Desactivar: solo admin, no a sí mismo. */
export function canDeactivate(actor: Actor | null, target: Target): boolean {
  return canManageTeam(actor) && target.id !== actor!.id;
}

// ── Códigos de invitación ─────────────────────────────────────────

export const INVITE_CODE_HOURS = 48;
// Sin caracteres ambiguos (0/O, 1/I/L).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** «K7Q4-M2XP»: 8 caracteres al azar (≈ 40 bits). Se muestra una sola vez; se guarda hasheado. */
export function generateInviteCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(8);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Acepta minúsculas, espacios y sin guion. */
export function normalizeCode(input: string): string {
  const c = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeCode(code));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type InviteCodeRecord = { email: string; expiresAt: string; usedAt: string | null };
export type CodeCheck = "ok" | "expired" | "used" | "wrong-email" | "not-found";

/** Un solo uso, atado al email y con vencimiento. */
export function checkInviteCode(record: InviteCodeRecord | null, email: string, now: Date = new Date()): CodeCheck {
  if (!record) return "not-found";
  if (record.email.trim().toLowerCase() !== email.trim().toLowerCase()) return "wrong-email";
  if (record.usedAt) return "used";
  if (new Date(record.expiresAt).getTime() < now.getTime()) return "expired";
  return "ok";
}

export const CODE_MESSAGES: Record<Exclude<CodeCheck, "ok">, string> = {
  "not-found": "El código no es válido. Revisalo o pedile uno nuevo a Reactive.",
  "wrong-email": "Ese código no corresponde a este email.",
  used: "Ese código ya se usó. Si no podés entrar, pedí uno nuevo.",
  expired: "El código venció (dura 48 h). Pedile uno nuevo a Reactive.",
};

export function codeExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + INVITE_CODE_HOURS * 3_600_000).toISOString();
}

// ── Script create-admin ───────────────────────────────────────────

export function parseCreateAdminArgs(argv: string[]): { ok: true; email: string; name: string } | { ok: false; error: string } {
  const [email, ...rest] = argv.filter((a) => a !== "--");
  const name = rest.join(" ").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: 'Uso: npm run create-admin -- email@ejemplo.com "Nombre Apellido"' };
  }
  if (name.length < 2) return { ok: false, error: 'Falta el nombre. Uso: npm run create-admin -- email@ejemplo.com "Nombre Apellido"' };
  return { ok: true, email: email.trim().toLowerCase(), name };
}
