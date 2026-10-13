"use server";

// Flujo «Primera vez / pedir acceso» con Supabase.
// - El pedido lo hace un anónimo: se valida acá (honeypot, duplicados, límite por email/IP) y se inserta con la
//   anon key, así RLS exige status «pending».
// - Aprobar: solo staff; crea el cliente, lo asigna al profe y manda la invitación (lleva a /activar).
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import {
  cleanAccessRequest,
  duplicateReason,
  isRateLimited,
  MESSAGES,
  RATE_LIMIT,
  validateAccessRequest,
  type AccessRequestInput,
  type SubmitResult,
} from "@/lib/access/rules";
import type { Profile, PublicCoach } from "@/lib/data/types";
import { DUPLICATE_EMAIL_MESSAGE, existingUserFor, type ExistingUser } from "@/lib/data/errors";
import { activeStaffId, callerRole, invite, profileByEmail, toProfileRow } from "@/lib/supabase/invite";
import { getAdminSupabase, getServerSupabase } from "@/lib/supabase/server";

async function ipHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  if (!ip) return null;
  // Nunca guardamos la IP en claro.
  const salt = process.env.ACCESS_IP_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "reactive";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** Profes activos para el selector público (solo nombre y especialidad). */
export async function listPublicCoaches(): Promise<PublicCoach[]> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, title")
    .eq("role", "coach")
    .is("disabled_at", null)
    .not("activated_at", "is", null)
    .order("full_name");
  return (data ?? []).map((r) => ({ id: r.id as string, fullName: r.full_name as string, title: (r.title as string) ?? null }));
}

export async function submitAccessRequest(input: AccessRequestInput): Promise<SubmitResult> {
  if (input.website) return { ok: false, reason: "spam", message: MESSAGES.spam };
  const errors = validateAccessRequest(input);
  if (Object.keys(errors).length) return { ok: false, reason: "invalid", errors };

  const clean = cleanAccessRequest(input);
  const admin = getAdminSupabase();
  const hash = await ipHash();

  const [{ data: existing }, { data: recent }] = await Promise.all([
    admin.from("profiles").select("email, disabled_at").eq("email", clean.email),
    admin
      .from("access_requests")
      .select("email, status, ip_hash, created_at")
      .gte("created_at", new Date(Date.now() - RATE_LIMIT.perEmailHours * 3_600_000).toISOString())
      .or(`email.eq."${clean.email}"${hash ? `,ip_hash.eq.${hash}` : ""}`),
  ]);
  const { data: pending } = await admin.from("access_requests").select("email, status").eq("email", clean.email).eq("status", "pending");

  const accounts = (existing ?? []).map((r) => ({ email: r.email as string, disabledAt: r.disabled_at as string | null }));
  const dup = duplicateReason(clean.email, pending ?? [], accounts);
  if (dup) return { ok: false, reason: dup, message: MESSAGES[dup] };
  const recentRows = (recent ?? []).map((r) => ({ email: r.email as string, ipHash: r.ip_hash as string | null, createdAt: r.created_at as string }));
  if (isRateLimited(recentRows, clean.email, hash)) return { ok: false, reason: "rate-limited", message: MESSAGES["rate-limited"] };

  // Insert como anónimo: RLS solo deja status «pending».
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const id = crypto.randomUUID();
  const { error } = await anon.from("access_requests").insert({
    id,
    full_name: clean.fullName,
    email: clean.email,
    phone: clean.phone,
    requested_coach_id: clean.requestedCoachId,
    case_type: clean.caseType,
    message: clean.message,
    status: "pending",
    ip_hash: hash,
  });
  if (error) return { ok: false, reason: "error", message: MESSAGES.error };
  return { ok: true, id };
}

export async function approveAccessRequest(
  id: string,
  opts: { coachId?: string | null; linkExisting?: boolean } = {},
): Promise<{ ok: true; profile: Profile | null; linked: boolean } | { ok: false; error: string; existing?: ExistingUser | null }> {
  const caller = await callerRole();
  if (!caller || (caller.role !== "coach" && caller.role !== "admin")) return { ok: false, error: "No autorizado." };
  const supabase = await getServerSupabase(); // RLS: el profe solo ve las que lo eligieron; el admin, todas
  const { data: r } = await supabase.from("access_requests").select("*").eq("id", id).maybeSingle();
  if (!r) return { ok: false, error: "No encontramos la solicitud." };
  if (r.status !== "pending") return { ok: false, error: "Esta solicitud ya fue revisada." };
  // El profe se lo queda; el admin elige a quién (por defecto, el que eligió la persona).
  const coachId = await activeStaffId(caller.role === "admin" ? (opts.coachId ?? r.requested_coach_id ?? caller.id) : caller.id);
  if (!coachId) return { ok: false, error: "Elegí un profe activo." };

  // Una persona = un email: si ya tiene cuenta, no se crea otra. Se ofrece vincular la solicitud a esa cuenta.
  const existing = await profileByEmail(r.email);
  if (existing) {
    if (!opts.linkExisting) return { ok: false, error: DUPLICATE_EMAIL_MESSAGE, existing: existingUserFor(caller, existing) };
    const admin = getAdminSupabase();
    if (existing.role === "client" && !existing.coachId) await admin.from("profiles").update({ coach_id: coachId }).eq("id", existing.id);
    await admin
      .from("access_requests")
      .update({ status: "approved", reviewed_by: caller.id, reviewed_at: new Date().toISOString(), linked_profile_id: existing.id })
      .eq("id", id);
    // El perfil se devuelve solo si quien aprueba lo puede ver (RLS).
    const { data: visible } = await supabase.from("profiles").select("*").eq("id", existing.id).maybeSingle();
    return { ok: true, profile: visible ? toProfileRow(visible) : null, linked: true };
  }

  const res = await invite(
    {
      fullName: r.full_name,
      email: r.email,
      phone: r.phone,
      caseType: r.case_type,
      goal: r.message,
      coachId,
      role: "client",
    },
    caller,
    "/activar",
  );
  if (!res.ok) return res;
  await supabase
    .from("access_requests")
    .update({ status: "approved", reviewed_by: caller.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  return { ok: true, profile: res.profile, linked: false };
}
