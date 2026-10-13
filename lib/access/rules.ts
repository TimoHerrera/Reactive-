// Reglas del flujo «Primera vez / pedir acceso». Puras: las usan el mock y el server action de Supabase.
import type { AccessRequest, CaseType } from "@/lib/data/types";

export type AccessRequestInput = {
  fullName: string;
  email: string;
  phone: string;
  requestedCoachId: string | null;
  caseType: CaseType | null;
  message: string;
  /** Honeypot: campo oculto que una persona deja vacío y un bot completa. */
  website?: string;
};

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; reason: "invalid"; errors: Partial<Record<"fullName" | "email" | "phone" | "message", string>> }
  | { ok: false; reason: "pending" | "account" | "paused" | "rate-limited" | "spam" | "error"; message: string };

export const RATE_LIMIT = { perEmail: 3, perEmailHours: 24, perIp: 5, perIpHours: 1 } as const;

export const normalizeEmail = (s: string) => s.trim().toLowerCase();
const digits = (s: string) => s.replace(/\D/g, "");

export function validateAccessRequest(input: AccessRequestInput) {
  const errors: Partial<Record<"fullName" | "email" | "phone" | "message", string>> = {};
  const name = input.fullName.trim();
  if (name.length < 3 || !/\s/.test(name)) errors.fullName = "Poné tu nombre y apellido.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(input.email))) errors.email = "Revisá el email.";
  const phone = digits(input.phone);
  if (phone.length < 8 || phone.length > 15) errors.phone = "Poné tu WhatsApp con código de área (ej. 11 5555 0101).";
  if (input.message.length > 500) errors.message = "Máximo 500 caracteres.";
  return errors;
}

/** Limpia lo que se guarda. */
export function cleanAccessRequest(input: AccessRequestInput) {
  return {
    fullName: input.fullName.trim().replace(/\s+/g, " "),
    email: normalizeEmail(input.email),
    phone: input.phone.trim(),
    requestedCoachId: input.requestedCoachId || null,
    caseType: input.caseType ?? null,
    message: input.message.trim() || null,
  };
}

/** Cuenta existente (para chequear duplicados). Una persona = un email. */
export type ExistingAccount = { email: string; disabledAt?: string | null };

/** ¿Ya existe la cuenta (activa o pausada) o hay una solicitud pendiente con ese email? */
export function duplicateReason(
  email: string,
  requests: Pick<AccessRequest, "email" | "status">[],
  accounts: (ExistingAccount | string)[],
): "pending" | "account" | "paused" | null {
  const e = normalizeEmail(email);
  const acc = accounts.map((a) => (typeof a === "string" ? { email: a } : a)).find((a) => normalizeEmail(a.email) === e);
  if (acc) return acc.disabledAt ? "paused" : "account";
  if (requests.some((r) => r.status === "pending" && normalizeEmail(r.email) === e)) return "pending";
  return null;
}

/** Límite de pedidos: por email (en el día) y por IP (en la hora). */
export function isRateLimited(
  recent: { email: string; ipHash?: string | null; createdAt: string }[],
  email: string,
  ipHash: string | null,
  now: Date = new Date(),
): boolean {
  const e = normalizeEmail(email);
  const since = (h: number) => now.getTime() - h * 3_600_000;
  const byEmail = recent.filter((r) => normalizeEmail(r.email) === e && new Date(r.createdAt).getTime() >= since(RATE_LIMIT.perEmailHours));
  if (byEmail.length >= RATE_LIMIT.perEmail) return true;
  if (ipHash) {
    const byIp = recent.filter((r) => r.ipHash === ipHash && new Date(r.createdAt).getTime() >= since(RATE_LIMIT.perIpHours));
    if (byIp.length >= RATE_LIMIT.perIp) return true;
  }
  return false;
}

export const MESSAGES = {
  pending: "Ya tenemos una solicitud tuya pendiente con ese email. Tu profe la va a revisar pronto.",
  account: "Ya tenés cuenta: ingresá o recuperá tu contraseña.",
  paused: "Tu cuenta está pausada, escribinos por WhatsApp.",
  "rate-limited": "Recibimos varios pedidos seguidos. Probá de nuevo más tarde o escribinos por WhatsApp.",
  spam: "No pudimos enviar el pedido.",
  error: "No pudimos enviar el pedido. Probá de nuevo en un rato.",
} as const;

/** Link de WhatsApp de la bio de Reactive. */
export const REACTIVE_WHATSAPP_LINK = "https://wa.link/tk8wy7";
