import "server-only";
// Invitaciones por email (Supabase Admin, service role). Solo se usa desde server actions que ya validaron al que llama.
import { getAdminSupabase, getServerSupabase } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/access/rules";
import type { Viewer } from "@/lib/access/scope";
import { DUPLICATE_EMAIL_MESSAGE, existingUserFor, type ExistingUser } from "@/lib/data/errors";
import type { NewClientInput } from "@/lib/data/repositories";
import type { Profile, Role } from "@/lib/data/types";

/** `existing`: el email ya tiene cuenta (una persona = un email). La UI ofrece «Ver ficha» o vincular. */
export type InviteResult = { ok: true; profile: Profile } | { ok: false; error: string; existing?: ExistingUser | null };

/** Usuario con ese email (normalizado), si existe. */
export async function profileByEmail(email: string): Promise<Pick<Profile, "id" | "role" | "coachId" | "fullName" | "email"> & { disabledAt: string | null } | null> {
  const { data } = await getAdminSupabase()
    .from("profiles")
    .select("id, role, coach_id, full_name, email, disabled_at")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  return data
    ? { id: data.id, role: data.role, coachId: data.coach_id, fullName: data.full_name, email: data.email, disabledAt: data.disabled_at }
    : null;
}

/** Corta el alta si el email ya existe. */
export async function duplicateFor(caller: Viewer, email: string): Promise<InviteResult | null> {
  const p = await profileByEmail(email);
  return p ? { ok: false, error: DUPLICATE_EMAIL_MESSAGE, existing: existingUserFor(caller, p) } : null;
}

export async function callerRole(): Promise<{ id: string; role: Role } | null> {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: row } = await supabase.from("profiles").select("id, role").eq("id", data.user.id).maybeSingle();
  return row ? { id: row.id as string, role: row.role as Role } : null;
}

/** Devuelve el id si es un profe/admin activo (para asignarle clientes). */
export async function activeStaffId(id: string | null): Promise<string | null> {
  if (!id) return null;
  const { data } = await getAdminSupabase().from("profiles").select("id, role, disabled_at").eq("id", id).maybeSingle();
  return data && (data.role === "coach" || data.role === "admin") && !data.disabled_at ? (data.id as string) : null;
}

export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function invite(
  input: NewClientInput & { role: Role; title?: string | null },
  caller: { id: string; role: Role },
  /** A dónde lleva el link del email: la activación crea la contraseña en /activar. */
  next = "/activar",
): Promise<InviteResult> {
  const admin = getAdminSupabase();
  const email = normalizeEmail(input.email);
  const dup = await duplicateFor(caller, email);
  if (dup) return dup;
  const invitedBy = caller.id;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    data: { full_name: input.fullName },
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message.includes("already") ? "Ya existe un usuario con ese email." : "No pudimos enviar la invitación." };
  }
  const row = {
    id: data.user.id,
    role: input.role,
    email,
    full_name: input.fullName,
    phone: input.phone ?? null,
    title: input.title ?? null,
    sport: input.sport ?? null,
    case_type: input.caseType ?? null,
    case_detail: input.caseDetail ?? null,
    goal: input.goal ?? null,
    coach_id: input.role === "client" ? (input.coachId ?? invitedBy) : null,
    client_since: input.role === "client" ? new Date().toISOString().slice(0, 10) : null,
  };
  const { data: saved, error: insErr } = await admin.from("profiles").upsert(row).select().single();
  if (insErr || !saved) return { ok: false, error: "Se envió la invitación pero no se pudo crear el perfil." };
  return { ok: true, profile: toProfileRow(saved) };
}

/** Fila de `profiles` → Profile (para devolver desde server actions). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fila cruda de PostgREST
export function toProfileRow(saved: Record<string, any>): Profile {
  return {
    id: saved.id,
    role: saved.role,
    fullName: saved.full_name,
    email: saved.email,
    phone: saved.phone,
    title: saved.title,
    sport: saved.sport,
    caseType: saved.case_type,
    caseDetail: saved.case_detail,
    goal: saved.goal,
    coachId: saved.coach_id,
    clientSince: saved.client_since,
    createdAt: saved.created_at,
    bio: saved.bio ?? null,
    avatarPath: saved.avatar_path ?? null,
    activatedAt: saved.activated_at ?? null,
    disabledAt: saved.disabled_at ?? null,
  };
}
